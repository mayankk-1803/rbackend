import app from "./src/app.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import http from "http";
import { initSocket } from "./src/config/socket.js";
import { startHealthMonitoring } from "./src/services/healthService.js";
import { seedProviders } from "./src/utils/seedProviders.js";
import { startPaymentWorker } from "./src/workers/paymentWorker.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
.then(async () => {
  console.log("DB Connected");
  
  // Seed the 10 providers
  await seedProviders();
  
  const server = http.createServer(app);
  initSocket(server);
  
  // Start Health Monitoring Service
  startHealthMonitoring(60000); // Check every 1 minute
  
  // Start Payment Worker
  startPaymentWorker();
  
  server.listen(PORT, () =>
    console.log("Server running on port " + PORT)
  );
});
