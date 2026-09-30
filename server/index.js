import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';

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

/**
 * Room Registry (In-Memory, Persistent across reconnects)
 * Each room:
 *   - Max 2 permanent slots (slot1, slot2)
 *   - Each slot has: sessionToken, username, socketId (current), lastSeen
 *   - Room stays alive for 30 minutes after last person leaves (reconnect window)
 *   - Room deleted if empty for more than ROOM_TTL ms
 */

const rooms = new Map();

// Room Time-To-Live: 30 minutes after last disconnect
const ROOM_TTL = 30 * 60 * 1000;

// Clean up rooms that have been empty too long
function scheduleRoomCleanup(roomId) {
  const roomState = rooms.get(roomId);
  if (!roomState) return;

  if (roomState.cleanupTimer) {
    clearTimeout(roomState.cleanupTimer);
  }

  roomState.cleanupTimer = setTimeout(() => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Only delete if both slots are disconnected
    const slot1Active = room.slot1?.socketId && io.sockets.sockets.has(room.slot1.socketId);
    const slot2Active = room.slot2?.socketId && io.sockets.sockets.has(room.slot2.socketId);

    if (!slot1Active && !slot2Active) {
      console.log(`🗑️  Room ${roomId} expired after 30min idle. Cleaning up.`);
      rooms.delete(roomId);
    }
  }, ROOM_TTL);
}

// Get active participants list for a room
function getActiveParticipants(roomState) {
  const list = [];
  for (const slot of ['slot1', 'slot2']) {
    const s = roomState[slot];
    if (s && s.socketId && io.sockets.sockets.has(s.socketId)) {
      list.push({
        id: s.socketId,
        username: s.username,
        sessionToken: s.sessionToken,
        slot
      });
    }
  }
  return list;
}

// Find slot by session token (for reconnect)
function findSlotByToken(roomState, token) {
  if (roomState.slot1?.sessionToken === token) return 'slot1';
  if (roomState.slot2?.sessionToken === token) return 'slot2';
  return null;
}

