import axios from "axios";

const BASE_URL = "https://nexgate.in/api/v1";

/**
 * Creates a payment order for admin topup
 */
export const createOrder = async (data) => {
  const { amount, txnId, userId } = data;
  
  const adminUrl = (process.env.ADMIN_PANEL_URL || "http://localhost:5173").replace(/\/$/, "");
  
  const payload = {
    amount: Number(amount),
    customer_mobile: "9999999999", // Admin default or dynamic
    customer_email: "admin@dizipay.com",
    order_id: txnId.toString(),
    redirect_url: `${adminUrl}/wallet?status=verify&order_id=${txnId}`,
    webhook_url: `${process.env.BACKEND_URL}/api/webhooks/nextgate`,
    callback_url: `${process.env.BACKEND_URL}/api/webhooks/nextgate`
  };

  try {
    const response = await axios.post(`${BASE_URL}/create_order.php`, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-client-username": process.env.NEXGATE_USERNAME,
        "x-client-apikey": process.env.NEXGATE_APIKEY
      },
      timeout: 20000
    });

    if (response.data.status === "success") {
      return {
        success: true,
        paymentUrl: response.data.data?.payment_url,
        orderId: response.data.data?.order_id || txnId,
        raw: response.data
      };
    }

    throw new Error(response.data.message || "Nextgate initialization failed");
  } catch (error) {
    console.error("[NEXTGATE CREATE ORDER ERROR]:", error.message);
    throw error;
  }
};
