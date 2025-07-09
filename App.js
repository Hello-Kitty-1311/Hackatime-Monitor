import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getTodayDateString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [alarms, setAlarms] = useState([]);
  const [currentStats, setCurrentStats] = useState({
    totalSeconds: 0,
    hours: 0,
    minutes: 0,
    text: '',
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [sound, setSound] = useState(null);
  const [showAddAlarmModal, setShowAddAlarmModal] = useState(false);
  const [newAlarmName, setNewAlarmName] = useState('');
  const [newAlarmHours, setNewAlarmHours] = useState('');
  const [newAlarmMinutes, setNewAlarmMinutes] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    loadStoredData();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    saveData();
  }, [alarms, apiKey]);

  const loadStoredData = async () => {
    try {
      const storedApiKey = await AsyncStorage.getItem('apiKey');
      const storedAlarms = await AsyncStorage.getItem('alarms');
      
      if (storedApiKey) setApiKey(storedApiKey);
      if (storedAlarms) {
        const parsedAlarms = JSON.parse(storedAlarms);
        const today = getTodayDateString();
        const updatedAlarms = parsedAlarms.map(alarm => {
          if (alarm.lastTriggeredDate !== today) {
            return {
              ...alarm,
              hasTriggered: false,
              lastTriggeredDate: null
            };
          }
          return alarm;
        });
        setAlarms(updatedAlarms);
      }
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem('apiKey', apiKey);
      await AsyncStorage.setItem('alarms', JSON.stringify(alarms));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const toggleAlarm = (id) => {
    setAlarms(prevAlarms => prevAlarms.map(alarm => 
      alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm
    ));
  };

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

      const today = getTodayDateString();
      let shouldSaveAlarms = false;

      setAlarms(prevAlarms => {
        const updatedAlarms = prevAlarms.map(alarm => {
          const updatedAlarm = { ...alarm };
          
          if (!updatedAlarm.enabled) return updatedAlarm;
          
          if (updatedAlarm.lastTriggeredDate !== today) {
            updatedAlarm.hasTriggered = false;
            updatedAlarm.lastTriggeredDate = null;
            shouldSaveAlarms = true;
          }
          
          if (updatedAlarm.hasTriggered && updatedAlarm.lastTriggeredDate === today) return updatedAlarm;
          
          const targetHours = parseInt(updatedAlarm.hours);
          const targetMinutes = parseInt(updatedAlarm.minutes);
          
          if (hours > targetHours || (hours === targetHours && minutes >= targetMinutes)) {
            updatedAlarm.hasTriggered = true;
            updatedAlarm.lastTriggeredDate = today;
            shouldSaveAlarms = true;
            triggerAlarm(updatedAlarm, hours, minutes);
          }
          
          return updatedAlarm;
        });
        
        return updatedAlarms;
      });

    } catch (error) {
      console.error('Error fetching coding stats:', error);
      Alert.alert('Error', 'Failed to fetch coding stats. Please check your API key.');
    }
  };

  const triggerAlarm = async (alarm, currentHours, currentMinutes) => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://hc-cdn.hel1.your-objectstorage.com/s/v3/8658554c42e9b46627607b8a5b3d50c71e39aa12_homecoming_-_samsung_audio.mp4' },
        { shouldPlay: true, isLooping: true }
      );
      setSound(sound);
      
      Alert.alert(
        `Time to Commit and post Devlogs! (${alarm.name})`,
        `You've been coding for ${currentHours}h ${currentMinutes}m. Target: ${alarm.hours}h ${alarm.minutes}m`,
        [
          {
            text: 'Stop Alarm',
            onPress: () => {
              if (sound) {
                sound.stopAsync();
                sound.unloadAsync();
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error triggering alarm:', error);
    }
  };

  const startMonitoring = () => {
    if (!apiKey || alarms.length === 0) {
      Alert.alert('Missing Information', 'Please provide API key and at least one alarm.');
      return;
    }

    setIsMonitoring(true);
    intervalRef.current = setInterval(fetchCodingStats, 30000);
    fetchCodingStats();
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (sound) {
      sound.stopAsync();
      sound.unloadAsync();
    }
  };

  const renderAlarmItem = (alarm) => {
    const today = getTodayDateString();
    const isTriggeredToday = alarm.hasTriggered && alarm.lastTriggeredDate === today;
    
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
            {isTriggeredToday ? (
              <Text style={styles.statusTriggered}>✓ Triggered today</Text>
            ) : (
              <Text style={styles.statusPending}>Pending</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const addAlarm = () => {
    if (!newAlarmName.trim() || !newAlarmHours || !newAlarmMinutes) {
      Alert.alert('Missing Information', 'Please provide alarm name, hours, and minutes.');
      return;
    }

    const hours = parseInt(newAlarmHours);
    const minutes = parseInt(newAlarmMinutes);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      Alert.alert('Invalid Time', 'Please enter valid hours (0-23) and minutes (0-59).');
      return;
    }

    const newAlarm = {
      id: Date.now().toString(),
      name: newAlarmName.trim(),
      hours: newAlarmHours,
      minutes: newAlarmMinutes,
      enabled: true,
      hasTriggered: false,
      lastTriggeredDate: null,
      type: 'manual',
    };

    setAlarms(prevAlarms => [...prevAlarms, newAlarm]);
    setNewAlarmName('');
    setNewAlarmHours('');
    setNewAlarmMinutes('');
    setShowAddAlarmModal(false);
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
              onPress={() => setShowAddAlarmModal(true)}
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

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, isMonitoring ? styles.stopButton : styles.startButton]}
            onPress={isMonitoring ? stopMonitoring : startMonitoring}
          >
            <Text style={styles.buttonText}>
              {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
            </Text>
          </TouchableOpacity>
        </View>

        {isMonitoring && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>Monitoring Active</Text>
            <Text style={styles.statusSubtext}>
              {alarms.filter(a => a.enabled).length} alarms enabled
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showAddAlarmModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddAlarmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Alarm</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Alarm name (e.g., Daily Goal)"
              placeholderTextColor="#666"
              value={newAlarmName}
              onChangeText={setNewAlarmName}
            />
            
            <View style={styles.timeInputContainer}>
              <TextInput
                style={styles.timeInput}
                placeholder="Hours"
                placeholderTextColor="#666"
                value={newAlarmHours}
                onChangeText={setNewAlarmHours}
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={styles.timeLabel}>:</Text>
              <TextInput
                style={styles.timeInput}
                placeholder="Minutes"
                placeholderTextColor="#666"
                value={newAlarmMinutes}
                onChangeText={setNewAlarmMinutes}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddAlarmModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={addAlarm}
              >
                <Text style={styles.saveButtonText}>Add Alarm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafc',
    lineHeight: 22.5,
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
  addButton: {
    backgroundColor: '#33d6a6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99999,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  alarmItem: {
    backgroundColor: '#252429',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3c4858',
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
  },
  alarmStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTriggered: {
    color: '#33d6a6',
    fontSize: 12,
    fontWeight: '700',
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
  },
  statsContainer: {
    backgroundColor: '#252429',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3c4858',
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
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 16,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 99999,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#33d6a6',
  },
  stopButton: {
    backgroundColor: '#ec3750',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  statusContainer: {
    backgroundColor: '#252429',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#33d6a6',
  },
  statusText: {
    color: '#33d6a6',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusSubtext: {
    color: '#8492a6',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 23, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#252429',
    padding: 16,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  timeInput: {
    backgroundColor: '#17171d',
    color: '#f9fafc',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3c4858',
    width: 80,
    textAlign: 'center',
  },
  timeLabel: {
    color: '#f9fafc',
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#8492a6',
    padding: 16,
    borderRadius: 99999,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#33d6a6',
    padding: 16,
    borderRadius: 99999,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});