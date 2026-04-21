import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";

const TransactionsScreen = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

  const fetchTransactions = async () => {
    try {
      const res = await api.get("/admin/transactions");
      setTransactions(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const handleRetry = async (id) => {
    setRetryingId(id);
    try {
      await api.post(`/admin/retry/${id}`);
      Alert.alert(
        "Success",
        "Transaction placed back into pending queue with delayed trigger.",
      );
      fetchTransactions();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || err.message);
    } finally {
      setRetryingId(null);
    }
  };

  const renderItem = ({ item }) => {
    let statusColor = "#888";
    if (item.status === "success") statusColor = "#28a745";
    if (item.status === "failed") statusColor = "#dc3545";
    if (item.status === "pending") statusColor = "#fd7e14";

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.mobile}>{item.mobile}</Text>
          <Text style={styles.amount}>₹{item.amount}</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.operator}>
            {item.operator} • {item.provider}
          </Text>
          <Text style={[styles.status, { color: statusColor }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>

        {item.status === "pending" && (
          <Text style={styles.processingText}>⏳ Processing (1–2 min)</Text>
        )}

        <View style={styles.footer}>
          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
          {item.status === "failed" && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => handleRetry(item._id)}
              disabled={retryingId === item._id}
            >
              {retryingId === item._id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.retryBtnText}>Retry</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#6D5DF6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Recent Transactions</Text>
      </View>
      <FlatList
        data={transactions}
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
    backgroundColor: "#6D5DF6",
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
    marginBottom: 8,
  },
  mobile: { fontSize: 16, fontWeight: "bold" },
  amount: { fontSize: 16, fontWeight: "bold", color: "#333" },
  details: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  operator: { color: "#666", fontSize: 13 },
  status: { fontWeight: "bold", fontSize: 13 },
  processingText: {
    color: "#fd7e14",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  date: { color: "#aaa", fontSize: 11 },
  retryBtn: {
    backgroundColor: "#dc3545",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
});

export default TransactionsScreen;
