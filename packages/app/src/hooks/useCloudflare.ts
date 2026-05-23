import { useState, useCallback } from 'react';
import { Linking } from 'react-native';

export interface CloudflareAccount {
  id: string;
  name: string;
}

export interface DeploymentResult {
  subdomain: string;
  uuid: string;
  scriptName: string;
}

export type CloudflareDeploymentStatus = 
  | 'idle'
  | 'authenticating'
  | 'fetching_accounts'
  | 'deploying'
  | 'completed'
  | 'error';

// Custom configuration for registration - fallback to official Client Credentials/API limits
const OAUTH_CLIENT_ID = 'ali-cnc-vpn-client-app';
const REDIRECT_URI = 'alicncvpn://oauth-callback';

// Raw bundled VLESS worker script text to upload
const WORKER_SCRIPT_SOURCE = `
import { connect } from 'cloudflare:sockets';

export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response(
        \`<!DOCTYPE html>
        <html>
        <head>
          <title>Ali CNC VPN Private Egress Node</title>
          <style>
            body { background: #0c0f12; color: #a9b7c6; font-family: 'Courier New', monospace; padding: 50px; text-align: center; }
            h1 { color: #ff9d00; text-shadow: 0 0 10px rgba(255,157,0,0.5); }
            .panel { border: 1px solid #1a222a; background: #0f1318; padding: 30px; display: inline-block; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .status { color: #00ff66; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="panel">
            <h1>Ali CNC Private Node</h1>
            <p>Status: <span class="status">ONLINE</span></p>
            <p>Access Level: Authenticated Core Only</p>
          </div>
        </body>
        </html>\`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    server.accept();

    let isConnected = false;
    let remoteSocket = null;

    server.addEventListener('message', async (event) => {
      try {
        const messageData = event.data;
        if (!isConnected) {
          if (messageData.byteLength < 22) {
            server.close(1003, 'Invalid Header');
            return;
          }
          const view = new DataView(messageData);
          if (view.getUint8(0) !== 0) {
            server.close(1003, 'Unsupported Protocol');
            return;
          }
          const clientUuid = parseUuid(messageData.slice(1, 17));
          if (clientUuid !== env.UUID.trim().toLowerCase()) {
            server.close(1003, 'Auth Failed');
            return;
          }
          let offset = 18 + view.getUint8(17);
          const command = view.getUint8(offset); offset += 1;
          const port = view.getUint16(offset); offset += 2;
          const addressType = view.getUint8(offset); offset += 1;
          let destinationAddress = '';
          if (addressType === 1) {
            destinationAddress = new Uint8Array(messageData.slice(offset, offset + 4)).join('.');
            offset += 4;
          } else if (addressType === 2) {
            const domainLength = view.getUint8(offset); offset += 1;
            destinationAddress = new TextDecoder().decode(new Uint8Array(messageData.slice(offset, offset + domainLength)));
            offset += domainLength;
          } else if (addressType === 3) {
            const ipParts = [];
            for (let i = 0; i < 8; i++) ipParts.push(view.getUint16(offset + i * 2).toString(16));
            destinationAddress = ipParts.join(':');
            offset += 16;
          } else {
            server.close(1003, 'Unsupported Addr');
            return;
          }
          const rawPayload = messageData.slice(offset);
          try {
            remoteSocket = connect({ hostname: destinationAddress, port: port });
          } catch (e) {
            server.close(1011, 'Connect Error');
            return;
          }
          const writer = remoteSocket.writable.getWriter();
          server.send(new Uint8Array([0, 0]));
          if (rawPayload.byteLength > 0) {
            await writer.write(rawPayload);
          }
          isConnected = true;
          writer.releaseLock();
          ctx.waitUntil(pipeRemoteToWs(remoteSocket, server));
        } else {
          if (remoteSocket) {
            const writer = remoteSocket.writable.getWriter();
            await writer.write(messageData);
            writer.releaseLock();
          }
        }
      } catch (e) {
        closeSockets(remoteSocket, server);
      }
    });

    server.addEventListener('close', () => closeSockets(remoteSocket, server));
    server.addEventListener('error', () => closeSockets(remoteSocket, server));

    return new Response(null, { status: 101, webSocket: client });
  }
};

function parseUuid(buffer) {
  const bytes = new Uint8Array(buffer);
  const hex = [];
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

async function pipeRemoteToWs(remoteSocket, ws) {
  const reader = remoteSocket.readable.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      ws.send(value);
    }
  } catch (e) {} finally {
    ws.close();
  }
}

function closeSockets(remoteSocket, ws) {
  try { if (remoteSocket) remoteSocket.close(); } catch (e) {}
  try { ws.close(); } catch (e) {}
}
`;

