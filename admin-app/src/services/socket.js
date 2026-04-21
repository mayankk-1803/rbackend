import { io } from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.5:5000/admin';

// Initialize socket connection using WebSocket transport
const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: true,
});

export default socket;
