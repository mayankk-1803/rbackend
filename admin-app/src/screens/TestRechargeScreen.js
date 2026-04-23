import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Switch,
  Clipboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../services/api";
import useSocketUpdates from "../hooks/useSocketUpdates";

const TestRechargeScreen = ({ navigation }) => {
  const [testMobile, setTestMobile] = useState("");
  const [testAmount, setTestAmount] = useState("10");
  const [txType, setTxType] = useState("RECHARGE"); // RECHARGE or WALLET
  const [isTesting, setIsTesting] = useState(false);
  const [autoNavigate, setAutoNavigate] = useState(false);

  // Feedback & History States
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("all");

  const mobileInputRef = useRef(null);

  useSocketUpdates({
    recharge_success: (data) => {
      setFeedback((prev) => {
        if (
          prev &&
          prev.data &&
          (prev.data.mobile === data.mobile || prev.data.txnId === data.txnId)
        ) {
          return {
            ...prev,
            type: "success",
            data: { ...prev.data, status: "success" },
            message: "Real-time update: Success!",
          };
        }
        return prev;
      });
      setHistory((prev) =>
        prev.map((item) =>
          item.mobile === data.mobile && item.status?.toLowerCase() === "pending"
            ? { ...item, status: "success" }
            : item,
        ),
      );
    },
    recharge_failed: (data) => {
      setFeedback((prev) => {
        if (
          prev &&
          prev.data &&
          (prev.data.mobile === data.mobile || prev.data.txnId === data.txnId)
        ) {
          return {
            type: "error",
            data: { ...prev.data, status: "failed" },
            message: "Real-time update: Failed! " + (data.message || ""),
          };
        }
        return prev;
      });
      setHistory((prev) =>
        prev.map((item) =>
          item.mobile === data.mobile && item.status?.toLowerCase() === "pending"
            ? { ...item, status: "failed" }
            : item,
        ),
      );
    },
  });

  const isValidMobile = (mobile) => {
    if (!mobile) return false;
    const mobileStr = String(mobile).trim();
    if (!/^[6-9]\d{9}$/.test(mobileStr)) return false;
    if (/^(\d)\1{9}$/.test(mobileStr)) return false;
    return true;
  };

  const handleTextChange = (text) => {
    setTestMobile(text);
    if (feedback) setFeedback(null);
  };

  const executeTest = async () => {
    if (!isValidMobile(testMobile)) {
      setFeedback({ type: "error", message: "Enter valid mobile number" });
      return;
    }

    setIsTesting(true);
    setFeedback(null);
    const usedMobile = testMobile;
    try {
      const res = await api.post("/recharge", {
        mobile: usedMobile,
        amount: testAmount,
        operator: "Airtel",
        circle: "Delhi",
        type: txType,
      });

      const successMsg = res.data?.message || "Recharge triggered successfully";
      const txnData = res.data?.data || {
        txnId: `TXN${Math.floor(Math.random() * 1000000)}`,
        status: "pending",
        type: txType,
        mobile: usedMobile,
      };
      txnData.mobile = usedMobile; // Ensure we always have mobile to match with sockets

      setFeedback({
        type: "success",
        message: successMsg,
        data: txnData,
      });

      updateHistory(usedMobile, txType, "pending");
      setTestMobile("");
      setTestAmount("10");

      if (autoNavigate) {
        navigation.navigate("Transactions");
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || "Test recharge failed";
      setFeedback({ type: "error", message: errMsg, data: null });
      updateHistory(usedMobile, txType, "failed");
    } finally {
      setIsTesting(false);
    }
  };

  const updateHistory = (mobile, type, status) => {
    setHistory((prev) =>
      [
        {
          id: Date.now().toString(),
          mobile,
          type,
          status, // PENDING, SUCCESS, FAILED
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 5),
    );
  };

  const clearHistory = () => setHistory([]);

  const copyToClipboard = (text) => {
    if (text) {
      Clipboard.setString(text);
    }
  };

  // Pre-validated test numbers
  const quickNumbers = ["9876543210", "9123456780", "8123456780"];

  const filteredHistory = useMemo(() => {
    if (historyFilter === "all") return history;
    return history.filter((h) => h.status?.toLowerCase() === historyFilter);
  }, [history, historyFilter]);

  const getStatusColor = (status) => {
    if (status === "SUCCESS" || status === "success") return "#198754";
    if (status === "FAILED" || status === "failed") return "#dc3545";
    return "#fd7e14"; // PENDING / queued
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>API Tester</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Feedback Card */}
        {feedback && (
          <View
            style={[
              styles.feedbackCard,
              feedback.type === "success"
                ? styles.feedbackSuccess
                : styles.feedbackError,
            ]}
          >
            <Text
              style={[
                styles.feedbackText,
                feedback.type === "success"
                  ? styles.feedbackTextSuccess
                  : styles.feedbackTextError,
              ]}
            >
              {feedback.type === "success" ? "✅ " : "❌ "}
              {feedback.message}
            </Text>
            {feedback.data && (
              <View style={styles.previewBox}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewText}>
                    TxnId: {feedback.data.txnId || "N/A"}
                  </Text>
                  {feedback.data.txnId && (
                    <TouchableOpacity
                      onPress={() => copyToClipboard(feedback.data.txnId)}
                    >
                      <Text style={styles.copyText}>[Copy]</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.previewText}>
                  Mobile: {feedback.data.mobile}
                </Text>
                <View style={styles.previewRow}>
                  <Text style={styles.previewText}>Status: </Text>
                  <Text
                    style={[
                      styles.previewTextBold,
                      { color: getStatusColor(feedback.data.status) },
                    ]}
                  >
                    {String(feedback.data.status).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.previewText}>
                  Type: {feedback.data.type || txType}
                </Text>

                {String(feedback.data.status).toLowerCase() === "pending" && (
                  <View style={styles.pendingTimer}>
                    <ActivityIndicator size="small" color="#fd7e14" />
                    <Text style={styles.pendingText}>
                      {" "}
                      Processing (Est. 1-2 min)...
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Quick Tests */}
        <View style={styles.quickTests}>
          <Text style={styles.quickTestLabel}>Valid Fills:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {quickNumbers.map((num) => (
              <TouchableOpacity
                key={num}
                style={styles.quickBtn}
                onPress={() => {
                  setTestMobile(num);
                  if (feedback) setFeedback(null);
                }}
              >
                <Text style={styles.quickBtnText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.testSection}>
          <Text style={styles.testSectionTitle}>Simulate Transaction</Text>

          <View style={styles.testContainer}>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  txType === "RECHARGE" && styles.typeBtnActive,
                ]}
                onPress={() => setTxType("RECHARGE")}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    txType === "RECHARGE" && styles.typeBtnTextActive,
                  ]}
                >
                  RECHARGE
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  txType === "WALLET" && styles.typeBtnActive,
                ]}
                onPress={() => setTxType("WALLET")}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    txType === "WALLET" && styles.typeBtnTextActive,
                  ]}
                >
                  WALLET
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              ref={mobileInputRef}
              style={[
                styles.input,
                testMobile.length > 0 && !isValidMobile(testMobile)
                  ? styles.inputError
                  : null,
              ]}
              placeholder="Enter Mobile Number"
              keyboardType="numeric"
              maxLength={10}
              value={testMobile}
              onChangeText={handleTextChange}
              autoFocus={true}
            />
            {testMobile.length > 0 && !isValidMobile(testMobile) && (
              <Text style={styles.errorText}>Invalid mobile number format</Text>
            )}

            <TextInput
              style={styles.input}
              placeholder="Amount (₹)"
              keyboardType="numeric"
              value={testAmount}
              onChangeText={setTestAmount}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Auto-navigate on success</Text>
              <Switch
                value={autoNavigate}
                onValueChange={setAutoNavigate}
                trackColor={{ false: "#ddd", true: "#B5AEF6" }}
                thumbColor={autoNavigate ? "#6D5DF6" : "#f4f3f4"}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.testButton,
                !isValidMobile(testMobile) || isTesting
                  ? styles.testButtonDisabled
                  : null,
              ]}
              onPress={executeTest}
              disabled={!isValidMobile(testMobile) || isTesting}
              activeOpacity={0.8}
            >
              {isTesting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.testButtonText}> Processing...</Text>
                </View>
              ) : (
                <Text style={styles.testButtonText}>Trigger API</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Test History */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Recent Tests (Local)</Text>
              <TouchableOpacity onPress={clearHistory}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
              {["all", "success", "failed", "pending"].map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setHistoryFilter(f)}
                  style={[
                    styles.filterBtn,
                    historyFilter === f && styles.filterBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      historyFilter === f && styles.filterTextActive,
                    ]}
                  >
                    {f.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredHistory.map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyMobile}>{item.mobile}</Text>
                  <Text style={styles.historyTime}>
                    {item.time} • {item.type}
                  </Text>
                </View>
                <View
                  style={[
                    styles.historyBadge,
                    { backgroundColor: getStatusColor(item.status) },
                  ]}
                >
                  <Text style={styles.historyBadgeText}>
                    {String(item.status).toUpperCase()}
                  </Text>
                </View>
              </View>
            ))}

            {filteredHistory.length === 0 && (
              <Text style={styles.emptyHistoryText}>No matching logs.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { padding: 20, backgroundColor: "#6D5DF6", paddingBottom: 15 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  scrollContent: { paddingBottom: 30 },

  feedbackCard: {
    margin: 20,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  feedbackSuccess: { backgroundColor: "#d1e7dd", borderColor: "#badbcc" },
  feedbackError: { backgroundColor: "#f8d7da", borderColor: "#f5c2c7" },
  feedbackText: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  feedbackTextSuccess: { color: "#0f5132" },
  feedbackTextError: { color: "#842029" },
  previewBox: {
    backgroundColor: "rgba(255,255,255,0.6)",
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  previewRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  previewText: {
    fontSize: 13,
    color: "#333",
    fontFamily: "monospace",
    marginBottom: 4,
  },
  previewTextBold: {
    fontSize: 13,
    fontWeight: "bold",
    fontFamily: "monospace",
    marginBottom: 4,
  },
  copyText: {
    fontSize: 12,
    color: "#0d6efd",
    marginLeft: 8,
    fontWeight: "bold",
  },

  pendingTimer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    padding: 8,
    backgroundColor: "#FFF3CD",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ffe69c",
  },
  pendingText: {
    color: "#856404",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 6,
  },

  quickTests: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  quickTestLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#666",
    marginRight: 10,
  },
  quickBtn: {
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  quickBtnText: { color: "#4338CA", fontSize: 13, fontWeight: "600" },

  testSection: { padding: 20 },
  testSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  testContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  typeSelector: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#FAFAFA",
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: "#eee",
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  typeBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeBtnText: { fontSize: 14, fontWeight: "bold", color: "#888" },
  typeBtnTextActive: { color: "#6D5DF6" },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "#FAFAFA",
  },
  inputError: { borderColor: "#dc3545" },
  errorText: {
    color: "#dc3545",
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
  },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  switchLabel: { fontSize: 14, color: "#555" },

  testButton: {
    backgroundColor: "#6D5DF6",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  testButtonDisabled: { backgroundColor: "#B5AEF6" },
  testButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  historySection: { paddingHorizontal: 20, marginTop: 10 },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTitle: { fontSize: 16, fontWeight: "bold", color: "#444" },
  clearText: { fontSize: 13, color: "#dc3545", fontWeight: "bold" },

  filterRow: { flexDirection: "row", marginBottom: 12 },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#eee",
    marginRight: 8,
  },
  filterBtnActive: { backgroundColor: "#6D5DF6" },
  filterText: { fontSize: 11, fontWeight: "bold", color: "#666" },
  filterTextActive: { color: "#fff" },

  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  historyLeft: { flex: 1 },
  historyMobile: { fontSize: 15, fontWeight: "bold", color: "#333" },
  historyTime: { fontSize: 12, color: "#888", marginTop: 2 },
  historyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  historyBadgeText: { fontSize: 10, fontWeight: "bold", color: "#fff" },
  emptyHistoryText: {
    textAlign: "center",
    color: "#999",
    fontStyle: "italic",
    marginTop: 10,
  },
});

export default TestRechargeScreen;
