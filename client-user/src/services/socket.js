import { io } from "socket.io-client";

// Production socket singleton
const socket = io(import.meta.env.VITE_SOCKET_URL || "https://rchserver.irecharge.in", {
  transports: ["websocket", "polling"],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  autoConnect: false,
});

export const connectSocket = (userId) => {
  if (!userId) return;
  socket.auth = { userId };
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export default socket;
