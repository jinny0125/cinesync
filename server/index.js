import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory active room registry (strictly transient - zero persistence)
const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  // 1. Room Joining & Lifecycle
  socket.on('join-room', ({ roomId, username }) => {
    currentRoom = roomId;
    currentUser = username || `Guest_${socket.id.substring(0, 4)}`;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: new Map(),
        currentMedia: {
          type: 'sample',
          url: '/sample-cinema.mp4',
          title: 'Oceans & Marine Odyssey (Cinematic HD)',
          currentTime: 0,
          isPlaying: false,
          playbackRate: 1
        }
      });
    }

    const roomState = rooms.get(roomId);
    roomState.participants.set(socket.id, {
      id: socket.id,
      username: currentUser,
      joinedAt: Date.now()
    });

    const participantsList = Array.from(roomState.participants.values());

    // Send current room state & peer list to the joining socket
    socket.emit('room-state', {
      media: roomState.currentMedia,
      participants: participantsList,
      yourId: socket.id
    });

    // Notify other peers in room
    socket.to(roomId).emit('partner-joined', {
      id: socket.id,
      username: currentUser,
      participants: participantsList
    });
  });

  // 2. Real-Time Media Synchronization Protocol
  socket.on('media-change', (data) => {
    if (!currentRoom || !rooms.has(currentRoom)) return;
    const roomState = rooms.get(currentRoom);
    roomState.currentMedia = {
      type: data.type,
      url: data.url,
      title: data.title || 'Shared Stream',
      currentTime: 0,
      isPlaying: false,
      playbackRate: 1
    };

    socket.to(currentRoom).emit('remote-media-change', roomState.currentMedia);
  });

  socket.on('media-action', (data) => {
    if (!currentRoom || !rooms.has(currentRoom)) return;
    const roomState = rooms.get(currentRoom);
    if (roomState) {
      roomState.currentMedia.currentTime = data.currentTime;
      roomState.currentMedia.isPlaying = data.action === 'play';
      if (data.playbackRate) {
        roomState.currentMedia.playbackRate = data.playbackRate;
      }
    }

    // Replicate instantly on partner's screen
    socket.to(currentRoom).emit('remote-media-action', {
      action: data.action,
      currentTime: data.currentTime,
      playbackRate: data.playbackRate || 1,
      senderId: socket.id,
      timestamp: Date.now()
    });
  });

  socket.on('media-heartbeat-sync', (data) => {
    // Soft drift check broadcast
    if (!currentRoom) return;
    socket.to(currentRoom).emit('partner-sync-heartbeat', {
      currentTime: data.currentTime,
      isPlaying: data.isPlaying,
      senderId: socket.id,
      clientTimestamp: data.timestamp
    });
  });

  // 3. The Anti-Gravity Engagement Layer (Physics Floating Emojis)
  socket.on('anti-gravity-reaction', (reaction) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('remote-reaction', {
      emoji: reaction.emoji,
      xRatio: reaction.xRatio || 0.5,
      count: reaction.count || 1,
      senderName: currentUser,
      senderId: socket.id,
      id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    });
  });

  // 4. Dual-Layer Privacy: Client-Side E2EE Communication
  // The server only routes ciphertext. Zero-Knowledge privacy model.
  socket.on('e2ee-message', (encryptedPayload) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('e2ee-message', {
      ciphertext: encryptedPayload.ciphertext,
      iv: encryptedPayload.iv,
      salt: encryptedPayload.salt,
      senderId: socket.id,
      senderName: currentUser,
      timestamp: Date.now()
    });
  });

  // 5. Dual-Layer Privacy: WebRTC P2P Direct AV Signaling
  socket.on('p2p-signal-offer', (data) => {
    if (!currentRoom) return;
    socket.to(data.targetId || currentRoom).emit('p2p-signal-offer', {
      senderId: socket.id,
      offer: data.offer
    });
  });

  socket.on('p2p-signal-answer', (data) => {
    if (!currentRoom) return;
    socket.to(data.targetId || currentRoom).emit('p2p-signal-answer', {
      senderId: socket.id,
      answer: data.answer
    });
  });

  socket.on('p2p-signal-ice', (data) => {
    if (!currentRoom) return;
    socket.to(data.targetId || currentRoom).emit('p2p-signal-ice', {
      senderId: socket.id,
      candidate: data.candidate
    });
  });

  // Partner typing indicator
  socket.on('user-typing', ({ isTyping }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('partner-typing', {
      senderId: socket.id,
      username: currentUser,
      isTyping
    });
  });

  // Clean-up on disconnect
  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const roomState = rooms.get(currentRoom);
      roomState.participants.delete(socket.id);

      const remaining = Array.from(roomState.participants.values());
      socket.to(currentRoom).emit('partner-left', {
        id: socket.id,
        username: currentUser,
        participants: remaining
      });

      if (roomState.participants.size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FlixTogether Zero-Knowledge Signaling Server',
    activeRooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Fallback SPA routing for Express 5
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🍿 FlixTogether Privacy Signaling Server running on http://localhost:${PORT}`);
});
