import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  ScrollView,
  Switch,
} from 'react-native';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [alarms, setAlarms] = useState([]);
  const [currentStats, setCurrentStats] = useState({
    totalSeconds: 0,
    hours: 0,
    minutes: 0,
    text: '',
  });

  const toggleAlarm = (id) => {
    setAlarms(prevAlarms => prevAlarms.map(alarm => 
      alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm
    ));
  };

  const renderAlarmItem = (alarm) => {
    return (
      <View key={alarm.id} style={styles.alarmItem}>
        <View style={styles.alarmHeader}>
          <Text style={styles.alarmName}>{alarm.name}</Text>
          <Switch
            value={alarm.enabled}
            onValueChange={() => toggleAlarm(alarm.id)}
            trackColor={{ false: '#767577', true: '#4CAF50' }}
            thumbColor={alarm.enabled ? '#fff' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.alarmDetails}>
          <Text style={styles.alarmTime}>
            {alarm.hours}h {alarm.minutes}m
          </Text>
          
          <View style={styles.alarmStatus}>
            <Text style={styles.statusPending}>Pending</Text>
          </View>
        </View>
      </View>
    );
  };

  const addAlarm = () => {
    const newAlarm = {
      id: Date.now().toString(),
      name: 'Daily Goal',
      hours: '8',
      minutes: '0',
      enabled: true,
      hasTriggered: false,
      lastTriggeredDate: null,
      type: 'manual',
    };

    setAlarms(prevAlarms => [...prevAlarms, newAlarm]);
  };

  useEffect(() => {
    // Setup will be added later
  }, []);

  const fetchCodingStats = async () => {
    if (!apiKey) return;

    try {
      const response = await fetch('https://hackatime.hackclub.com/api/hackatime/v1/users/current/statusbar/today', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const totalSeconds = data.data.grand_total.total_seconds;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      
      setCurrentStats({
        totalSeconds,
        hours,
        minutes,
        text: data.data.grand_total.text,
      });
    } catch (error) {
      console.error('Error fetching coding stats:', error);
      Alert.alert('Error', 'Failed to fetch coding stats. Please check your API key.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Hackatime Monitor</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Hackatime API</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your API key"
            placeholderTextColor="#666"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Alarms ({alarms.length})</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={addAlarm}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          
          {alarms.length === 0 ? (
            <Text style={styles.noAlarmsText}>No alarms configured</Text>
          ) : (
            alarms.map(renderAlarmItem)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Stats</Text>
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              {currentStats.hours}h {currentStats.minutes}m
            </Text>
            <Text style={styles.statsSubtext}>
              {currentStats.text || 'No data available'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={fetchCodingStats}
        >
          <Text style={styles.buttonText}>Fetch Stats</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17171d',
  },
  scrollContainer: {
    padding: 16,
    paddingTop: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f9fafc',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: -0.009,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafc',
    lineHeight: 22.5,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#252429',
    color: '#f9fafc',
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3c4858',
    marginBottom: 8,
  },
  statsContainer: {
    backgroundColor: '#252429',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3c4858',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.125,
    shadowRadius: 8,
    elevation: 2,
  },
  statsText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#33d6a6',
    marginBottom: 4,
  },
  statsSubtext: {
    fontSize: 14,
    color: '#8492a6',
    lineHeight: 19.25,
  },
  button: {
    backgroundColor: '#33d6a6',
    padding: 16,
    borderRadius: 99999,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.125,
    shadowRadius: 8,
    elevation: 4,
    marginVertical: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.009,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#33d6a6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.125,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.009,
  },
  alarmItem: {
    backgroundColor: '#252429',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3c4858',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.125,
    shadowRadius: 8,
    elevation: 2,
  },
  alarmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alarmName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafc',
  },
  alarmDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alarmTime: {
    fontSize: 14,
    color: '#8492a6',
    lineHeight: 19.25,
  },
  alarmStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPending: {
    color: '#f1c40f',
    fontSize: 12,
    fontWeight: '700',
  },
  noAlarmsText: {
    color: '#8492a6',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
    lineHeight: 19.25,
  },
});