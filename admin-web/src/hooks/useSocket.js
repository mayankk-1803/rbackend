import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL 
  ? `${import.meta.env.VITE_SOCKET_URL}/admin` 
  : 'https://rchserver.irecharge.in/admin';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    const socketInstance = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('Admin Web Socket Connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Admin Web Socket Disconnected');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Safe wrapper for listing to events to avoid duplicate listeners easily
  const useSocketEvent = useCallback((event, callback) => {
    useEffect(() => {
      if (!socket) return;
      socket.on(event, callback);
      return () => {
        socket.off(event, callback);
      };
    }, [socket, event, callback]);
  }, [socket]);

  return { socket, isConnected, useSocketEvent };
};
