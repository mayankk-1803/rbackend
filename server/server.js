import app from "./src/app.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import http from "http";
import { initSocket } from "./src/config/socket.js";
import { startHealthMonitoring } from "./src/services/healthService.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("DB Connected");
  
  const server = http.createServer(app);
  initSocket(server);
  
  // Start Health Monitoring Service
  startHealthMonitoring(60000); // Check every 1 minute
  
  server.listen(PORT, () =>
    console.log("Server running on port " + PORT)
  );
});
