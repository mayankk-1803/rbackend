import prisma from "../src/config/prisma.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function runDiagnostics() {
  console.log("=== NexGate Diagnostic Verification ===");

  // Stage 1: Provider exists
  let provider = null;
  try {
    provider = await prisma.provider.findFirst({
      where: { code: "NEXGATE" }
    });
    if (provider) {
      console.log("Stage 1: Provider exists in database. [PASS]");
    } else {
      console.error("Stage 1: Provider does NOT exist in database. [FAIL]");
    }
  } catch (err) {
    console.error("Stage 1: Database query failed. [FAIL]", err.message);
  }

  // Stage 2: Provider active
  if (provider) {
    if (provider.isActive) {
      console.log("Stage 2: Provider is active. [PASS]");
    } else {
      console.error("Stage 2: Provider is inactive. [FAIL]");
    }
  } else {
    console.error("Stage 2: Skipped (provider missing). [FAIL]");
  }

  // Stage 3: Credentials present
  const username = process.env.NEXGATE_USERNAME;
  const apiKey = provider ? provider.apiKey : process.env.NEXGATE_APIKEY;
  const baseUrl = provider ? provider.baseUrl : "https://nexgate.in/api/v1";

  if (username && apiKey && baseUrl) {
    console.log("Stage 3: Credentials present. [PASS]");
  } else {
    console.error("Stage 3: Credentials missing in .env or database. [FAIL]");
  }

  // Stage 4: Endpoint reachable
  let reached = false;
  try {
    const res = await axios.post(`${baseUrl}/create_order.php`, {}, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000
    }).catch(e => e.response); // catch status errors
    
    if (res && res.status) {
      reached = true;
      console.log(`Stage 4: Endpoint reachable (Status Code: ${res.status}). [PASS]`);
    } else {
      console.error("Stage 4: Endpoint unreachable (No response). [FAIL]");
    }
  } catch (err) {
    console.error("Stage 4: Reachability check failed. [FAIL]", err.message);
  }

  // Stage 5: Authentication accepted
  let authenticated = false;
  if (reached) {
    try {
      const res = await axios.post(`${baseUrl}/create_order.php`, {}, {
        headers: {
          "Content-Type": "application/json",
          "x-client-username": username,
          "x-client-apikey": apiKey
        },
        timeout: 10000
      });
      // If we somehow succeed with empty payload or get validation error:
      if (res.data?.message && res.data.message.includes("Invalid Username or API Key")) {
        console.error("Stage 5: Authentication rejected (Invalid credentials). [FAIL]");
      } else {
        authenticated = true;
        console.log("Stage 5: Authentication accepted. [PASS]");
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.data?.message?.includes("Invalid Username")) {
        console.error("Stage 5: Authentication rejected (401 / Invalid credentials). [FAIL]");
      } else if (err.response) {
        // Any other response status means auth bypassed, payload/parameters failed
        authenticated = true;
        console.log(`Stage 5: Authentication accepted (Bypassed with Code: ${err.response.status}). [PASS]`);
      } else {
        console.error("Stage 5: Auth check request failed. [FAIL]", err.message);
      }
    }
  } else {
    console.error("Stage 5: Skipped (endpoint unreachable). [FAIL]");
  }

  // Stage 6: Merchant mapping exists
  if (authenticated) {
    try {
      const payload = {
        amount: 10,
        customer_mobile: "9999999999",
        customer_email: "test@example.com",
        order_id: "diag_" + Date.now(),
        redirect_url: "http://localhost:5000/payment-success",
        webhook_url: "http://localhost:5000/api/webhook/nexgate"
      };

      const res = await axios.post(`${baseUrl}/create_order.php`, payload, {
        headers: {
          "Content-Type": "application/json",
          "x-client-username": username,
          "x-client-apikey": apiKey
        },
        timeout: 10000
      });

      if (res.data?.status === "failure" && res.data?.message?.includes("No Active Merchant Integration Found")) {
        console.error("Stage 6: Merchant mapping failed (No Active Merchant Integration Found at NexGate). [FAIL]");
        console.warn("[NEXGATE_MERCHANT_NOT_LINKED] REMOTE ACCOUNT CONFIGURATION ERROR DETECTED: PhonePe active on dashboard but not linked/activated on API account.");
      } else if (res.data?.status === "success" || res.data?.success === true) {
        console.log("Stage 6: Merchant mapping verified. [PASS]");
      } else {
        console.error(`Stage 6: Unknown response status: ${JSON.stringify(res.data)}. [FAIL]`);
      }
    } catch (err) {
      console.error("Stage 6: Merchant mapping verification failed. [FAIL]", err.response?.data || err.message);
    }
  } else {
    console.error("Stage 6: Skipped (authentication failed). [FAIL]");
  }

  console.log("=== Diagnostics Completed ===");
}

runDiagnostics().catch(e => console.error("Unhandled error:", e)).finally(() => prisma.$disconnect());
