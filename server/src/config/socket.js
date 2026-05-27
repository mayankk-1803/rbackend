import { Server } from "socket.io";
import eventBus from "./eventBus.js";
import crypto from "crypto";
import { redisClient } from "./redis.js";
import prisma from "./prisma.js";

export const enrichAndNormalizeTransaction = async (txn) => {
  if (!txn) return txn;

  const enriched = { ...txn };

  // Fetch user if missing
  if (enriched.userId && (!enriched.user || (!enriched.user.phone && !enriched.user.email))) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: enriched.userId },
        select: { email: true, phone: true }
      });
      if (user) {
        enriched.user = user;
      }
    } catch (err) {
      console.error(`[SOCKET_NORMALIZE] Failed to fetch user ${enriched.userId}:`, err.message);
    }
  }

  // Normalize mobile number
  let displayMobile = enriched.mobile;
  if (!displayMobile && enriched.user?.phone) {
    displayMobile = enriched.user.phone;
  }
  if (!displayMobile && enriched.user?.email) {
    displayMobile = enriched.user.email;
  }
  if (!displayMobile) {
    displayMobile = "System";
  }
  enriched.mobile = displayMobile;

  // Normalize provider name
  let displayProvider = enriched.provider;
  if (!displayProvider) {
    if (enriched.paymentGateway) {
      displayProvider = enriched.paymentGateway;
    } else if (enriched.type === "TOPUP") {
      displayProvider = "NexGATE";
    } else {
      displayProvider = enriched.type || "SYSTEM";
    }
  }
  enriched.provider = displayProvider;

  return enriched;
};

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
  eventBus.on("recharge_queued", async (data) => {
    let transaction = data.transaction;
    const txnId = data.txnId || data.transactionId;
    if (!transaction && txnId) {
      transaction = await prisma.transaction.findUnique({
        where: { id: Number(txnId) }
      });
    }
    const enrichedTxn = await enrichAndNormalizeTransaction(transaction);

    const updateData = {
      ...data,
      transactionId: txnId,
      status: data.status || "PENDING_REVIEW",
      transaction: enrichedTxn
    };

    const payload = safeTransactionPayloadV1({ ...data, transaction: enrichedTxn });
    const updatePayload = safeTransactionPayloadV1(updateData);

    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_queued", payload);
      io.to(data.userId.toString()).emit("recharge_update", updatePayload);
    }
    adminNamespace.emit("recharge_queued", payload);
    adminNamespace.emit("recharge_update", updatePayload);
  });

  eventBus.on("recharge_processing", async (data) => {
    let transaction = data.transaction;
    const txnId = data.txnId || data.transactionId;
    if (!transaction && txnId) {
      transaction = await prisma.transaction.findUnique({
        where: { id: Number(txnId) }
      });
    }
    const enrichedTxn = await enrichAndNormalizeTransaction(transaction);

    const updateData = {
      ...data,
      transactionId: txnId,
      status: data.status || "PROCESSING",
      transaction: enrichedTxn
    };

    const payload = safeTransactionPayloadV1({ ...data, transaction: enrichedTxn });
    const updatePayload = safeTransactionPayloadV1(updateData);

    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_processing", payload);
      io.to(data.userId.toString()).emit("recharge_update", updatePayload);
    }
    adminNamespace.emit("recharge_processing", payload);
    adminNamespace.emit("recharge_update", updatePayload);
  });

  eventBus.on("recharge_pending", async (data) => {
    let transaction = data.transaction;
    const txnId = data.txnId || data.transactionId;
    if (!transaction && txnId) {
      transaction = await prisma.transaction.findUnique({
        where: { id: Number(txnId) }
      });
    }
    const enrichedTxn = await enrichAndNormalizeTransaction(transaction);

    const updateData = {
      ...data,
      transactionId: txnId,
      status: data.status,
      transaction: enrichedTxn
    };

    const payload = safeTransactionPayloadV1({ ...data, transaction: enrichedTxn });
    const updatePayload = safeTransactionPayloadV1(updateData);

    console.log(`[SOCKET_EVENT] Emitting recharge_pending & recharge_update for Txn: ${updateData.transactionId}`);
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_pending", payload);
      io.to(data.userId.toString()).emit("recharge_update", updatePayload);
    }
    adminNamespace.emit("recharge_pending", payload);
    adminNamespace.emit("recharge_update", updatePayload);
  });

  eventBus.on("recharge_success", async (data) => {
    let transaction = data.transaction;
    const txnId = data.transactionId || data.txnId;
    if (!transaction && txnId) {
      transaction = await prisma.transaction.findUnique({
        where: { id: Number(txnId) }
      });
    }
    const enrichedTxn = await enrichAndNormalizeTransaction(transaction);

    const updateData = {
      ...data,
      transactionId: txnId,
      status: data.status,
      transaction: enrichedTxn
    };

    const payload = safeTransactionPayloadV1({ ...data, transaction: enrichedTxn });
    const updatePayload = safeTransactionPayloadV1(updateData);

    console.log(`[SOCKET_EVENT] Emitting recharge_success & recharge_update for Txn: ${updateData.transactionId}`);
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_success", payload);
      io.to(data.userId.toString()).emit("recharge_update", updatePayload);
    }
    adminNamespace.emit("recharge_success", payload);
    adminNamespace.emit("recharge_update", updatePayload);
  });
  
  eventBus.on("recharge_failed", async (data) => {
    let transaction = data.transaction;
    const txnId = data.transactionId || data.txnId;
    if (!transaction && txnId) {
      transaction = await prisma.transaction.findUnique({
        where: { id: Number(txnId) }
      });
    }
    const enrichedTxn = await enrichAndNormalizeTransaction(transaction);

    const updateData = {
      ...data,
      transactionId: txnId,
      status: data.status,
      transaction: enrichedTxn
    };

    const payload = safeTransactionPayloadV1({ ...data, transaction: enrichedTxn });
    const updatePayload = safeTransactionPayloadV1(updateData);

    console.log(`[SOCKET_EVENT] Emitting recharge_failed & recharge_update for Txn: ${updateData.transactionId}`);
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_failed", payload);
      io.to(data.userId.toString()).emit("recharge_update", updatePayload);
    }
    adminNamespace.emit("recharge_failed", payload);
    adminNamespace.emit("recharge_update", updatePayload);
  });

  eventBus.on("refund_completed", async (data) => {
    let transaction = data.transaction;
    const txnId = data.txnId || data.transactionId;
    if (!transaction && txnId) {
      transaction = await prisma.transaction.findUnique({
        where: { id: Number(txnId) }
      });
    }
    const enrichedTxn = await enrichAndNormalizeTransaction(transaction);

    const updateData = {
      ...data,
      transactionId: txnId,
      status: data.status || "REFUNDED",
      transaction: enrichedTxn
    };

    const payload = safeTransactionPayloadV1({ ...data, transaction: enrichedTxn });
    const updatePayload = safeTransactionPayloadV1(updateData);

    if (data.userId) {
      io.to(data.userId.toString()).emit("refund_completed", payload);
      io.to(data.userId.toString()).emit("recharge_update", updatePayload);
    }
    adminNamespace.emit("refund_completed", payload);
    adminNamespace.emit("recharge_update", updatePayload);
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
  eventBus.on("transaction_updated", async (data) => {
    let transaction = data.transaction;
    const txnId = data.transactionId || data.txnId;
    if (!transaction && txnId) {
      transaction = await prisma.transaction.findUnique({
        where: { id: Number(txnId) }
      });
    }
    const enrichedTxn = await enrichAndNormalizeTransaction(transaction);

    const updateData = {
      ...data,
      transactionId: txnId,
      status: data.status?.toLowerCase(),
      transaction: enrichedTxn
    };

    const payload = safeTransactionPayloadV1({ ...data, transaction: enrichedTxn });
    const updatePayload = safeTransactionPayloadV1(updateData);

    console.log(`[SOCKET_EVENT] Emitting transaction_updated & recharge_update for Txn: ${updatePayload.transactionId}`);
    if (data.userId) {
      io.to(data.userId.toString()).emit("transaction_updated", payload);
      io.to(data.userId.toString()).emit("recharge_update", updatePayload);
    } else {
      io.emit("transaction_updated", payload);
      io.emit("recharge_update", updatePayload);
    }
    adminNamespace.emit("transaction_updated", payload);
    adminNamespace.emit("recharge_update", updatePayload);
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
