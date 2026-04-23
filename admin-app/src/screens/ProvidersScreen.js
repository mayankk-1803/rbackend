import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../services/api";

const ProvidersScreen = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProviders = async () => {
    try {
      const res = await api.get("/admin/providers");
      setProviders(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProviders();
  };

  const renderItem = ({ item }) => {
    const status = item.status?.toLowerCase();
    let dotColor = "#dc3545";
    if (status === "healthy") dotColor = "#28a745";
    if (status === "warning") dotColor = "#ffc107";

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={styles.status}>{status?.toUpperCase() || 'UNKNOWN'}</Text>
          </View>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Success Rate</Text>
          <Text style={styles.metricValue}>{item.successRate}%</Text>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#17a2b8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Provider Infrastructure</Text>
      </View>
      <FlatList
        data={providers}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F6FA",
  },
  titleContainer: {
    padding: 20,
    backgroundColor: "#17a2b8",
    paddingBottom: 15,
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  list: { padding: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "center",
  },
  name: { fontSize: 18, fontWeight: "bold", textTransform: "capitalize" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  status: { fontSize: 12, fontWeight: "bold", color: "#555" },
  metricRow: { flexDirection: "row", justifyContent: "space-between" },
  metricLabel: { color: "#666", fontSize: 14 },
  metricValue: { fontSize: 16, fontWeight: "bold" },
});

export default ProvidersScreen;
