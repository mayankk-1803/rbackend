import { Server } from "socket.io";
import eventBus from "./eventBus.js";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Configure safely in production
    },
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  const adminNamespace = io.of("/admin");

  adminNamespace.on("connection", (socket) => {
    console.log(`Admin connected to dashboard: ${socket.id}`);
    
    socket.on("disconnect", () => {
      console.log(`Admin disconnected: ${socket.id}`);
    });
  });

  // Listen to inner-service events and broadcast them to everyone (User + Admin)
  eventBus.on("recharge_success", (data) => {
    io.emit("recharge_update", { txnId: data.txnId, status: "success", transaction: data.transaction });
    adminNamespace.emit("recharge_success", data);
  });

  eventBus.on("recharge_failed", (data) => {
    io.emit("recharge_update", { txnId: data.txnId, status: "failed", failureReason: data.alert || data.reason });
    adminNamespace.emit("recharge_failed", data);
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
    // This allows calling io.emit() without crashing
    return {
      emit: (event, data) => {
        console.log(`[SOCKET MOCK] Emitting ${event}:`, data);
        eventBus.emit(event, data); // Relay through eventBus which is cross-process
      },
      of: () => ({
        emit: (event, data) => {
          console.log(`[SOCKET MOCK Namespace] Emitting ${event}:`, data);
          eventBus.emit(`namespace_${event}`, data);
        }
      })
    };
  }
  return io;
};
