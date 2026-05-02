import dotenv from "dotenv";
import { startPaymentWorker } from "./src/workers/paymentWorker.js";
import "./src/workers/rechargeWorker.js"; // Initialize Recharge Worker

dotenv.config();

console.log("Starting Workers...");

// Start Payment Worker
startPaymentWorker();

console.log("Worker started");
