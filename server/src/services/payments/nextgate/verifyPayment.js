import axios from "axios";

const BASE_URL = "https://nexgate.in/api/v1";

/**
 * Verifies payment status and signature
 */
export const verifyPayment = async (orderId) => {
  try {
    const response = await axios.post(`${BASE_URL}/check_status.php`, { 
      order_id: orderId.toString() 
    }, {
      headers: {
        "Content-Type": "application/json",
        "x-client-username": process.env.NEXGATE_USERNAME,
        "x-client-apikey": process.env.NEXGATE_APIKEY
      },
      timeout: 10000
    });

    const data = response.data;
    const status = (data.status || "").toUpperCase();

    return {
      success: status === "SUCCESS" || status === "PAID",
      status: status,
      amount: Number(data.amount || 0),
      gatewayTxnId: data.operator_id || data.txn_id,
      raw: data
    };
  } catch (error) {
    console.error(`[NEXTGATE VERIFY ERROR] Order ${orderId}:`, error.message);
    throw error;
  }
};
