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
    // STARTUP DIAGNOSTICS
    console.log("[STARTUP] Initializing diagnostics...");
    
    // 1. Env validation
    if (!process.env.JWT_SECRET) {
      console.warn("[STARTUP] JWT_SECRET missing!");
    } else {
      console.log("[STARTUP] ENV validated");
    }

    // 2. Prisma connectivity & Schema Validation
    await prisma.$connect();
    console.log("[STARTUP] Prisma connected");

    // Diagnostic: Comprehensive Database integrity check
    try {
      console.log("[STARTUP] Running deep schema validation...");
      
      // 2a. Check Wallet.coinBalance
      const walletCols = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM wallet LIKE 'coinBalance'`);
      if (walletCols.length === 0) {
        throw new Error("Missing column 'coinBalance' in 'wallet' table");
      }

      // 2b. Check coinTransaction table
      const coinTables = await prisma.$queryRawUnsafe(`SHOW TABLES LIKE 'coinTransaction'`);
      if (coinTables.length === 0) {
        // Fallback for case-insensitive systems
        const coinTablesLower = await prisma.$queryRawUnsafe(`SHOW TABLES LIKE 'cointransaction'`);
        if (coinTablesLower.length === 0) {
          throw new Error("Missing table 'coinTransaction'");
        }
      }

      // 2c. Check critical indexes for performance and constraints
      const indexes = await prisma.$queryRawUnsafe(`SHOW INDEX FROM coinTransaction`);
      const indexNames = indexes.map(idx => idx.Key_name || idx.key_name);
      const requiredIndexes = ['coinTransaction_userId_createdAt_idx', 'coinTransaction_rechargeTxnId_type_key'];
      
      for (const idx of requiredIndexes) {
        if (!indexNames.includes(idx)) {
          console.warn(`[STARTUP] WARNING: Critical index '${idx}' missing on coinTransaction table!`);
        }
      }

      console.log("[STARTUP] Database schema validated (Coin System Integrity OK)");
    } catch (diagErr) {
      console.error("CRITICAL: Database schema validation failed!");
      console.error(`REASON: ${diagErr.message}`);
      console.error("ACTION REQUIRED: Ensure all migrations are applied and DB matches schema.prisma.");
      
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
    
    // 3. Redis connectivity
    try {
      const { redisClient } = await import("./src/config/redis.js");
      await redisClient.ping();
      console.log("[STARTUP] Redis connected");
    } catch (err) {
      console.warn("[STARTUP] Redis connection failed - features like OTP cooldown will be disabled");
    }

    // 4. SMS configuration presence
    const smsConfigured = !!(process.env.SMS_API_KEY && process.env.SMS_API_URL);
    if (smsConfigured) {
      console.log("[STARTUP] SMS configuration detected");
    } else {
      const msg = "[STARTUP] SMS configuration missing!";
      if (process.env.NODE_ENV === 'production') {
        console.error(`CRITICAL: ${msg}`);
      } else {
        console.warn(msg);
      }
    }

    // Seed the 10 providers
    await seedProviders();
    
    const server = http.createServer(app);
    initSocket(server);
    
    // Start Health Monitoring Service
    startHealthMonitoring(60000); // Check every 1 minute

    // Start Payment Reconciliation Service
    const { startReconciliationCron } = await import("./src/services/reconciliationService.js");
    startReconciliationCron();
    
    server.listen(PORT, () =>
      console.log("Server running on port " + PORT)
    );

    // Graceful Shutdown Handler
    const shutdown = async (signal) => {
      console.log(`[SHUTDOWN] ${signal} received. Closing resources...`);
      server.close(async () => {
        console.log("[SHUTDOWN] Server closed.");
        await prisma.$disconnect();
        console.log("[SHUTDOWN] Prisma disconnected.");
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
