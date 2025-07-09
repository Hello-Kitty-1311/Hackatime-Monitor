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
  FlatList,
} from 'react-native';
import { Audio } from 'expo-av';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKGROUND_FETCH_TASK = 'background-fetch-coding-stats';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const getTodayDateString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const apiKey = await AsyncStorage.getItem('apiKey');
    const alarmsData = await AsyncStorage.getItem('alarms');
    
    if (!apiKey || !alarmsData) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const alarms = JSON.parse(alarmsData);
    const today = getTodayDateString();

    const response = await fetch('https://hackatime.hackclub.com/api/hackatime/v1/users/current/statusbar/today', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const data = await response.json();
    const totalSeconds = data.data.grand_total.total_seconds;
    const currentHours = Math.floor(totalSeconds / 3600);
    const currentMinutes = Math.floor((totalSeconds % 3600) / 60);
    
    let hasTriggeredAlarm = false;
    
    for (let i = 0; i < alarms.length; i++) {
      const alarm = alarms[i];
      
      if (!alarm.enabled) continue;
      
      if (alarm.lastTriggeredDate !== today) {
        alarm.hasTriggered = false;
        alarm.lastTriggeredDate = null;
      }
      
      if (alarm.hasTriggered && alarm.lastTriggeredDate === today) continue;
      
      const targetHours = parseInt(alarm.hours);
      const targetMinutes = parseInt(alarm.minutes);
      
      if (currentHours > targetHours || 
          (currentHours === targetHours && currentMinutes >= targetMinutes)) {
        
        alarm.hasTriggered = true;
        alarm.lastTriggeredDate = today;
        hasTriggeredAlarm = true;
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Time to Commit and post Devlogs! (${alarm.name})`,
            body: `You've been coding for ${currentHours}h ${currentMinutes}m. Target: ${targetHours}h ${targetMinutes}m`,
            sound: true,
          },
          trigger: null,
        });
      }
    }
    
    if (hasTriggeredAlarm) {
      await AsyncStorage.setItem('alarms', JSON.stringify(alarms));
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background fetch error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

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
  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [newAlarmName, setNewAlarmName] = useState('');
  const [newAlarmHours, setNewAlarmHours] = useState('');
  const [newAlarmMinutes, setNewAlarmMinutes] = useState('');
  const [intervalHours, setIntervalHours] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState('');
  const [commitCount, setCommitCount] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    setupNotifications();
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

  const setupNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please enable notifications for alarms to work properly.');
    }
  };

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

  const createIntervalAlarms = () => {
    if (!intervalHours || !intervalMinutes || !commitCount) {
      Alert.alert('Missing Information', 'Please provide interval time and commit count.');
      return;
    }

    const intervalH = parseInt(intervalHours);
    const intervalM = parseInt(intervalMinutes);
    const commits = parseInt(commitCount);

    if (intervalH < 0 || intervalH > 23 || intervalM < 0 || intervalM > 59) {
      Alert.alert('Invalid Time', 'Please enter valid interval hours (0-23) and minutes (0-59).');
      return;
    }

    if (commits < 1 || commits > 50) {
      Alert.alert('Invalid Commit Count', 'Please enter a commit count between 1 and 50.');
      return;
    }

    const nonIntervalAlarms = alarms.filter(alarm => alarm.type !== 'interval');

    const newIntervalAlarms = [];
    for (let i = 1; i <= commits; i++) {
      const totalMinutes = (intervalH * 60 + intervalM) * i;
      const alarmHours = Math.floor(totalMinutes / 60);
      const alarmMinutes = totalMinutes % 60;

      if (alarmHours > 23) {
        Alert.alert('Time Limit Exceeded', `Commit ${i} would exceed 24 hours. Please reduce interval time or commit count.`);
        return;
      }

      newIntervalAlarms.push({
        id: `interval_${i}_${Date.now()}`,
        name: `Commit ${i}`,
        hours: alarmHours.toString(),
        minutes: alarmMinutes.toString(),
        enabled: true,
        hasTriggered: false,
        lastTriggeredDate: null,
        type: 'interval',
      });
    }

    setAlarms([...nonIntervalAlarms, ...newIntervalAlarms]);
    setIntervalHours('');
    setIntervalMinutes('');
    setCommitCount('');
    setShowIntervalModal(false);

    Alert.alert('Success', `Created ${commits} interval alarms successfully!`);
  };

  const clearIntervalAlarms = () => {
    Alert.alert(
      'Clear Interval Alarms',
      'Are you sure you want to clear all interval alarms?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            const nonIntervalAlarms = alarms.filter(alarm => alarm.type !== 'interval');
            setAlarms(nonIntervalAlarms);
          }
        }
      ]
    );
  };

  const toggleAlarm = (id) => {
    setAlarms(prevAlarms => prevAlarms.map(alarm => 
      alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm
    ));
  };

  const deleteAlarm = (id) => {
    Alert.alert(
      'Delete Alarm',
      'Are you sure you want to delete this alarm?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => setAlarms(prevAlarms => prevAlarms.filter(alarm => alarm.id !== id))
        }
      ]
    );
  };

  const resetAlarm = (id) => {
    setAlarms(prevAlarms => prevAlarms.map(alarm => 
      alarm.id === id ? { 
        ...alarm, 
        hasTriggered: false, 
        lastTriggeredDate: null 
      } : alarm
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

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time to Commit and post Devlogs! (${alarm.name})`,
          body: `You've been coding for ${currentHours}h ${currentMinutes}m. Target: ${alarm.hours}h ${alarm.minutes}m`,
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error triggering alarm:', error);
    }
  };

  const startMonitoring = async () => {
    if (!apiKey || alarms.length === 0) {
      Alert.alert('Missing Information', 'Please provide API key and at least one alarm.');
      return;
    }

    setIsMonitoring(true);

    intervalRef.current = setInterval(fetchCodingStats, 30000);

    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 30,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (error) {
      console.error('Error registering background task:', error);
    }

    fetchCodingStats();
  };

  const stopMonitoring = async () => {
    setIsMonitoring(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    } catch (error) {
      console.error('Error unregistering background task:', error);
    }

    if (sound) {
      sound.stopAsync();
      sound.unloadAsync();
    }
  };

  const getEnabledAlarms = () => alarms.filter(alarm => alarm.enabled);

  const testSpecificAlarm = (alarm) => {
    setShowTestModal(false);
    triggerAlarm(alarm, currentStats.hours, currentStats.minutes);
  };

  const renderAlarmItem = (alarm) => {
    const today = getTodayDateString();
    const isTriggeredToday = alarm.hasTriggered && alarm.lastTriggeredDate === today;
    
    return (
      <View key={alarm.id} style={[
        styles.alarmItem,
        alarm.type === 'interval' && styles.intervalAlarmItem
      ]}>
        <View style={styles.alarmHeader}>
          <View style={styles.alarmTitleContainer}>
            <Text style={styles.alarmName}>{alarm.name}</Text>
            {alarm.type === 'interval' && (
              <Text style={styles.intervalBadge}>Interval</Text>
            )}
          </View>
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
        
        <View style={styles.alarmActions}>
          {isTriggeredToday && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => resetAlarm(alarm.id)}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteAlarm(alarm.id)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTestAlarmItem = ({ item }) => (
    <TouchableOpacity
      style={styles.testAlarmItem}
      onPress={() => testSpecificAlarm(item)}
    >
      <Text style={styles.testAlarmName}>{item.name}</Text>
      <Text style={styles.testAlarmTime}>{item.hours}h {item.minutes}m</Text>
    </TouchableOpacity>
  );

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
            <View style={styles.alarmButtons}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddAlarmModal(true)}
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.intervalButton}
                onPress={() => setShowIntervalModal(true)}
              >
                <Text style={styles.intervalButtonText}>⏱ Interval</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {alarms.filter(alarm => alarm.type === 'interval').length > 0 && (
            <TouchableOpacity
              style={styles.clearIntervalButton}
              onPress={clearIntervalAlarms}
            >
              <Text style={styles.clearIntervalButtonText}>Clear All Interval Alarms</Text>
            </TouchableOpacity>
          )}
          
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

          <TouchableOpacity
            style={styles.testButton}
            onPress={() => {
              const enabledAlarms = getEnabledAlarms();
              if (enabledAlarms.length === 0) {
                Alert.alert('No Active Alarms', 'Please enable at least one alarm to test.');
                return;
              }
              setShowTestModal(true);
            }}
          >
            <Text style={styles.buttonText}>Test Alarm</Text>
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

      <Modal
        visible={showIntervalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowIntervalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Interval Clock</Text>
            <Text style={styles.modalSubtitle}>
              Create multiple alarms based on intervals
            </Text>
            
            <Text style={styles.inputLabel}>Interval Time</Text>
            <View style={styles.timeInputContainer}>
              <TextInput
                style={styles.timeInput}
                placeholder="Hours"
                placeholderTextColor="#666"
                value={intervalHours}
                onChangeText={setIntervalHours}
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={styles.timeLabel}>:</Text>
              <TextInput
                style={styles.timeInput}
                placeholder="Minutes"
                placeholderTextColor="#666"
                value={intervalMinutes}
                onChangeText={setIntervalMinutes}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
            
            <Text style={styles.inputLabel}>Number of Commits</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 10"
              placeholderTextColor="#666"
              value={commitCount}
              onChangeText={setCommitCount}
              keyboardType="numeric"
              maxLength={2}
            />
            
            {intervalHours && intervalMinutes && commitCount && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewTitle}>Preview:</Text>
                <Text style={styles.previewText}>
                  Commit 1: {intervalHours}h {intervalMinutes}m
                </Text>
                <Text style={styles.previewText}>
                  Commit 2: {Math.floor(((parseInt(intervalHours) * 60 + parseInt(intervalMinutes)) * 2) / 60)}h {((parseInt(intervalHours) * 60 + parseInt(intervalMinutes)) * 2) % 60}m
                </Text>
                <Text style={styles.previewText}>...</Text>
                <Text style={styles.previewText}>
                  Commit {commitCount}: {Math.floor(((parseInt(intervalHours) * 60 + parseInt(intervalMinutes)) * parseInt(commitCount)) / 60)}h {((parseInt(intervalHours) * 60 + parseInt(intervalMinutes)) * parseInt(commitCount)) % 60}m
                </Text>
              </View>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowIntervalModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={createIntervalAlarms}
              >
                <Text style={styles.saveButtonText}>Create Alarms</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTestModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Test Alarm</Text>
            <Text style={styles.modalSubtitle}>
              Choose which alarm to test
            </Text>
            
            <FlatList
              data={getEnabledAlarms()}
              renderItem={renderTestAlarmItem}
              keyExtractor={(item) => item.id}
              style={styles.testAlarmList}
              showsVerticalScrollIndicator={false}
            />
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowTestModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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
  alarmButtons: {
    flexDirection: 'row',
    gap: 8,
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
  intervalButton: {
    backgroundColor: '#338eda',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.125,
    shadowRadius: 8,
    elevation: 4,
  },
  intervalButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.009,
  },
  clearIntervalButton: {
    backgroundColor: '#ec3750',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99999,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.125,
    shadowRadius: 8,
    elevation: 4,
  },
  clearIntervalButtonText: {
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
  intervalAlarmItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#338eda',
  },
  alarmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alarmTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alarmName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafc',
    marginRight: 8,
  },
  intervalBadge: {
    backgroundColor: '#338eda',
    color: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99999,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  alarmDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  alarmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  resetButton: {
    backgroundColor: '#f1c40f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99999,
  },
  resetButtonText: {
    color: '#1f2d3d',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#ec3750',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99999,
  },
  deleteButtonText: {
    color: '#ffffff',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.125,
    shadowRadius: 8,
    elevation: 4,
  },
  startButton: {
    backgroundColor: '#33d6a6',
  },
  stopButton: {
    backgroundColor: '#ec3750',
  },
  testButton: {
    backgroundColor: '#a633d6',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 99999,
    alignItems: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.125,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.009,
  },
  statusContainer: {
    backgroundColor: '#252429',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#33d6a6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.125,
    shadowRadius: 8,
    elevation: 2,
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
    lineHeight: 19.25,
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
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.125,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafc',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22.5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8492a6',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 19.25,
  },
  inputLabel: {
    fontSize: 16,
    color: '#f9fafc',
    marginBottom: 4,
    fontWeight: '700',
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
  previewContainer: {
    backgroundColor: '#17171d',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3c4858',
  },
  previewTitle: {
    fontSize: 14,
    color: '#33d6a6',
    fontWeight: '700',
    marginBottom: 8,
  },
  previewText: {
    fontSize: 12,
    color: '#8492a6',
    marginBottom: 2,
    lineHeight: 16.5,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.125,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.009,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#33d6a6',
    padding: 16,
    borderRadius: 99999,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.125,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.009,
  },
 
  testAlarmList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  testAlarmItem: {
    backgroundColor: '#17171d',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3c4858',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  testAlarmName: {
    fontSize: 16,
    color: '#f9fafc',
    fontWeight: '700',
    flex: 1,
  },
  testAlarmTime: {
    fontSize: 14,
    color: '#33d6a6',
    fontWeight: '700',
  },
});