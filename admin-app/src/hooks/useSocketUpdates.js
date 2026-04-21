import { useEffect, useRef } from 'react';
import socket from '../services/socket';

const useSocketUpdates = (handlers) => {
  const savedHandlers = useRef(handlers);

  // Remember the latest handlers if they change.
  useEffect(() => {
    savedHandlers.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!socket) return;

    // Create wrapper functions so we can reference the latest handler
    // without re-subscribing on every render.
    const listeningEvents = Object.keys(savedHandlers.current);
    
    const eventListeners = listeningEvents.map((eventName) => {
      const listener = (data) => {
        if (savedHandlers.current[eventName]) {
          savedHandlers.current[eventName](data);
        }
      };

      socket.on(eventName, listener);
      
      return { eventName, listener };
    });

    // Cleanup listeners on unmount
    return () => {
      eventListeners.forEach(({ eventName, listener }) => {
        socket.off(eventName, listener);
      });
    };
  }, []); // Only run once on mount
};

export default useSocketUpdates;
