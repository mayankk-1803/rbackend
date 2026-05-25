import axios from "axios";
import dotenv from "dotenv";
import https from "https";

dotenv.config();

const BASE_URL = "https://nexgate.in/api/v1";

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  timeout: 30000,
  family: 4
});

const nexgateClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  httpsAgent,
  maxBodyLength: Infinity,
  maxContentLength: Infinity
});

const nexgateOrderClient = axios.create({
  baseURL: BASE_URL,
  timeout: 25000,
  httpsAgent: new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    family: 4
  }),
  maxBodyLength: Infinity,
  maxContentLength: Infinity
});

let consecutiveFailures = 0;
let circuitBreakerOpenUntil = null;
let lastFailureTime = 0;
const FAILURE_THRESHOLD = 5;
const COOLDOWN_PERIOD_MS = 60000;
const DEBOUNCE_WINDOW_MS = 5000;

export const isCircuitBreakerOpen = () => {
  return !!(circuitBreakerOpenUntil && Date.now() < circuitBreakerOpenUntil);
};

const checkCircuitBreaker = () => {
  if (isCircuitBreakerOpen()) {
    console.warn("[NEXGATE_CIRCUIT_OPEN] Nexgate requests temporarily paused.");
    throw new Error("Nexgate payment gateway is temporarily unavailable (Circuit Breaker open)");
  }
  if (circuitBreakerOpenUntil && Date.now() >= circuitBreakerOpenUntil) {
    console.log("[NEXGATE_CIRCUIT_RESET] Circuit breaker cooldown complete. Resetting breaker.");
    consecutiveFailures = 0;
    circuitBreakerOpenUntil = null;
  }
};

const recordSuccess = () => {
  consecutiveFailures = 0;
  circuitBreakerOpenUntil = null;
};

const recordFailure = () => {
  const now = Date.now();
  // If breaker is already open, do not count this failure
  if (isCircuitBreakerOpen()) {
    return;
  }

  // Debounce consecutive failure counts
  if (now - lastFailureTime < DEBOUNCE_WINDOW_MS) {
    console.log(`[NEXGATE_FAILURE_DEBOUNCED] Failure within debounce window. Prev: ${new Date(lastFailureTime).toISOString()}`);
    return;
  }

  lastFailureTime = now;
  consecutiveFailures += 1;
  console.warn(`[NEXGATE_CIRCUIT_FAILURE] Consecutive failures incremented: ${consecutiveFailures}/${FAILURE_THRESHOLD}`);

  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    circuitBreakerOpenUntil = now + COOLDOWN_PERIOD_MS;
    console.error(`[NEXGATE_CIRCUIT_OPEN] ${consecutiveFailures} consecutive failures. Opening circuit for 60 seconds.`);
  }
};