export const useCloudflare = () => {
  const [status, setStatus] = useState<CloudflareDeploymentStatus>('idle');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<CloudflareAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 1. Generate Auth URL and trigger redirect
  const initiateLogin = useCallback(() => {
    setStatus('authenticating');
    setError(null);
    const authUrl = `https://dash.cloudflare.com/oauth2/auth?response_type=code&client_id=${OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=workers:write%20accounts:read`;
    Linking.openURL(authUrl).catch((err) => {
      setError(`Failed to open browser: ${err.message}`);
      setStatus('error');
    });
  }, []);

  // 2. Exchange callback code for token
  const handleAuthCode = useCallback(async (code: string) => {
    setStatus('fetching_accounts');
    setError(null);
    try {
      const response = await fetch('https://dash.cloudflare.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_id=${OAUTH_CLIENT_ID}`,
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      const token = data.access_token;
      setAccessToken(token);
      await fetchAccounts(token);
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  }, []);

  // Alternative developer entry: configure direct Cloudflare API token
  const authenticateWithToken = useCallback(async (token: string) => {
    setStatus('fetching_accounts');
    setError(null);
    setAccessToken(token);
    try {
      await fetchAccounts(token);
    } catch (err: any) {
      setError(`Invalid API Token: ${err.message}`);
      setStatus('error');
    }
  }, []);

  // 3. Fetch list of Cloudflare Accounts
  const fetchAccounts = async (token: string) => {
    const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Cloudflare accounts: ${response.statusText}`);
    }

    const resBody = await response.json();
    if (resBody.success && resBody.result.length > 0) {
      const parsedAccounts = resBody.result.map((acc: any) => ({
        id: acc.id,
        name: acc.name,
      }));
      setAccounts(parsedAccounts);
      setStatus('idle');
    } else {
      throw new Error('No Cloudflare Accounts found on this profile.');
    }
  };

  // 4. Deploy VLESS Worker to selected account
  const deployWorker = useCallback(async (
    accountId: string, 
    customUuid: string,
    scriptName: string = 'ali-cnc-vpn-node'
  ): Promise<DeploymentResult | null> => {
    if (!accessToken) {
      setError('OAuth Credentials / Access Token not found');
      setStatus('error');
      return null;
    }

    setStatus('deploying');
    setError(null);

    try {
      // Create multi-part form data to upload script + script configuration variables
      const formData = new FormData();

      // Configure Worker configuration metadata (Compatibility properties + Env variables binding)
      const metadata = {
        main_module: 'index.js',
        compatibility_date: '2024-05-12',
        compatibility_flags: ['nodejs_compat'],
        bindings: [
          {
            type: 'plain_text',
            name: 'UUID',
            text: customUuid.trim().toLowerCase(),
          }
        ]
      };

      formData.append('metadata', JSON.stringify(metadata));
      
      // Append the raw text script source as index.js
      formData.append('script', WORKER_SCRIPT_SOURCE);

      const deployUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`;
      
      // Upload worker script
      const uploadRes = await fetch(deployUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        const apiError = errorData.errors?.[0]?.message || uploadRes.statusText;
        throw new Error(`Worker upload failed: ${apiError}`);
      }

      // Check worker routing subdomain
      const subdomainRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      let subdomain = `${scriptName}.cloudflare.workers.dev`;
      if (subdomainRes.ok) {
        const subData = await subdomainRes.json();
        if (subData.success && subData.result?.subdomain) {
          subdomain = `${scriptName}.${subData.result.subdomain}.workers.dev`;
        }
      }

      setStatus('completed');
      return {
        subdomain,
        uuid: customUuid,
        scriptName
      };
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
      return null;
    }
  }, [accessToken]);

  return {
    status,
    accounts,
    error,
    accessToken,
    initiateLogin,
    handleAuthCode,
    authenticateWithToken,
    deployWorker,
    setStatus,
  };
};
