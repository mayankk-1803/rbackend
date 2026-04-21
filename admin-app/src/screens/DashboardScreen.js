import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';
import useSocketUpdates from '../hooks/useSocketUpdates';
import StatCard from '../components/StatCard';

const DashboardScreen = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetchStats();
  }, []);

  useSocketUpdates({
    recharge_success: (data) => {
      addLog('Success: ' + data.mobile);
      fetchStats();
    },
    recharge_failed: (data) => {
      addLog(' Failed: ' + data.mobile);
      fetchStats();
    },
    fraud_alert: (data) => addLog(' FRAUD: ' + data.message),
    provider_status: (data) => addLog('Provider: ' + data.provider + ' (' + data.status + ')'),
  });

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/dashboard');
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 10));
  };

  if (loading && !stats) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6D5DF6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <LinearGradient colors={['#6D5DF6', '#A66CFF']} style={styles.header}>
          <Text style={styles.headerTitle}>System Dashboard</Text>
          <Text style={styles.headerSubtitle}>Real-time Network Status</Text>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <StatCard title="Total Transactions" value={stats?.totalTransactions ?? '0'} color="#333" />
          <StatCard title="Success Rate" value={(stats?.successRate ?? '0') + '%'} color="#28a745" />
          <StatCard title="Pending Ops" value={stats?.pendingCount ?? '0'} color="#fd7e14" />
          <StatCard title="Failure Count" value={stats?.failureCount ?? '0'} color="#dc3545" />
          <StatCard title="Fraud Alerts" value={stats?.fraudAlerts ?? '0'} color="#ffc107" />
          <StatCard title="Users" value={stats?.totalUsers ?? '0'} color="#333" />
        </View>

        {/* Logs */}
        <View style={styles.logsSection}>
          <Text style={styles.logsSectionTitle}>Live Activity Feed</Text>
          <View style={styles.logsContainer}>
            {logs.length === 0 ? (
              <Text style={styles.emptyLogs}>Waiting for events...</Text>
            ) : (
              logs.map((log, index) => (
                <Text key={index} style={styles.logText}>{log}</Text>
              ))
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6FA'
  },

  header: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold'
  },

  headerSubtitle: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.8,
    marginTop: 4
  },

  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginTop: 16, //  proper gap from header
    justifyContent: 'space-between', // better spacing between cards
  },

  logsSection: {
    padding: 20
  },

  logsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12
  },

  logsContainer: {
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 16,
    minHeight: 150
  },

  logText: {
    color: '#4ade80',
    fontFamily: 'monospace',
    fontSize: 13,
    marginBottom: 8
  },

  emptyLogs: {
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20
  },
});

export default DashboardScreen;