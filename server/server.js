import app from "./src/app.js";
import dotenv from "dotenv";
import http from "http";
import { initSocket } from "./src/config/socket.js";
import { startHealthMonitoring } from "./src/services/healthService.js";
import { seedProviders } from "./src/utils/seedProviders.js";
import prisma from "./src/config/prisma.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Check DB connection
    await prisma.$connect();
    console.log("MySQL DB Connected via Prisma");
    
    // Seed the 10 providers
    await seedProviders();
    
    const server = http.createServer(app);
    initSocket(server);
    
    // Start Health Monitoring Service
    startHealthMonitoring(60000); // Check every 1 minute
    
    
    server.listen(PORT, () =>
      console.log("Server running on port " + PORT)
    );
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
