import dotenv from "dotenv";
import { apiboxRequest } from "../src/services/providers/apibox/client.js";

dotenv.config();

async function checkBalance() {
  console.log("Checking APIBOX balance directly...");
  try {
    const responseData = await apiboxRequest("/Balance", {}, false);
    console.log("APIBOX Balance Response Data:", responseData);
  } catch (error) {
    console.error("Direct APIBOX balance check failed:", error.message);
    if (error.raw) {
      console.error("Raw response error body:", error.raw);
    }
  }
}

checkBalance();