const isRetryableError = (error) => {
  if (!error) return false;
  const code = error.code || "";
  const msg = error.message || "";
  const status = error.response?.status;

  return (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    msg.includes("socket hang up") ||
    msg.includes("timeout") ||
    status === 552 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
};

const getHeaders = () => ({
  "Content-Type": "application/json",
  "x-client-username": process.env.NEXGATE_USERNAME,
  "x-client-apikey": process.env.NEXGATE_APIKEY
});

const requestWithRetryAndLogging = async (config) => {
  checkCircuitBreaker();

  let attempt = 0;
  const maxRetries = 2;
  const startedAt = Date.now();

  const clientToUse = config.url === "/create_order.php" ? nexgateOrderClient : nexgateClient;

  const maskHeaders = (headers) => {
    const masked = { ...headers };
    if (masked["x-client-apikey"]) masked["x-client-apikey"] = "*****";
    if (masked["Authorization"]) masked["Authorization"] = "*****";
    return masked;
  };

  console.log(`[NEXGATE_REQUEST_START] URL: ${config.url || ""}, Method: ${config.method || "POST"}, Headers: ${JSON.stringify(maskHeaders(config.headers || getHeaders()))}`);

  while (attempt <= maxRetries) {
    try {
      const response = await clientToUse(config);
      const duration = Date.now() - startedAt;
      console.log(`[NEXGATE_REQUEST_SUCCESS] [NEXGATE_RESPONSE_TIME] ${duration}ms for ${config.url || ""}`);
      recordSuccess();
      return response;
    } catch (error) {
      const duration = Date.now() - startedAt;
      
      const isTimeout = error.code === "ETIMEDOUT" || error.message?.includes("timeout");
      if (isTimeout) {
        console.error(`[NEXGATE_REQUEST_TIMEOUT] Request timed out after ${duration}ms for ${config.url || ""}`);
      }

      const retryable = isRetryableError(error);
      if (retryable && attempt < maxRetries) {
        attempt++;
        const delay = attempt === 1 ? 2000 : 5000;
        console.warn(`[NEXGATE_RETRY] Attempt ${attempt} failed. Retrying in ${delay / 1000}s. Error: ${error.message}`);
        recordFailure();
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        recordFailure();
        console.error(`[NEXGATE ORDER EXCEPTION] Error: ${error.message}`);
        throw error;
      }
    }
  }
};

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

    const response = await requestWithRetryAndLogging({
      method: "POST",
      url: "/create_order.php",
      data: payload,
      headers: getHeaders(),
      validateStatus: (status) => status < 500 // Allow 403 to be handled in the try block
    });

    console.log("[NEXGATE RESPONSE]", JSON.stringify(response.data, null, 2));

    const resData = response.data;

    // HANDLE IP MISMATCH (403 or failure status with IP message)
    if (resData?.status === "failure" && resData?.message?.includes("IP Mismatch")) {
       return {
         success: false,
         gatewayError: "IP_MISMATCH",
         message: "Server IP Mismatch. Please whitelist VPS IP 103.178.166.178 in NexGate dashboard.",
         raw: resData
       };
    }

    const success = resData?.status === "success" || resData?.success === true;

    if (!success) {
      throw new Error(resData?.message || "Gateway failed initialization");
    }

    const paymentUrl =
      resData?.data?.payment_url ||
      resData?.payment_url ||
      resData?.data?.paymentUrl ||
      resData?.redirect_url ||
      resData?.checkout_url ||
      null;

    const qrImage =
      resData?.data?.qr_image ||
      resData?.qr_image ||
      null;

    const providerOrderId =
      resData?.data?.order_id ||
      resData?.order_id ||
      null;

    console.log(
      `[NEXGATE_RAW_RESPONSE] Status: ${
        resData?.status || resData?.success
      }, Has paymentUrl: ${!!paymentUrl}, Has qrImage: ${!!qrImage}`
    );

    if (paymentUrl) {
      let maskedUrl = paymentUrl;
      try {
        const urlObj = new URL(paymentUrl);
        const maskedParams = new URLSearchParams(urlObj.search);
        for (const key of maskedParams.keys()) {
          maskedParams.set(key, "*****");
        }
        maskedUrl = `${urlObj.origin}${urlObj.pathname}?${maskedParams.toString()}`;
      } catch (e) {}
      console.log(`[NEXGATE_PAYMENT_URL_RECEIVED] Redirect URL detected: ${maskedUrl}`);
    }

    return {
      success: true,
      provider: "NEXGATE",
      status: "PENDING",

      paymentUrl,
      payment_url: paymentUrl,

      qrImage,
      qr_image: qrImage,

      providerOrderId,
      order_id: providerOrderId,

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

    const response = await requestWithRetryAndLogging({
      method: "POST",
      url: "/create_order.php",
      data: payload,
      headers: getHeaders()
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
    const paymentId = orderId && typeof orderId === "object" ? orderId.id : orderId;
    const payload = {
      order_id: paymentId.toString()
    };

    const response = await requestWithRetryAndLogging({
      method: "POST",
      url: "/check_status.php",
      data: payload,
      headers: getHeaders()
    });

    console.log("[NEXGATE_STATUS_RAW_RESPONSE]", JSON.stringify(response.data, null, 2));

    const statusValue =
      response.data?.status ||
      response.data?.payment_status ||
      response.data?.data?.status ||
      "PENDING";

    const normalized = String(statusValue).trim().toUpperCase();

    let providerStatus = "PENDING";
    if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID"].includes(normalized)) {
      providerStatus = "SUCCESS";
    } else if (["FAILED", "EXPIRED", "REJECTED", "CANCELLED"].includes(normalized)) {
      providerStatus = "FAILED";
    }

    const operatorTxnId =
      response.data?.operator_id ||
      response.data?.txn_id ||
      response.data?.data?.operator_id ||
      response.data?.data?.txn_id ||
      null;

    return {
      success: providerStatus === "SUCCESS",
      status: providerStatus,
      providerStatus,
      operatorTxnId,
      gatewayTxnId: operatorTxnId,
      message: response.data?.message || response.data?.data?.message,
      raw: response.data
    };
  } catch (error) {
    console.error(`[NEXGATE STATUS ERROR] Order ${orderId?.id || orderId}:`, error.message);
    throw error;
  }
};
