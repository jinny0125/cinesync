import React, { useState, useEffect, useRef } from 'react';
import { 
  Film, Lock, Shield, Sparkles, Copy, Check, LogOut, 
  Heart, RefreshCw, UserCheck, AlertTriangle
} from 'lucide-react';
import RoomLobby from './components/RoomLobby';
import CinemaPlayer from './components/CinemaPlayer';
import AntiGravityEmoji from './components/AntiGravityEmoji';
import E2EEChat from './components/E2EEChat';
import WebRTCVideoCall from './components/WebRTCVideoCall';
import MediaSourceSelector from './components/MediaSourceSelector';
import { getSocket } from './utils/socket';
import { deriveKeyFromPassphrase, getFingerprint } from './utils/crypto';

// Session Storage Keys
const SESSION_KEY = 'ft_session';

function saveSession(data) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export default function App() {
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [cryptoKey, setCryptoKey] = useState(null);
  const [fingerprint, setFingerprint] = useState('');
  const [socket, setSocket] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [currentMedia, setCurrentMedia] = useState({
    type: 'sample',
    url: '/sample-cinema.mp4',
    title: 'Oceans & Marine Odyssey (Cinematic HD)'
  });
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [partnerNotification, setPartnerNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('split');
  const [roomFull, setRoomFull] = useState(false);
  const [partnerOffline, setPartnerOffline] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [isAutoRejoining, setIsAutoRejoining] = useState(false);

  // Identify partner in the room
  const partner = participants.find(p => p.id !== socket?.id);

  // On first load — check for saved session and auto-rejoin
  useEffect(() => {
    const savedSession = loadSession();
    if (!savedSession) return;

    // Try auto-rejoin silently
    setIsAutoRejoining(true);
    handleJoinRoom({
      username: savedSession.username,
      roomId: savedSession.roomId,
      passphrase: savedSession.passphrase,
      sessionToken: savedSession.sessionToken,
      silent: true
    }).finally(() => {
      setIsAutoRejoining(false);
    });
  }, []);

  // Initialize room and cryptographic keys
  const handleJoinRoom = async ({ username: user, roomId: room, passphrase: pass, sessionToken: token = null, silent = false }) => {
    setUsername(user);
    setRoomId(room);
    setPassphrase(pass);
    setRoomFull(false);

    // Derive E2EE key
    try {
      const derivedKey = await deriveKeyFromPassphrase(pass, `flixtogether-${room}`);
      setCryptoKey(derivedKey);
      const fp = await getFingerprint(derivedKey);
      setFingerprint(fp);
    } catch (err) {
      console.error('Cryptographic key derivation error:', err);
    }

    // Connect socket
    const s = getSocket();
    if (!s.connected) s.connect();
    setSocket(s);

    // Emit join with optional session token for reconnect
    s.emit('join-room', {
      roomId: room,
      username: user,
      sessionToken: token // null = new join, string = reconnect
    });

    // Update URL hash
    window.location.hash = `room=${encodeURIComponent(room)}&key=${encodeURIComponent(pass)}`;
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (state) => {
      if (state.media) setCurrentMedia(state.media);
      if (state.participants) setParticipants(state.participants);

      // Save/update session with the assigned token
      if (state.sessionToken) {
        const token = state.sessionToken;
        setSessionToken(token);
        saveSession({
          username,
          roomId,
          passphrase,
          sessionToken: token
        });
      }

      setInRoom(true);
      setRoomFull(false);

      if (state.isReconnect) {
        setPartnerNotification('✅ Reconnected to your room!');
        setTimeout(() => setPartnerNotification(null), 3500);
      }
    };

    const handlePartnerJoined = (data) => {
      setParticipants(data.participants);
      setPartnerOffline(false);

      if (data.isReconnect) {
        setPartnerNotification(`${data.username} reconnected! 🔄`);
      } else {
        setPartnerNotification(`${data.username} stepped into the sanctuary ✨`);
      }
      setTimeout(() => setPartnerNotification(null), 4000);
    };

    const handlePartnerLeft = (data) => {
      setParticipants(data.participants);
      if (data.canRejoin) {
        setPartnerOffline(true);
        setPartnerNotification(`${data.username} disconnected. Waiting for them to reconnect...`);
      } else {
        setPartnerNotification(`${data.username} left the room`);
      }
      setTimeout(() => setPartnerNotification(null), 5000);
    };

    const handleRemoteMediaChange = (media) => {
      setCurrentMedia(media);
      setPartnerNotification(`Now playing: ${media.title}`);
      setTimeout(() => setPartnerNotification(null), 4000);
    };

    const handleRoomFull = (data) => {
      setRoomFull(true);
      setInRoom(false);
    };

    // Socket reconnect — automatically rejoin room
    const handleSocketReconnect = () => {
      const savedSession = loadSession();
      if (savedSession && roomId) {
        socket.emit('join-room', {
          roomId,
          username,
          sessionToken: savedSession.sessionToken
        });
      }
    };

    socket.on('room-state', handleRoomState);
    socket.on('partner-joined', handlePartnerJoined);
    socket.on('partner-left', handlePartnerLeft);
    socket.on('remote-media-change', handleRemoteMediaChange);
    socket.on('room-full', handleRoomFull);
    socket.on('reconnect', handleSocketReconnect);

    return () => {
      socket.off('room-state', handleRoomState);
      socket.off('partner-joined', handlePartnerJoined);
      socket.off('partner-left', handlePartnerLeft);
      socket.off('remote-media-change', handleRemoteMediaChange);
      socket.off('room-full', handleRoomFull);
      socket.off('reconnect', handleSocketReconnect);
    };
  }, [socket, username, roomId, passphrase]);

  const handleLeaveRoom = () => {
    if (socket) socket.disconnect();
    setInRoom(false);
    setCryptoKey(null);
    setParticipants([]);
    setSessionToken(null);
    setPartnerOffline(false);
    clearSession(); // Clear saved session on deliberate leave
    window.location.hash = '';
  };

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}#room=${encodeURIComponent(roomId)}&key=${encodeURIComponent(passphrase)}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Auto-rejoin loading screen
  if (isAutoRejoining) {
    return (
      <div className="min-h-screen w-full bg-[#06080d] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mx-auto">
            <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
          <p className="text-white font-semibold text-sm">Rejoining your room...</p>
          <p className="text-slate-400 text-xs">Reconnecting to your FlixTogether session</p>
        </div>
      </div>
    );
  }

  // Room full error screen
  if (roomFull) {
    return (
      <div className="min-h-screen w-full bg-[#06080d] flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-5 bg-slate-900/80 border border-rose-500/30 rounded-2xl p-6 backdrop-blur-xl">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-rose-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg mb-1">Room is Full</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              This room already has 2 partners inside. FlixTogether rooms are private — max 2 people only.
            </p>
          </div>
          <button
            onClick={() => setRoomFull(false)}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl cursor-pointer transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!inRoom) {
    return <RoomLobby onJoinRoom={handleJoinRoom} />;
  }

  return (
    <div className="min-h-screen w-full bg-[#06080d] text-slate-100 flex flex-col relative selection:bg-purple-600 selection:text-white">
      <div className="cinema-ambient-glow" />

      {/* Header */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl px-4 flex items-center justify-between z-40 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
              <Film className="w-4 h-4" />
            </span>
            <span className="font-extrabold text-sm tracking-tight text-white hidden sm:inline">
              Flix<span className="text-purple-400">Together</span>
            </span>
          </div>

          {/* Room Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-purple-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>#{roomId}</span>
          </div>

          {/* Partner Status */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300">
            {partnerOffline ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="text-amber-300">Partner reconnecting...</span>
              </>
            ) : partner ? (
              <>
                <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400/40 animate-pulse" />
                <span>With {partner.username}</span>
              </>
            ) : (
              <>
                <Heart className="w-3.5 h-3.5 text-slate-500" />
                <span>Awaiting Partner...</span>
              </>
            )}
          </div>

          {/* Session Badge */}
          {sessionToken && (
            <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-mono">
              <UserCheck className="w-3 h-3" />
              <span>Session Active</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-mono">
            <Shield className="w-3.5 h-3.5" />
            <span>AES-256 E2EE</span>
          </div>

          <button
            onClick={copyInviteLink}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-purple-500/30 text-xs font-medium text-purple-300 hover:text-purple-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? 'Link Copied' : 'Invite Partner'}</span>
          </button>

          <button
            onClick={handleLeaveRoom}
            className="p-1.5 rounded-xl hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
            title="Leave room (clears session)"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Partner Notification Toast */}
      {partnerNotification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/90 border border-purple-500/50 backdrop-blur-xl text-xs font-semibold text-purple-200 shadow-2xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>{partnerNotification}</span>
        </div>
      )}

      {/* Partner Offline Banner */}
      {partnerOffline && !partner && (
        <div className="mx-3 mt-2 sm:mx-5 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>
            Your partner disconnected. Their room slot is <strong>reserved for 30 minutes</strong> — they can come back and auto-rejoin!
          </span>
        </div>
      )}

      {/* Main Cinema Workspace */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1700px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-8 flex flex-col gap-3">
          <div className="relative w-full rounded-2xl overflow-hidden">
            <CinemaPlayer
              currentMedia={currentMedia}
              socket={socket}
              currentRoom={roomId}
              partnerName={partner?.username || 'Partner'}
              onMediaSelect={() => setIsMediaModalOpen(true)}
            />
            <AntiGravityEmoji
              socket={socket}
              currentRoom={roomId}
              partnerName={partner?.username || 'Partner'}
              myName={username}
            />
          </div>

          <div className="bg-slate-950/60 rounded-2xl border border-slate-800/80 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
              <div>
                <h2 className="text-xs font-semibold text-white tracking-wide">{currentMedia.title}</h2>
                <p className="text-[11px] text-slate-400">
                  Real-time sync lock active. Actions mirror instantaneously.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsMediaModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Choose Stream
            </button>
          </div>
        </section>

        <aside className="lg:col-span-4 flex flex-col gap-3 min-h-[500px]">
          {/* Mobile Tab Switcher */}
          <div className="flex lg:hidden items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
            {['split', 'video', 'chat'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1 rounded-lg transition-all ${activeTab === tab ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
              >
                {tab === 'split' ? 'Split View' : tab === 'video' ? 'Cam Feed' : 'E2EE Chat'}
              </button>
            ))}
          </div>

          <div className={`transition-all ${activeTab === 'chat' ? 'hidden' : 'block'}`}>
            <WebRTCVideoCall
              socket={socket}
              currentRoom={roomId}
              partner={partner}
              myName={username}
            />
          </div>

          <div className={`flex-1 min-h-[380px] transition-all ${activeTab === 'video' ? 'hidden' : 'flex flex-col'}`}>
            <E2EEChat
              socket={socket}
              currentRoom={roomId}
              cryptoKey={cryptoKey}
              fingerprint={fingerprint}
              currentUser={username}
              partnerName={partner?.username || 'Partner'}
            />
          </div>
        </aside>
      </main>

      {isMediaModalOpen && (
        <MediaSourceSelector
          socket={socket}
          currentRoom={roomId}
          onSelect={(media) => setCurrentMedia(media)}
          onClose={() => setIsMediaModalOpen(false)}
        />
      )}
    </div>
  );
}
