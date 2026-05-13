import { Server } from "socket.io";
import eventBus from "./eventBus.js";

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
  eventBus.on("recharge_pending", (data) => {
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_pending", data);
    }
    adminNamespace.emit("recharge_pending", data);
  });

  eventBus.on("recharge_success", (data) => {
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_success", data);
    }
    adminNamespace.emit("recharge_success", data);
  });
  
  eventBus.on("recharge_failed", (data) => {
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_failed", data);
    }
    adminNamespace.emit("recharge_failed", data);
  });

  eventBus.on("wallet_updated", (data) => {
    if (data.userId) {
      io.to(data.userId.toString()).emit("wallet_updated", data);
    }
  });

  // Legacy/Global fallback
  eventBus.on("recharge_update", (data) => {
    if (data.userId) {
      io.to(data.userId.toString()).emit("recharge_update", data);
    } else {
      io.emit("recharge_update", data);
    }
  });

  eventBus.on("provider_status", (data) => adminNamespace.emit("provider_status", data));
  eventBus.on("fraud_alert", (data) => adminNamespace.emit("fraud_alert", data));
  
  // New events for health and blacklisting
  eventBus.on("provider_health_update", (data) => adminNamespace.emit("provider_health_update", data));
  eventBus.on("provider_down_alert", (data) => adminNamespace.emit("provider_down_alert", data));
  eventBus.on("provider_blacklisted", (data) => adminNamespace.emit("provider_blacklisted", data));
  
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
