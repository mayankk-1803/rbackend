import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function testNexgateDirect() {
  const payload = {
    amount: 10,
    customer_mobile: "9999999999",
    customer_email: "test@example.com",
    order_id: "test_" + Date.now(),
    redirect_url: "http://localhost:5000/payment-success",
    webhook_url: "http://localhost:5000/api/webhook/nexgate",
    callback_url: "http://localhost:5000/api/webhook/nexgate",
    notify_url: "http://localhost:5000/api/webhook/nexgate"
  };

  console.log("BASE_URL:", "https://nexgate.in/api/v1");
  console.log("Headers:", {
    "Content-Type": "application/json",
    "x-client-username": process.env.NEXGATE_USERNAME,
    "x-client-apikey": process.env.NEXGATE_APIKEY ? "*****" : "MISSING"
  });
  console.log("Payload:", payload);

  try {
    const res = await axios.post("https://nexgate.in/api/v1/create_order.php", payload, {
      headers: {
        "Content-Type": "application/json",
        "x-client-username": process.env.NEXGATE_USERNAME,
        "x-client-apikey": process.env.NEXGATE_APIKEY
      }
    });
    console.log("Response Status:", res.status);
    console.log("Response Data:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Request Failed!");
    if (err.response) {
      console.error("Response Status:", err.response.status);
      console.error("Response Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("Error Message:", err.message);
    }
  }
}

testNexgateDirect();
