import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import exitNodes from '../config/exitNodes.json';

export interface VpnServer {
  id: string;
  name: string;
  countryCode: string;
  flag: string;
  address: string;
  port: number;
  uuid: string;
  host: string;
  path: string;
  baseLatencyMs: number;
  isCustom?: boolean;
}

interface CountryPickerProps {
  selectedServer: VpnServer;
  onSelectServer: (server: VpnServer) => void;
  customServers: VpnServer[];
  onAddCustomServer: (server: VpnServer) => void;
}

export const CountryPicker: React.FC<CountryPickerProps> = ({
  selectedServer,
  onSelectServer,
  customServers,
  onAddCustomServer,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states for manual private node registration
  const [customName, setCustomName] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [customPort, setCustomPort] = useState('443');
  const [customUuid, setCustomUuid] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [customPath, setCustomPath] = useState('/?ed=2048');

  // Merge default nodes from JSON and any user added custom nodes
  const allServers: VpnServer[] = [...exitNodes, ...customServers];

  const filteredServers = allServers.filter((server) =>
    server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    server.countryCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateCustomNode = () => {
    if (!customName || !customAddress || !customUuid) {
      alert('Please fill out Name, Server Address, and UUID');
      return;
    }

    const newNode: VpnServer = {
      id: `custom-${Date.now()}`,
      name: customName,
      countryCode: 'CF',
      flag: '🛠️',
      address: customAddress,
      port: parseInt(customPort) || 443,
      uuid: customUuid,
      host: customHost || customAddress,
      path: customPath || '/',
      baseLatencyMs: 65,
      isCustom: true,
    };

    onAddCustomServer(newNode);
    onSelectServer(newNode);
    setCustomModalVisible(false);
    setModalVisible(false);

    // Reset inputs
    setCustomName('');
    setCustomAddress('');
    setCustomPort('443');
    setCustomUuid('');
    setCustomHost('');
    setCustomPath('/?ed=2048');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>SECURE ROUTING EXIT NODE</Text>
      
      {/* Selected Node Bar */}
      <TouchableOpacity 
        style={styles.selectedBar}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.flagText}>{selectedServer.flag}</Text>
        <View style={styles.detailsContainer}>
          <Text style={styles.nodeName}>{selectedServer.name}</Text>
          <Text style={styles.nodeAddress}>{selectedServer.address}</Text>
        </View>
        <View style={styles.latencyContainer}>
          <View style={styles.indicatorDot} />
          <Text style={styles.latencyText}>{selectedServer.baseLatencyMs} ms</Text>
        </View>
      </TouchableOpacity>

      {/* Primary Server Selector Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>SELECT CLOUDFLARE NODE</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>CLOSE</Text>
              </TouchableOpacity>
            </View>

            {/* Search inputs */}
            <TextInput
              style={styles.searchInput}
              placeholder="Search nodes by country..."
              placeholderTextColor="#5e7594"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {/* Servers scroll box */}
            <ScrollView style={styles.nodesList}>
              {filteredServers.map((server) => (
                <TouchableOpacity
                  key={server.id}
                  style={[
                    styles.nodeRow,
                    selectedServer.id === server.id && styles.nodeRowSelected
                  ]}
                  onPress={() => {
                    onSelectServer(server);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.rowFlag}>{server.flag}</Text>
                  <View style={styles.rowDetails}>
                    <Text style={styles.rowName}>{server.name}</Text>
                    <Text style={styles.rowAddress}>
                      {server.isCustom ? 'Private Worker' : 'Cloudflare Anycast'} • {server.address}
                    </Text>
                  </View>
                  <Text style={styles.rowLatency}>{server.baseLatencyMs}ms</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Custom Node Addition Trigger */}
            <TouchableOpacity 
              style={styles.addCustomButton}
              onPress={() => setCustomModalVisible(true)}
            >
              <Text style={styles.addCustomButtonText}>+ ADD PRIVATE NODE (MANUAL)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manual private node addition secondary modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={customModalVisible}
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.customFormContainer}>
            <Text style={styles.formTitle}>REGISTER PRIVATE VLESS WORKER</Text>
            
            <ScrollView>
              <Text style={styles.inputLabel}>Node Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. My Private US Worker"
                placeholderTextColor="#5e7594"
                value={customName}
                onChangeText={setCustomName}
              />

              <Text style={styles.inputLabel}>Server Domain / Worker Address *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. private-node.yoursub.workers.dev"
                placeholderTextColor="#5e7594"
                autoCapitalize="none"
                value={customAddress}
                onChangeText={setCustomAddress}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.inputLabel}>Port *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="443"
                    keyboardType="numeric"
                    placeholderTextColor="#5e7594"
                    value={customPort}
                    onChangeText={setCustomPort}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.inputLabel}>WebSocket Path</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="/?ed=2048"
                    autoCapitalize="none"
                    placeholderTextColor="#5e7594"
                    value={customPath}
                    onChangeText={setCustomPath}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>VLESS UUID *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="d34db33f-c0de-4444-a111-c0ffeec0ffee"
                autoCapitalize="none"
                placeholderTextColor="#5e7594"
                value={customUuid}
                onChangeText={setCustomUuid}
              />

              <Text style={styles.inputLabel}>SNI / Host Header (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Leave blank to use Worker address"
                autoCapitalize="none"
                placeholderTextColor="#5e7594"
                value={customHost}
                onChangeText={setCustomHost}
              />
            </ScrollView>

            <View style={styles.formActions}>
              <TouchableOpacity 
                style={styles.formCancel} 
                onPress={() => setCustomModalVisible(false)}
              >
                <Text style={styles.formCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.formSubmit} 
                onPress={handleCreateCustomNode}
              >
                <Text style={styles.formSubmitText}>SAVE NODE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 10,
  },
  sectionHeader: {
    color: '#5e7594',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 8,
  },
  selectedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b232e',
    borderWidth: 1,
    borderColor: '#2e3d4f',
    borderRadius: 8,
    padding: 14,
  },
  flagText: {
    fontSize: 26,
    marginRight: 15,
  },
  detailsContainer: {
    flex: 1,
  },
  nodeName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  nodeAddress: {
    color: '#5e7594',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  latencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121820',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#233242',
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00ff66',
    marginRight: 6,
  },
  latencyText: {
    color: '#00ff66',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#131920',
    borderWidth: 2,
    borderColor: '#2e3d4f',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    color: '#00e5ff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  closeButton: {
    color: '#ff4d4d',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  searchInput: {
    backgroundColor: '#1b232e',
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2e3d4f',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'monospace',
    fontSize: 13,
    marginBottom: 15,
  },
  nodesList: {
    flexGrow: 0,
    marginBottom: 15,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1b232e',
  },
  nodeRowSelected: {
    backgroundColor: '#1c2635',
    borderRadius: 6,
  },
  rowFlag: {
    fontSize: 22,
    marginRight: 12,
  },
  rowDetails: {
    flex: 1,
  },
  rowName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  rowAddress: {
    color: '#5e7594',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  rowLatency: {
    color: '#00ff66',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  addCustomButton: {
    backgroundColor: '#233242',
    borderWidth: 1,
    borderColor: '#00e5ff',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addCustomButtonText: {
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  customFormContainer: {
    width: '100%',
    backgroundColor: '#131920',
    borderWidth: 2,
    borderColor: '#2e3d4f',
    borderRadius: 12,
    padding: 20,
  },
  formTitle: {
    color: '#ff9d00',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 15,
  },
  inputLabel: {
    color: '#5e7594',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 5,
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
    fontSize: 13,
  },
  formRow: {
    flexDirection: 'row',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  formCancel: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
  },
  formCancelText: {
    color: '#ff4d4d',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
  },
  formSubmit: {
    backgroundColor: '#ff9d00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  formSubmitText: {
    color: '#0f1318',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
