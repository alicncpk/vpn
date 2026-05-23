/**
 * Sing-box Configuration Service
 * 
 * Compiles functional JSON routing profile parameters conforming to the
 * client-side schema configuration requirements of sing-box (Go-based proxy core).
 */

export interface SingBoxVlessServer {
  address: string;
  port: number;
  uuid: string;
  host: string;
  path: string;
}

export class SingBoxConfigService {
  /**
   * Generates a complete sing-box profile JSON payload.
   */
  public static generateProfile(server: SingBoxVlessServer, localSocksPort: number = 10808): string {
    const config = {
      log: {
        level: "info",
        timestamp: true
      },
      dns: {
        servers: [
          {
            tag: "dns-remote",
            address: "https://1.1.1.1/dns-query", // Cloudflare DoH
            detour: "proxy"
          },
          {
            tag: "dns-local",
            address: "8.8.8.8", // Google DNS fallback
            detour: "direct"
          }
        ],
        rules: [
          {
            outbound: "any",
            server: "dns-local"
          },
          {
            query_type: [ "A", "AAAA" ],
            server: "dns-remote"
          }
        ]
      },
      inbounds: [
        {
          type: "tun",
          tag: "tun-in",
          interface_name: "tun0",
          address: [ "172.19.0.1/30" ],
          auto_route: true,
          strict_route: true,
          stack: "gvisor",
          sniff: true
        },
        {
          type: "mixed",
          tag: "mixed-in",
          listen: "127.0.0.1",
          listen_port: localSocksPort,
          sniff: true
        }
      ],
      outbounds: [
        {
          type: "vless",
          tag: "proxy",
          server: server.address,
          server_port: server.port,
          uuid: server.uuid,
          flow: "",
          packet_encoding: "xudp",
          transport: {
            type: "ws",
            path: server.path,
            headers: {
              Host: server.host
            }
          },
          tls: {
            enabled: true,
            server_name: server.host,
            insecure: false
          }
        },
        {
          type: "direct",
          tag: "direct"
        },
        {
          type: "block",
          tag: "block"
        }
      ],
      route: {
        rules: [
          {
            protocol: "dns",
            outbound: "dns-out"
          },
          {
            ip_is_private: true,
            outbound: "direct"
          }
        ],
        auto_detect_interface: true
      }
    };

    return JSON.stringify(config, null, 2);
  }
}
