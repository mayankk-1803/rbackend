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

const AlertsScreen = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = async () => {
    try {
      const res = await api.get("/admin/alerts");
      setAlerts(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  const renderItem = ({ item }) => {
    let severityColor = "#555";
    if (item.severity === "HIGH") severityColor = "#dc3545";
    if (item.severity === "MEDIUM") severityColor = "#fd7e14";

    return (
      <View
        style={[
          styles.card,
          { borderLeftColor: severityColor, borderLeftWidth: 5 },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.type, { color: severityColor }]}>
            {item.type}
          </Text>
          <Text style={styles.severity}>{item.severity}</Text>
        </View>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.date}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#dc3545" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>System Alerts</Text>
      </View>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item._id.toString()}
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
    backgroundColor: "#dc3545",
    paddingBottom: 15,
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  list: { padding: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
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
    marginBottom: 8,
  },
  type: { fontSize: 15, fontWeight: "bold" },
  severity: { fontSize: 13, fontWeight: "bold", color: "#888" },
  message: { fontSize: 14, color: "#444", marginBottom: 8 },
  date: { color: "#aaa", fontSize: 11 },
});

export default AlertsScreen;
