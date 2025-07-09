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
} from 'react-native';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [currentStats, setCurrentStats] = useState({
    totalSeconds: 0,
    hours: 0,
    minutes: 0,
    text: '',
  });

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
});