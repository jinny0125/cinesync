import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    const socketUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:4000'
      : 'https://cinesync-server-2qk.onrender.com';

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: false
    });
  }
  return socket;
}