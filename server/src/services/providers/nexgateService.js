import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "https://nexgate.in/api/v1";
const TIMEOUT_MS = 20000;

/**
 * NexGate Production Provider Service
 */

const getHeaders = () => ({
  "Content-Type": "application/json",
  "x-client-username": process.env.NEXGATE_USERNAME,
  "x-client-apikey": process.env.NEXGATE_APIKEY
});

/**
 * Normalizes NexGate status
 */
const normalizeStatus = (status) => {
  const s = (status || "").toUpperCase();
  if (s === "SUCCESS" || s === "PAID" || s === "COMPLETED") return "SUCCESS";
  if (s === "FAILED" || s === "REJECTED" || s === "CANCELLED") return "FAILED";
  return "PENDING";
};

/**
 * Creates a payment order
 */
export const createNexgateOrder = async (data) => {
  const { amount, mobile, name, email, txnId } = data;

  try {
    const payload = {
      amount: Number(amount),
      customer_mobile: mobile || "9999999999",
      customer_email: email || `user_${Date.now()}@otp.com`,
      order_id: txnId.toString(),
      redirect_url: `https://rchserver.irecharge.in/payment-success?order_id=${txnId}`,
      webhook_url: `https://rchserver.irecharge.in/api/webhook/nexgate`,
      callback_url: `https://rchserver.irecharge.in/api/webhook/nexgate`,
      notify_url: `https://rchserver.irecharge.in/api/webhook/nexgate`
    };

    console.log("[NEXGATE REQUEST]", payload);

    const response = await axios.post(`${BASE_URL}/create_order.php`, payload, {
      headers: getHeaders(),
      timeout: TIMEOUT_MS,
      validateStatus: (status) => status < 500 // Allow 403 to be handled in the try block
    });

    console.log("[NEXGATE RESPONSE]", JSON.stringify(response.data, null, 2));

    const resData = response.data;

    // HANDLE IP MISMATCH (403 or failure status with IP message)
    if (resData.status === "failure" && resData.message?.includes("IP Mismatch")) {
       return {
         success: false,
         gatewayError: "IP_MISMATCH",
         message: "Server IP Mismatch. Please whitelist VPS IP 103.178.166.178 in NexGate dashboard.",
         raw: resData
       };
    }

    const success = resData.status === "success";

    if (!success) {
      throw new Error(resData.message || "Gateway failed initialization");
    }

    return {
      success: true,
      payment_url: resData.data?.payment_url,
      qr_image: resData.data?.qr_image,
      order_id: resData.data?.order_id || resData.order_id,
      raw: resData
    };

  } catch (error) {
    if (error.response?.status === 403) {
      console.error("[NEXGATE IP ERROR]: Server IP Mismatch detected.");
      return {
        success: false,
        gatewayError: "IP_MISMATCH",
        message: "Access Denied: Server IP not whitelisted at NexGate.",
        raw: error.response.data
      };
    }

    console.error(`[NEXGATE ORDER EXCEPTION] Txn ${txnId}:`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Executes a recharge
 */
export const executeNexgateRecharge = async (data) => {
  const { mobile, amount, operator, txnId } = data;

  try {
    const payload = {
      mobile,
      amount: Number(amount),
      operator,
      order_id: txnId.toString()
    };

    const response = await axios.post(`${BASE_URL}/create_order.php`, payload, {
      headers: getHeaders(),
      timeout: TIMEOUT_MS
    });

    const resData = response.data;

    if (resData.status === "success" || resData.success) {
      return {
        success: true,
        status: normalizeStatus(resData.status),
        message: resData.message || "Order created",
        providerTxnId: resData.order_id,
        operatorTxnId: resData.operator_id,
        raw: resData
      };
    }

    return {
      success: false,
      status: "FAILED",
      message: resData.message || "Provider error",
      raw: resData
    };

  } catch (error) {
    console.error(`[NEXGATE RECHARGE ERROR] Txn ${txnId}:`, error.response?.data || error.message);
    return {
      success: false,
      status: "FAILED",
      message: error.response?.data?.message || error.message || "Provider connection failed"
    };
  }
};

/**
 * Checks status
 */
export const checkNexgateStatus = async (orderId) => {
  try {
    const response = await axios.post(`${BASE_URL}/check_status.php`, { order_id: orderId.toString() }, {
      headers: getHeaders(),
      timeout: TIMEOUT_MS
    });
    return {
      success: response.data.status === "success",
      status: normalizeStatus(response.data.status),
      operatorTxnId: response.data.operator_id || response.data.txn_id,
      message: response.data.message,
      raw: response.data
    };
  } catch (error) {
    console.error(`[NEXGATE STATUS ERROR] Order ${orderId}:`, error.message);
    throw error;
  }
};
