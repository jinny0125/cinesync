import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    // In production or development with proxy
    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:4000' 
      : window.location.origin;

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: false
    });
  }
  return socket;
}
