import { Server } from "socket.io";
import eventBus from "./eventBus.js";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Configure safely in production
    },
  });

  const adminNamespace = io.of("/admin");

  adminNamespace.on("connection", (socket) => {
    console.log(`Admin connected to dashboard: ${socket.id}`);
    
    socket.on("disconnect", () => {
      console.log(`Admin disconnected: ${socket.id}`);
    });
  });

  // Listen to inner-service events and broadcast them to admins
  eventBus.on("recharge_success", (data) => adminNamespace.emit("recharge_success", data));
  eventBus.on("recharge_failed", (data) => adminNamespace.emit("recharge_failed", data));
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
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
