import app from "./src/app.js";
import dotenv from "dotenv";
import http from "http";
import { initSocket } from "./src/config/socket.js";
import { startHealthMonitoring } from "./src/services/healthService.js";
import { seedProviders } from "./src/utils/seedProviders.js";
import prisma from "./src/config/prisma.js";
import { validateEnv } from "./src/utils/validateEnv.js";

dotenv.config();
validateEnv();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log("[STARTUP] Initializing DiziPay V3 Diagnostics...");
    
    await prisma.$connect();
    console.log("[STARTUP] Prisma connected");

    try {
      // Basic schema check
      await prisma.$queryRaw`SELECT 1`;
      console.log("[STARTUP] Database connectivity verified");
    } catch (diagErr) {
      console.error("CRITICAL: Database connection failed!", diagErr.message);
      if (process.env.NODE_ENV === 'production') process.exit(1);
    }
    
    try {
      const { redisClient } = await import("./src/config/redis.js");
      await redisClient.ping();
      console.log("[STARTUP] Redis connected");
    } catch (err) {
      console.warn("[STARTUP] Redis connection failed");
    }

    await seedProviders();
    
    const server = http.createServer(app);
    initSocket(server);
    
    startHealthMonitoring(60000);

    const { startReconciliationCron } = await import("./src/services/reconciliationService.js");
    startReconciliationCron();
    
    server.listen(PORT, () =>
      console.log("DiziPay V3 Server running on port " + PORT)
    );

    const shutdown = async (signal) => {
      console.log(`[SHUTDOWN] ${signal} received.`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
