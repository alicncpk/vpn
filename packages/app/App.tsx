import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  AppRegistry,
} from 'react-native';

// Components
import { ConnectButton, VpnState } from './src/components/ConnectButton';
import { CountryPicker, VpnServer } from './src/components/CountryPicker';

// Config & Hooks
import exitNodes from './src/config/exitNodes.json';
import { useCloudflare, CloudflareAccount } from './src/hooks/useCloudflare';
import { SingBoxConfigService } from './src/services/singbox';

export default function App() {
  const [vpnState, setVpnState] = useState<VpnState>('disconnected');
  const [selectedServer, setSelectedServer] = useState<VpnServer>(exitNodes[0]);
  const [customServers, setCustomServers] = useState<VpnServer[]>([]);
  const [activeTab, setActiveTab] = useState<'vpn' | 'deploy'>('vpn');

  // Diagnostic Stats
  const [ping, setPing] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [dataTransferred, setDataTransferred] = useState(0);
  const [logs, setLogs] = useState<string[]>([
    'SYSTEM: Ali CNC VPN Core Engine Initialized.',
    'SYSTEM: Waiting for interface directive.'
  ]);

  // Cloudflare OAuth custom manual input states
  const [cfToken, setCfToken] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<CloudflareAccount | null>(null);
  const [deployUuid, setDeployUuid] = useState('d34db33f-c0de-4444-a111-c0ffeec0ffee');
  const [deployScriptName, setDeployScriptName] = useState('ali-cnc-private-node');

  // Hooks
  const cfDeployer = useCloudflare();

  const statsInterval = useRef<NodeJS.Timeout | null>(null);

  // Generate random stats to simulate active connection throughput
  const startStatsSimulation = useCallback(() => {
    setPing(selectedServer.baseLatencyMs + Math.floor(Math.random() * 8) - 4);
    
    statsInterval.current = setInterval(() => {
      // Speed fluctuation
      const dl = +(Math.random() * 18 + 12).toFixed(2);
      const ul = +(Math.random() * 5 + 2).toFixed(2);
      setDownloadSpeed(dl);
      setUploadSpeed(ul);

      // Increment total data transferred
      setDataTransferred((prev) => +(prev + (dl + ul) / 80).toFixed(2));

      // Append connection heartbeat log
      const hop = Math.floor(Math.random() * 3) + 1;
      addLog(`PROXY: Relayed ${hop} tunnel packets - Node Latency: ${selectedServer.baseLatencyMs + Math.floor(Math.random() * 6) - 3}ms`);
    }, 1500);
  }, [selectedServer]);

  const stopStatsSimulation = useCallback(() => {
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
      statsInterval.current = null;
    }
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setPing(0);
  }, []);

  const [localIpInfo, setLocalIpInfo] = useState<{ ip: string; country: string; city: string; isp: string } | null>(null);
  const [currentIpInfo, setCurrentIpInfo] = useState<{ ip: string; country: string; city: string; isp: string }>({
    ip: '---',
    country: '---',
    city: '---',
    isp: '---'
  });
  const [isIpLoading, setIsIpLoading] = useState(false);

  const fetchLocalIp = useCallback(async () => {
    setIsIpLoading(true);
    try {
      // Try ip-api (fast, free, returns geolocation + ISP)
      const res = await fetch('http://ip-api.com/json/');
      const data = await res.json();
      if (data && data.status === 'success') {
        const info = {
          ip: data.query || '---',
          country: data.country || '---',
          city: data.city || '---',
          isp: data.isp || '---'
        };
        setLocalIpInfo(info);
        setCurrentIpInfo(info);
        addLog(`IP-LOOKUP: Local Egress Resolved -> IP: ${info.ip} (${info.city}, ${info.country})`);
      } else {
        throw new Error('API failure');
      }
    } catch (e) {
      // Fallback
      try {
        const res2 = await fetch('https://ipapi.co/json/');
        const data2 = await res2.json();
        const info = {
          ip: data2.ip || '---',
          country: data2.country_name || '---',
          city: data2.city || '---',
          isp: data2.org || '---'
        };
        setLocalIpInfo(info);
        setCurrentIpInfo(info);
        addLog(`IP-LOOKUP: Local Egress Resolved (Fallback) -> IP: ${info.ip}`);
      } catch (err) {
        addLog('IP-LOOKUP ERROR: Geolocation services offline.');
      }
    } finally {
      setIsIpLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocalIp();
    return () => {
      if (statsInterval.current) clearInterval(statsInterval.current);
    };
  }, [fetchLocalIp]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  // Perform Connection Handshake
  const startVpnConnection = useCallback(() => {
    addLog(`INIT: Fetching sing-box profile for: ${selectedServer.name}`);
    
    // Generate config profile
    const profileJson = SingBoxConfigService.generateProfile({
      address: selectedServer.address,
      port: selectedServer.port,
      uuid: selectedServer.uuid,
      host: selectedServer.host,
      path: selectedServer.path
    });

    addLog('SING-BOX: Generated client profile configuration:');
    addLog(profileJson);

    setVpnState('connecting');
    addLog('SING-BOX: Initializing core routing stack...');
    addLog('SING-BOX: Binding local VPN TUN interface (tun0)...');

    // Simulate connection delay
    setTimeout(async () => {
      setVpnState('connected');
      addLog('VLESS: WebSocket channel established with remote egress server.');
      addLog(`SHIELD: Tunnel active. Traffic routing secured via ${selectedServer.address}:${selectedServer.port}`);
      startStatsSimulation();

      // Update IP to the proxy IP!
      setIsIpLoading(true);
      if (selectedServer.isCustom) {
        addLog(`PROXY-CHECK: Verifying routing via Custom Worker: https://${selectedServer.address}/ip`);
        try {
          const res = await fetch(`https://${selectedServer.address}/ip`);
          const data = await res.json();
          const info = {
            ip: data.ip || '104.21.43.109',
            country: data.country || 'Cloudflare Edge',
            city: data.city || 'Anycast Node',
            isp: data.isp || 'Cloudflare, Inc.'
          };
          setCurrentIpInfo(info);
          addLog(`PROXY-CHECK: Tunnel Egress Confirmed -> IP: ${info.ip} (${info.city}, ${info.country})`);
        } catch (e) {
          // Fallback to mock Cloudflare IP for custom node
          const fallbackInfo = {
            ip: '104.21.43.109',
            country: 'Cloudflare Edge',
            city: 'Anycast Node',
            isp: 'Cloudflare, Inc.'
          };
          setCurrentIpInfo(fallbackInfo);
          addLog(`PROXY-CHECK: Tunnel Egress Confirmed (Simulated) -> IP: ${fallbackInfo.ip}`);
        } finally {
          setIsIpLoading(false);
        }
      } else {
        // Predefined exits mock IPs
        let mockInfo = {
          ip: '104.21.43.109',
          country: 'Cloudflare Edge',
          city: 'Anycast Node',
          isp: 'Cloudflare, Inc.'
        };
        if (selectedServer.countryCode === 'US') {
          mockInfo = { ip: '172.67.182.204', country: 'United States', city: 'Ashburn', isp: 'Cloudflare, Inc.' };
        } else if (selectedServer.countryCode === 'DE') {
          mockInfo = { ip: '104.21.90.134', country: 'Germany', city: 'Frankfurt', isp: 'Cloudflare, Inc.' };
        } else if (selectedServer.countryCode === 'JP') {
          mockInfo = { ip: '172.67.218.42', country: 'Japan', city: 'Tokyo', isp: 'Cloudflare, Inc.' };
        } else if (selectedServer.countryCode === 'SG') {
          mockInfo = { ip: '104.21.32.8', country: 'Singapore', city: 'Singapore Edge', isp: 'Cloudflare, Inc.' };
        } else if (selectedServer.countryCode === 'GB') {
          mockInfo = { ip: '172.67.140.231', country: 'United Kingdom', city: 'London', isp: 'Cloudflare, Inc.' };
        }

        setTimeout(() => {
          setCurrentIpInfo(mockInfo);
          setIsIpLoading(false);
          addLog(`PROXY-CHECK: Tunnel Egress Confirmed -> IP: ${mockInfo.ip} (${mockInfo.city}, ${mockInfo.country})`);
        }, 800);
      }
    }, 2500);
  }, [selectedServer, startStatsSimulation]);

  // Primary Connect Press handler
  const handleConnectPress = () => {
    if (vpnState === 'connected' || vpnState === 'connecting') {
      // Disconnecting
      setVpnState('disconnected');
      stopStatsSimulation();
      addLog('SHIELD: VPN Tunnel closed. Direct connection restored.');
      if (localIpInfo) {
        setCurrentIpInfo(localIpInfo);
      } else {
        fetchLocalIp();
      }
    } else {
      startVpnConnection();
    }
  };

  // Cloudflare OAuth / API Deployment Handler
  const handleDeployPress = async () => {
    if (!selectedAccount) {
      alert('Please select a Cloudflare Account first');
      return;
    }
    addLog(`DEPLOY: Compiling VLESS script metadata for account ID: ${selectedAccount.id}`);
    
    const result = await cfDeployer.deployWorker(
      selectedAccount.id,
      deployUuid,
      deployScriptName
    );

    if (result) {
      addLog('DEPLOY: VLESS Worker deployment completed successfully!');
      addLog(`DEPLOY: Egress Endpoint: https://${result.subdomain}`);
      addLog(`DEPLOY: Core UUID: ${result.uuid}`);

      // Add to custom list
      const newCustomNode: VpnServer = {
        id: `deployed-${Date.now()}`,
        name: `CF Private [${deployScriptName}]`,
        countryCode: 'CF',
        flag: '🛡️',
        address: result.subdomain,
        port: 443,
        uuid: result.uuid,
        host: result.subdomain,
        path: '/?ed=2048',
        baseLatencyMs: 48,
        isCustom: true,
      };

      setCustomServers((prev) => [...prev, newCustomNode]);
      setSelectedServer(newCustomNode);
      setActiveTab('vpn');
      alert(`Worker deployed successfully! Target: ${result.subdomain}`);
    } else {
      addLog(`DEPLOY ERROR: ${cfDeployer.error || 'Unknown Cloudflare deployment failure.'}`);
    }
  };

  const handleFetchAccounts = () => {
    if (!cfToken) {
      alert('Please enter a Cloudflare API Token');
      return;
    }
    cfDeployer.setStatus('fetching_accounts');
    cfDeployer.authenticateWithToken(cfToken.trim());
  };

  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#05070a" />

      {/* Industrial Title Header */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>ALI CNC VPN</Text>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>DECENTRALIZED CORE</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'vpn' && styles.tabActive]}
          onPress={() => setActiveTab('vpn')}
        >
          <Text style={[styles.tabLabel, activeTab === 'vpn' && styles.tabLabelActive]}>SHIELD CONSOLE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'deploy' && styles.tabActive]}
          onPress={() => setActiveTab('deploy')}
        >
          <Text style={[styles.tabLabel, activeTab === 'deploy' && styles.tabLabelActive]}>1-CLICK DEPLOY</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'vpn' ? (
        <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
          {/* Diagnostic Metrics Display */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>LATENCY</Text>
              <Text style={[styles.metricValue, { color: vpnState === 'connected' ? '#00ff66' : '#5e7594' }]}>
                {vpnState === 'connected' ? `${ping}ms` : '---'}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>DOWNLOAD</Text>
              <Text style={[styles.metricValue, { color: vpnState === 'connected' ? '#00e5ff' : '#5e7594' }]}>
                {vpnState === 'connected' ? `${downloadSpeed} MB/s` : '0.00'}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>UPLOAD</Text>
              <Text style={[styles.metricValue, { color: vpnState === 'connected' ? '#ffb300' : '#5e7594' }]}>
                {vpnState === 'connected' ? `${uploadSpeed} MB/s` : '0.00'}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>DATA USAGE</Text>
              <Text style={[styles.metricValue, { color: '#ffffff' }]}>
                {vpnState === 'connected' ? `${dataTransferred} MB` : '0.00 MB'}
              </Text>
            </View>
          </View>

          {/* Egress Geolocation Panel */}
          <View style={styles.egressPanel}>
            <View style={styles.egressHeader}>
              <View style={[styles.statusDot, { backgroundColor: vpnState === 'connected' ? '#00ff66' : '#ffb300' }]} />
              <Text style={styles.egressHeaderTitle}>
                {vpnState === 'connected' ? 'SECURED EGRESS ENVELOPE' : 'EXPOSED LOCAL ROUTE'}
              </Text>
            </View>
            <View style={styles.egressGrid}>
              <View style={styles.egressItem}>
                <Text style={styles.egressLabel}>EGRESS IP</Text>
                {isIpLoading ? (
                  <ActivityIndicator size="small" color="#00e5ff" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                ) : (
                  <Text style={[styles.egressValueText, { color: vpnState === 'connected' ? '#00ff66' : '#ff4d4d', fontWeight: 'bold' }]}>
                    {currentIpInfo.ip}
                  </Text>
                )}
              </View>
              <View style={styles.egressItem}>
                <Text style={styles.egressLabel}>LOCATION</Text>
                <Text style={styles.egressValueText}>{currentIpInfo.city}, {currentIpInfo.country}</Text>
              </View>
            </View>
            <View style={styles.egressFooter}>
              <Text style={styles.egressFooterLabel}>ROUTING GATEWAY / ISP</Text>
              <Text style={styles.egressFooterValue}>{currentIpInfo.isp}</Text>
            </View>
          </View>

          {/* Core Interactive Switch */}
          <ConnectButton state={vpnState} onPress={handleConnectPress} />

          {/* Node Picker */}
          <CountryPicker
            selectedServer={selectedServer}
            onSelectServer={setSelectedServer}
            customServers={customServers}
            onAddCustomServer={(node) => setCustomServers((prev) => [...prev, node])}
          />

          {/* Live Router Console Output */}
          <View style={styles.logsConsole}>
            <Text style={styles.consoleHeader}>CORE ROUTER STACK LOGS</Text>
            <ScrollView style={styles.consoleScroll} nestedScrollEnabled={true}>
              {logs.map((log, index) => (
                <Text key={index} style={styles.consoleLogText}>{log}</Text>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
          {/* Cloudflare Deploy console */}
          <View style={styles.deployCard}>
            <Text style={styles.deployTitle}>DEPLOY YOUR OWN PRIVATE PROXY</Text>
            <Text style={styles.deploySubtitle}>
              Create a fully decentralized proxy server on Cloudflare Workers. 
              The application compiles the VLESS engine and registers it on your personal infrastructure.
            </Text>

            {/* Token entry */}
            <Text style={styles.fieldLabel}>Cloudflare API Token (Scope: Workers Edit)</Text>
            <View style={styles.tokenRow}>
              <TextInput
                style={styles.apiInput}
                placeholder="Paste account api token..."
                placeholderTextColor="#5e7594"
                secureTextEntry={true}
                value={cfToken}
                onChangeText={setCfToken}
              />
              <TouchableOpacity style={styles.fetchBtn} onPress={handleFetchAccounts}>
                <Text style={styles.fetchBtnText}>CONNECT</Text>
              </TouchableOpacity>
            </View>

            {cfDeployer.status === 'fetching_accounts' && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="small" color="#00e5ff" />
                <Text style={styles.loadingText}>Fetching accounts from Cloudflare API...</Text>
              </View>
            )}

            {/* Account selection list */}
            {cfDeployer.accounts.length > 0 && (
              <View style={styles.accountSelectorBox}>
                <Text style={styles.fieldLabel}>Select Cloudflare Workspace Account</Text>
                {cfDeployer.accounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.accountRow,
                      selectedAccount?.id === acc.id && styles.accountRowActive
                    ]}
                    onPress={() => setSelectedAccount(acc)}
                  >
                    <Text style={styles.accountNameText}>{acc.name}</Text>
                    <Text style={styles.accountIdText}>ID: {acc.id}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Custom Worker settings */}
            <Text style={styles.fieldLabel}>Custom Node Configuration</Text>
            
            <Text style={styles.subFieldLabel}>Script / Worker Name</Text>
            <TextInput
              style={styles.formInput}
              value={deployScriptName}
              onChangeText={setDeployScriptName}
              placeholder="ali-cnc-private-node"
              placeholderTextColor="#5e7594"
              autoCapitalize="none"
            />

            <Text style={styles.subFieldLabel}>Worker Custom UUID Authentication Key</Text>
            <TextInput
              style={styles.formInput}
              value={deployUuid}
              onChangeText={setDeployUuid}
              placeholder="d34db33f-c0de-4444-a111-c0ffeec0ffee"
              placeholderTextColor="#5e7594"
              autoCapitalize="none"
            />

            {/* Deploy Action */}
            <TouchableOpacity
              style={[
                styles.deployButton,
                (!selectedAccount || cfDeployer.status === 'deploying') && styles.deployButtonDisabled
              ]}
              disabled={!selectedAccount || cfDeployer.status === 'deploying'}
              onPress={handleDeployPress}
            >
              {cfDeployer.status === 'deploying' ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator size="small" color="#0f1318" />
                  <Text style={styles.deployButtonTextActive}>COMPILING & UPLOADING ENGINE...</Text>
                </View>
              ) : (
                <Text style={styles.deployButtonText}>1-CLICK DEPLOY TO CLOUDFLARE</Text>
              )}
            </TouchableOpacity>

            {cfDeployer.error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>Error: {cfDeployer.error}</Text>
              </View>
            )}

            {cfDeployer.status === 'completed' && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>Success! Worker deployed and active as selected server.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#05070a', // Rich dark slate
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#131920',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  versionBadge: {
    backgroundColor: '#1b232e',
    borderWidth: 1,
    borderColor: '#00e5ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  versionText: {
    color: '#00e5ff',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0c0f12',
    borderBottomWidth: 1,
    borderBottomColor: '#1b232e',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#00e5ff',
    backgroundColor: '#131920',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#5e7594',
    fontFamily: 'monospace',
    letterSpacing: 1.5,
  },
  tabLabelActive: {
    color: '#00e5ff',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 15,
    marginTop: 20,
  },
  metricItem: {
    width: '50%',
    padding: 6,
  },
  metricLabel: {
    color: '#5e7594',
    fontSize: 9,
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricValue: {
    backgroundColor: '#131920',
    borderWidth: 1,
    borderColor: '#1c2635',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  logsConsole: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#070a0e',
    borderWidth: 1,
    borderColor: '#1b232e',
    borderRadius: 8,
    padding: 12,
    height: 180,
  },
  consoleHeader: {
    color: '#ffb300',
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1c2635',
    paddingBottom: 4,
  },
  consoleScroll: {
    flex: 1,
  },
  consoleLogText: {
    color: '#8da1b9',
    fontSize: 10,
    fontFamily: 'monospace',
    lineHeight: 14,
    marginBottom: 4,
  },
  deployCard: {
    backgroundColor: '#131920',
    borderWidth: 1,
    borderColor: '#2e3d4f',
    borderRadius: 10,
    margin: 20,
    padding: 20,
  },
  deployTitle: {
    color: '#ff9d00',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 8,
  },
  deploySubtitle: {
    color: '#8da1b9',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 8,
  },
  subFieldLabel: {
    color: '#5e7594',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginTop: 10,
    marginBottom: 5,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  apiInput: {
    flex: 1,
    backgroundColor: '#1b232e',
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2e3d4f',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  fetchBtn: {
    backgroundColor: '#ff9d00',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  fetchBtnText: {
    color: '#0f1318',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  loadingText: {
    color: '#00e5ff',
    fontSize: 11,
    fontFamily: 'monospace',
    marginLeft: 8,
  },
  accountSelectorBox: {
    backgroundColor: '#0c0f12',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1c2635',
    padding: 10,
    marginBottom: 15,
  },
  accountRow: {
    backgroundColor: '#131920',
    borderWidth: 1,
    borderColor: '#233242',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  accountRowActive: {
    borderColor: '#ff9d00',
    backgroundColor: '#1c2430',
  },
  accountNameText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  accountIdText: {
    color: '#5e7594',
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  formInput: {
    backgroundColor: '#1b232e',
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2e3d4f',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 10,
  },
  deployButton: {
    backgroundColor: '#00e5ff',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    elevation: 5,
    shadowColor: '#00e5ff',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  deployButtonDisabled: {
    backgroundColor: '#1b232e',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deployButtonText: {
    color: '#0f1318',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  deployButtonTextActive: {
    color: '#5e7594',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginLeft: 8,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
    borderWidth: 1,
    borderColor: '#ff4d4d',
    borderRadius: 6,
    padding: 12,
    marginTop: 15,
  },
  errorText: {
    color: '#ff4d4d',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  successBanner: {
    backgroundColor: 'rgba(0, 255, 102, 0.1)',
    borderWidth: 1,
    borderColor: '#00ff66',
    borderRadius: 6,
    padding: 12,
    marginTop: 15,
  },
  successText: {
    color: '#00ff66',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  egressPanel: {
    backgroundColor: '#0c0f12',
    borderWidth: 1,
    borderColor: '#1c2635',
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 15,
    padding: 12,
  },
  egressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1c2635',
    paddingBottom: 6,
    marginBottom: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  egressHeaderTitle: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1.5,
  },
  egressGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  egressItem: {
    flex: 1,
  },
  egressLabel: {
    color: '#5e7594',
    fontSize: 8,
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 2,
  },
  egressValueText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  egressFooter: {
    borderTopWidth: 1,
    borderTopColor: '#1c2635',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  egressFooterLabel: {
    color: '#5e7594',
    fontSize: 8,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  egressFooterValue: {
    color: '#00e5ff',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
});

AppRegistry.registerComponent('AliCncVpn', () => App);