// Get next available slot
function getAvailableSlot(roomState) {
  if (!roomState.slot1) return 'slot1';
  if (!roomState.slot2) return 'slot2';
  return null; // Room is full
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;
  let currentSlot = null;
  let currentToken = null;

  // 1. Room Joining with Persistent Session Token
  socket.on('join-room', ({ roomId, username, sessionToken }) => {
    currentRoom = roomId;
    currentUser = username || `Guest_${socket.id.substring(0, 4)}`;

    socket.join(roomId);

    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        slot1: null,
        slot2: null,
        currentMedia: {
          type: 'sample',
          url: '/sample-cinema.mp4',
          title: 'Oceans & Marine Odyssey (Cinematic HD)',
          currentTime: 0,
          isPlaying: false,
          playbackRate: 1
        },
        cleanupTimer: null,
        createdAt: Date.now()
      });
    }

    const roomState = rooms.get(roomId);

    // Cancel any pending cleanup timer since someone is joining
    if (roomState.cleanupTimer) {
      clearTimeout(roomState.cleanupTimer);
      roomState.cleanupTimer = null;
    }

    // Check if this is a RECONNECT (existing session token matching a slot)
    let assignedSlot = null;
    let assignedToken = sessionToken;
    let isReconnect = false;

    if (sessionToken) {
      const existingSlot = findSlotByToken(roomState, sessionToken);
      if (existingSlot) {
        // Valid reconnect — reclaim the slot
        assignedSlot = existingSlot;
        isReconnect = true;
        roomState[existingSlot].socketId = socket.id;
        roomState[existingSlot].username = currentUser;
        roomState[existingSlot].lastSeen = Date.now();
        console.log(`🔄 Reconnect: ${currentUser} reclaimed ${existingSlot} in room ${roomId}`);
      }
    }

    // New join (no token or token not found in this room)
    if (!assignedSlot) {
      const freeSlot = getAvailableSlot(roomState);

      if (!freeSlot) {
        // Room is FULL — reject with error
        socket.emit('room-full', {
          message: 'This room is currently full (max 2 partners). Please create a different room or wait for someone to leave.'
        });
        socket.leave(roomId);
        currentRoom = null;
        return;
      }

      // Assign new slot
      assignedToken = crypto.randomBytes(24).toString('hex');
      assignedSlot = freeSlot;
      roomState[freeSlot] = {
        socketId: socket.id,
        username: currentUser,
        sessionToken: assignedToken,
        joinedAt: Date.now(),
        lastSeen: Date.now()
      };

      console.log(`✅ New join: ${currentUser} assigned ${assignedSlot} in room ${roomId}`);
    }

    currentSlot = assignedSlot;
    currentToken = assignedToken;

    const participants = getActiveParticipants(roomState);

    // Send room state back to the joining socket (including their own session token for storage)
    socket.emit('room-state', {
      media: roomState.currentMedia,
      participants,
      yourId: socket.id,
      sessionToken: assignedToken, // IMPORTANT: frontend stores this
      slot: assignedSlot,
      isReconnect
    });

    // Notify partner that someone joined/reconnected
    socket.to(roomId).emit('partner-joined', {
      id: socket.id,
      username: currentUser,
      participants,
      isReconnect
    });
  });

  // 2. Real-Time Media Synchronization Protocol (unchanged)
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
    socket.to(currentRoom).emit('remote-media-action', {
      action: data.action,
      currentTime: data.currentTime,
      playbackRate: data.playbackRate || 1,
      senderId: socket.id,
      timestamp: Date.now()
    });
  });

  socket.on('media-heartbeat-sync', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('partner-sync-heartbeat', {
      currentTime: data.currentTime,
      isPlaying: data.isPlaying,
      senderId: socket.id,
      clientTimestamp: data.timestamp
    });
  });

  // 3. Anti-Gravity Reactions
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

  // 4. E2EE Chat
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

  // 5. WebRTC P2P Signaling
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

  // Typing indicator
  socket.on('user-typing', ({ isTyping }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('partner-typing', {
      senderId: socket.id,
      username: currentUser,
      isTyping
    });
  });

  // Disconnect — do NOT delete slot immediately, allow reconnect window
  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const roomState = rooms.get(currentRoom);

      // Update slot with lastSeen but keep the slot alive for reconnect
      if (currentSlot && roomState[currentSlot]?.socketId === socket.id) {
        roomState[currentSlot].socketId = null; // Mark as disconnected but preserve token
        roomState[currentSlot].lastSeen = Date.now();
        console.log(`👋 ${currentUser} disconnected from slot ${currentSlot} in room ${currentRoom}. Slot reserved for 30min.`);
      }

      const remaining = getActiveParticipants(roomState);
      socket.to(currentRoom).emit('partner-left', {
        id: socket.id,
        username: currentUser,
        participants: remaining,
        canRejoin: true // Tell partner this was a disconnect, not a deliberate leave
      });

      // Schedule room cleanup if everyone is gone
      if (remaining.length === 0) {
        scheduleRoomCleanup(currentRoom);
      }
    }
  });
});

// REST API: Room status check
app.get('/api/room/:roomId', (req, res) => {
  const roomState = rooms.get(req.params.roomId);
  if (!roomState) {
    return res.json({ exists: false, canJoin: true });
  }

  const activeCount = getActiveParticipants(roomState).length;
  const totalSlots = (roomState.slot1 ? 1 : 0) + (roomState.slot2 ? 1 : 0);

  res.json({
    exists: true,
    canJoin: totalSlots < 2,
    activeParticipants: activeCount,
    totalSlots,
    isFull: totalSlots >= 2
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

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🍿 FlixTogether Privacy Signaling Server running on http://localhost:${PORT}`);
});
