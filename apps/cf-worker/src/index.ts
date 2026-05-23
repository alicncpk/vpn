import { connect } from 'cloudflare:sockets';

export interface Env {
  UUID: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      // Direct HTTP requests see a normal web page for camouflage
      return new Response(
        `<!DOCTYPE html>
        <html>
        <head>
          <title>Ali CNC CDN Edge Node</title>
          <style>
            body { background: #0c0f12; color: #a9b7c6; font-family: 'Courier New', monospace; padding: 50px; text-align: center; }
            h1 { color: #00ffd2; text-shadow: 0 0 10px rgba(0,255,210,0.5); }
            .panel { border: 1px solid #1a222a; background: #0f1318; padding: 30px; display: inline-block; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .status { color: #00ff66; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="panel">
            <h1>Ali CNC Edge Node</h1>
            <p>System Status: <span class="status">ACTIVE</span></p>
            <p>Protocol: VLESS over WebSockets</p>
            <p>Version: 1.0.0</p>
          </div>
        </body>
        </html>`,
        {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    // Initialize websocket connection
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();

    let isConnected = false;
    let remoteSocket: any = null;

    server.addEventListener('message', async (event) => {
      try {
        const messageData = event.data as ArrayBuffer;

        if (!isConnected) {
          // Parse VLESS Header
          // Minimum header length: Version(1) + UUID(16) + AddonsLen(1) + Cmd(1) + Port(2) + AddrType(1) = 22 bytes
          if (messageData.byteLength < 22) {
            server.close(1003, 'Invalid VLESS Request Header Length');
            return;
          }

          const view = new DataView(messageData);

          // 1. Version Check
          const version = view.getUint8(0);
          if (version !== 0) {
            server.close(1003, 'Unsupported protocol version');
            return;
          }

          // 2. Authenticate UUID
          const clientUuid = parseUuid(messageData.slice(1, 17));
          const expectedUuid = env.UUID.trim().toLowerCase();
          if (clientUuid !== expectedUuid) {
            server.close(1003, 'Authentication failed');
            return;
          }

          // 3. Extract Addons
          const addonsLength = view.getUint8(17);
          let offset = 18 + addonsLength;

          // 4. Command (1 = TCP, 2 = UDP)
          const command = view.getUint8(offset);
          offset += 1;

          // 5. Destination Port
          const port = view.getUint16(offset);
          offset += 2;

          // 6. Address Type (1 = IPv4, 2 = Domain, 3 = IPv6)
          const addressType = view.getUint8(offset);
          offset += 1;

          let destinationAddress = '';
          if (addressType === 1) {
            // IPv4 (4 bytes)
            const ipParts = new Uint8Array(messageData.slice(offset, offset + 4));
            destinationAddress = ipParts.join('.');
            offset += 4;
          } else if (addressType === 2) {
            // Domain Name (1 byte length + string content)
            const domainLength = view.getUint8(offset);
            offset += 1;
            const domainBytes = new Uint8Array(messageData.slice(offset, offset + domainLength));
            destinationAddress = new TextDecoder().decode(domainBytes);
            offset += domainLength;
          } else if (addressType === 3) {
            // IPv6 (16 bytes)
            const ipParts: string[] = [];
            for (let i = 0; i < 8; i++) {
              ipParts.push(view.getUint16(offset + i * 2).toString(16));
            }
            destinationAddress = ipParts.join(':');
            offset += 16;
          } else {
            server.close(1003, 'Unsupported Address Type');
            return;
          }

          const rawPayload = messageData.slice(offset);

          // Establish TCP connection to the destination
          try {
            remoteSocket = connect({
              hostname: destinationAddress,
              port: port
            });
          } catch (connectError: any) {
            server.close(1011, `TCP connection failed to ${destinationAddress}:${port} - ${connectError.message}`);
            return;
          }

          const writer = remoteSocket.writable.getWriter();

          // VLESS handshake response: protocol version (0) + addons length (0)
          const responseHeader = new Uint8Array([0, 0]);
          server.send(responseHeader);

          // Write initial payload chunk to remote if present
          if (rawPayload.byteLength > 0) {
            await writer.write(rawPayload);
          }

          isConnected = true;
          writer.releaseLock();

          // Asynchronously pipe data from the remote socket back to the client websocket
          ctx.waitUntil(pipeRemoteToWs(remoteSocket, server));
        } else {
          // Relaying subsequent VLESS data packages directly to remote TCP socket
          if (remoteSocket) {
            const writer = remoteSocket.writable.getWriter();
            await writer.write(messageData);
            writer.releaseLock();
          }
        }
      } catch (err: any) {
        closeSockets(remoteSocket, server);
      }
    });

    server.addEventListener('close', () => {
      closeSockets(remoteSocket, server);
    });

    server.addEventListener('error', () => {
      closeSockets(remoteSocket, server);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
};

/**
 * Format bytes array to standard UUID string format.
 */
function parseUuid(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join('')
  ].join('-');
}

/**
 * Reads from remote socket stream and writes binary messages back to WS client.
 */
async function pipeRemoteToWs(remoteSocket: any, ws: WebSocket) {
  const reader = remoteSocket.readable.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      ws.send(value);
    }
  } catch (e) {
    // Handle socket read errors gracefully
  } finally {
    ws.close();
  }
}

/**
 * Ensures clean closing of both TCP socket connections and WS sessions.
 */
function closeSockets(remoteSocket: any, ws: WebSocket) {
  try {
    if (remoteSocket) {
      remoteSocket.close();
    }
  } catch (e) {}
  try {
    ws.close();
  } catch (e) {}
}
