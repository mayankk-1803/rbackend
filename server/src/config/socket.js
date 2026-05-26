import { Server } from "socket.io";
import eventBus from "./eventBus.js";
import crypto from "crypto";
import { redisClient } from "./redis.js";

export const safeTransactionPayloadV1 = (data) => {
  if (!data) return data;
  const safeData = { ...data };
  
  // Strip sensitive backend/provider fields
  delete safeData.providerTxnId;
  delete safeData.gatewayTxnId;
  delete safeData.idempotencyKey;
  delete safeData.financialSequenceId;
  delete safeData.cost;
  delete safeData.profit;
  delete safeData.commission;
  
  if (safeData.transaction) {
    const t = { ...safeData.transaction };
    delete t.providerTxnId;
    delete t.idempotencyKey;
    delete t.financialSequenceId;
    delete t.profit;
    delete t.cost;
    delete t.commission;
    safeData.transaction = t;
  }
  
  // Add deduplication and timestamp for frontend
  safeData.emitId = crypto.randomBytes(8).toString('hex');
  safeData.timestamp = Date.now();
  return safeData;
};

let io;

export const initSocket = (server) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ["http://localhost:3000", "http://localhost:5173"];

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"]
  });


  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
    if (userId) {
      socket.join(userId.toString());
      console.log(`[Socket] User ${userId} joined their private room: ${socket.id}`);
    }
    
    // Strict Socket Rate Limiting: 5 events per second per socket
    socket.use(async (packet, next) => {
      const limitKey = `socket_limit:${socket.id}`;
      try {
        const multi = redisClient.multi();
        multi.incr(limitKey);
        multi.ttl(limitKey);
        const [incrResult, ttlResult] = await multi.exec();
        const requestCount = incrResult[1];
        const ttl = ttlResult[1];
        
        if (ttl < 0) {
          await redisClient.expire(limitKey, 1);
        }
        
        if (requestCount > 5) {
          console.warn(`[SOCKET RATE LIMIT] Blocked socket ${socket.id}`);
          return next(new Error("TOO_MANY_REQUESTS"));
        }
        next();
      } catch (err) {
        next();
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${socket.id}`);
    });
  });

  const adminNamespace = io.of("/admin");

  adminNamespace.on("connection", (socket) => {
    console.log(`[Socket] Admin connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`[Socket] Admin disconnected: ${socket.id}`);
    });
  });

  // Realtime Lifecycle Broadcaster
  eventBus.on("recharge_queued", (data) => {
    const updateData = {
      transactionId: data.txnId || data.transactionId,
      status: data.status || "PENDING_REVIEW",
      transaction: data.transaction,
      ...data
    };
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_queued", safeTransactionPayloadV1(data));
      io.to(data.userId.toString()).emit("recharge_update", safeTransactionPayloadV1(updateData));
    }
    adminNamespace.emit("recharge_queued", safeTransactionPayloadV1(data));
    adminNamespace.emit("recharge_update", safeTransactionPayloadV1(updateData));
  });

  eventBus.on("recharge_processing", (data) => {
    const updateData = {
      transactionId: data.txnId || data.transactionId,
      status: data.status || "PROCESSING",
      transaction: data.transaction,
      ...data
    };
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_processing", safeTransactionPayloadV1(data));
      io.to(data.userId.toString()).emit("recharge_update", safeTransactionPayloadV1(updateData));
    }
    adminNamespace.emit("recharge_processing", safeTransactionPayloadV1(data));
    adminNamespace.emit("recharge_update", safeTransactionPayloadV1(updateData));
  });

  eventBus.on("recharge_pending", (data) => {
    const updateData = {
      transactionId: data.txnId || data.transactionId,
      status: data.status,
      transaction: data.transaction,
      ...data
    };
    console.log(`[SOCKET_EVENT] Emitting recharge_pending & recharge_update for Txn: ${updateData.transactionId}`);
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_pending", safeTransactionPayloadV1(data));
      io.to(data.userId.toString()).emit("recharge_update", safeTransactionPayloadV1(updateData));
    }
    adminNamespace.emit("recharge_pending", data);
    adminNamespace.emit("recharge_update", updateData);
  });

  eventBus.on("recharge_success", (data) => {
    const updateData = {
      transactionId: data.transactionId || data.txnId,
      status: data.status,
      transaction: data.transaction,
      ...data
    };
    console.log(`[SOCKET_EVENT] Emitting recharge_success & recharge_update for Txn: ${updateData.transactionId}`);
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_success", safeTransactionPayloadV1(data));
      io.to(data.userId.toString()).emit("recharge_update", safeTransactionPayloadV1(updateData));
    }
    adminNamespace.emit("recharge_success", data);
    adminNamespace.emit("recharge_update", updateData);
  });
  
  eventBus.on("recharge_failed", (data) => {
    const updateData = {
      transactionId: data.transactionId || data.txnId,
      status: data.status,
      transaction: data.transaction,
      ...data
    };
    console.log(`[SOCKET_EVENT] Emitting recharge_failed & recharge_update for Txn: ${updateData.transactionId}`);
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_failed", safeTransactionPayloadV1(data));
      io.to(data.userId.toString()).emit("recharge_update", safeTransactionPayloadV1(updateData));
    }
    adminNamespace.emit("recharge_failed", data);
    adminNamespace.emit("recharge_update", updateData);
  });

  eventBus.on("refund_completed", (data) => {
    const updateData = {
      transactionId: data.txnId || data.transactionId,
      status: data.status || "REFUNDED",
      transaction: data.transaction,
      ...data
    };
    if (data.userId) {
      io.to(data.userId.toString()).emit("refund_completed", safeTransactionPayloadV1(data));
      io.to(data.userId.toString()).emit("recharge_update", safeTransactionPayloadV1(updateData));
    }
    adminNamespace.emit("refund_completed", safeTransactionPayloadV1(data));
    adminNamespace.emit("recharge_update", safeTransactionPayloadV1(updateData));
  });

  eventBus.on("wallet_updated", (data) => {
    if (data.userId) {
      io.to(data.userId.toString()).emit("wallet_updated", safeTransactionPayloadV1(data));
    }
  });

  eventBus.on("payment_processing", (data) => {
    console.log(`[SOCKET_EVENT] Emitting payment_processing for User: ${data.userId} | Payment: ${data.paymentId}`);
    if (data.userId) {
      io.to(data.userId.toString()).emit("payment_processing", {
        orderId: data.paymentId || data.id,
        status: "PROCESSING",
        message: "Payment verification in progress"
      });
    }
  });

  eventBus.on("earned_coins_awarded", (data) => {
    console.log(`[SOCKET_EVENT] Emitting earned_coins_awarded to User: ${data.userId}`);
    if (data.userId) {
      io.to(data.userId.toString()).emit("earned_coins_awarded", safeTransactionPayloadV1(data));
    }
  });

  // Legacy/Global fallback
  eventBus.on("transaction_updated", (data) => {
    const updateData = {
      transactionId: data.transactionId || data.txnId,
      status: data.status?.toLowerCase(),
      transaction: data.transaction,
      ...data
    };
    console.log(`[SOCKET_EVENT] Emitting transaction_updated & recharge_update for Txn: ${updateData.transactionId}`);
    if (data.userId) {
      io.to(data.userId.toString()).emit("transaction_updated", safeTransactionPayloadV1(data));
      io.to(data.userId.toString()).emit("recharge_update", safeTransactionPayloadV1(updateData));
    } else {
      io.emit("transaction_updated", safeTransactionPayloadV1(data));
      io.emit("recharge_update", safeTransactionPayloadV1(updateData));
    }
    adminNamespace.emit("transaction_updated", data);
    adminNamespace.emit("recharge_update", updateData);
  });

  eventBus.on("provider_status", (data) => adminNamespace.emit("provider_status", data));
  eventBus.on("fraud_alert", (data) => adminNamespace.emit("fraud_alert", data));
  
  // New events for health and blacklisting
  eventBus.on("provider_health_update", (data) => adminNamespace.emit("provider_health_update", data));
  eventBus.on("provider_down_alert", (data) => adminNamespace.emit("provider_down_alert", data));
  eventBus.on("provider_blacklisted", (data) => adminNamespace.emit("provider_blacklisted", data));

  // Socket safety: emit api_access_updated events to user and admin namespaces
  eventBus.on("api_access_updated", (data) => {
    if (data.userId) {
      io.to(data.userId.toString()).emit("api_access_updated", data);
    }
    adminNamespace.emit("api_access_updated", data);
  });
  
  return io;
};

export const getIO = () => {
  if (!io) {
    // Return a mock object if io is not initialized (e.g., in worker process)
    // This allows calling io.emit() or io.to().emit() without crashing
    const mockIO = {
      emit: (event, data) => {
        console.log(`[SOCKET MOCK] Emitting ${event}:`, data);
        eventBus.emit(event, data);
      },
      to: (room) => {
        console.log(`[SOCKET MOCK] targeting room: ${room}`);
        return mockIO; // Chainable
      },
      in: (room) => {
        console.log(`[SOCKET MOCK] targeting room: ${room}`);
        return mockIO; // Chainable
      },
      of: (namespace) => {
        console.log(`[SOCKET MOCK] targeting namespace: ${namespace}`);
        return mockIO; // Simplified for mock
      }
    };
    return mockIO;
  }
  return io;
};
