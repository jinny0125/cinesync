import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Send, Lock, EyeOff, Info, Sparkles } from 'lucide-react';
import { encryptText, decryptText } from '../utils/crypto';

export default function E2EEChat({ 
  socket, 
  currentRoom, 
  cryptoKey, 
  fingerprint, 
  currentUser, 
  partnerName = 'Partner' 
}) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const [showShieldModal, setShowShieldModal] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, partnerIsTyping]);

  // Handle incoming encrypted messages
  useEffect(() => {
    if (!socket || !cryptoKey) return;

    const handleEncryptedMessage = async (data) => {
      try {
        const plainText = await decryptText(data.ciphertext, data.iv, cryptoKey);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            text: plainText,
            senderId: data.senderId,
            senderName: data.senderName || partnerName,
            isMe: false,
            timestamp: data.timestamp || Date.now(),
            ciphertextSample: data.ciphertext.substring(0, 16) + '...'
          }
        ]);
      } catch (err) {
        console.error('Decryption failed on incoming message:', err);
      }
    };

    const handlePartnerTyping = (data) => {
      setPartnerIsTyping(data.isTyping);
    };

    socket.on('e2ee-message', handleEncryptedMessage);
    socket.on('partner-typing', handlePartnerTyping);

    return () => {
      socket.off('e2ee-message', handleEncryptedMessage);
      socket.off('partner-typing', handlePartnerTyping);
    };
  }, [socket, cryptoKey, partnerName]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!socket || !currentRoom) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('user-typing', { isTyping: true });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('user-typing', { isTyping: false });
    }, 1200);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !cryptoKey) return;

    const plainText = inputText.trim();
    setInputText('');
    setIsTyping(false);
    if (socket) socket.emit('user-typing', { isTyping: false });

    try {
      // 1. Encrypt message inside browser viewport
      const { ciphertext, iv } = await encryptText(plainText, cryptoKey);

      // 2. Transmit only ciphertext payload over WebSocket channel
      if (socket && currentRoom) {
        socket.emit('e2ee-message', {
          roomId: currentRoom,
          ciphertext,
          iv,
          senderName: currentUser
        });
      }

      // 3. Append to local conversation log
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: plainText,
          senderId: 'me',
          senderName: currentUser,
          isMe: true,
          timestamp: Date.now(),
          ciphertextSample: ciphertext.substring(0, 16) + '...'
        }
      ]);
    } catch (err) {
      console.error('Encryption failed on message send:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/80 rounded-2xl border border-slate-800 backdrop-blur-xl overflow-hidden shadow-2xl">
      {/* Privacy Shield Header */}
      <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-200">E2EE Sanctuary</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Key: <span className="text-purple-300 font-semibold">{fingerprint || 'SHIELDED'}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowShieldModal(true)}
          className="p-1 text-slate-400 hover:text-purple-300 transition-colors cursor-pointer"
          title="Privacy details"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
            <ShieldCheck className="w-8 h-8 text-purple-400/60 mb-2" />
            <p className="text-xs font-medium text-slate-400">End-to-End Encrypted Room</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
              Messages are encrypted inside your browser. The server cannot inspect or store your chats.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}
          >
            <span className="text-[10px] text-slate-400 mb-0.5 px-1">
              {msg.isMe ? 'You' : msg.senderName}
            </span>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs break-words shadow-md transition-all ${
                msg.isMe
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-none border border-purple-400/20'
                  : 'bg-slate-800/90 text-slate-100 rounded-bl-none border border-slate-700'
              }`}
            >
              {msg.text}
            </div>
            <div className="flex items-center gap-1 mt-0.5 px-1 text-[9px] text-slate-400 font-mono">
              <Lock className="w-2.5 h-2.5 text-emerald-400/60" />
              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        ))}

        {/* Partner Typing Indicator */}
        {partnerIsTyping && (
          <div className="flex items-center gap-1.5 text-xs text-purple-400/80 px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce delay-150" />
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce delay-300" />
            <span className="text-[11px] text-slate-400">{partnerName} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-2.5 border-t border-slate-800/80 bg-slate-900/40 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="Type encrypted message..."
          className="flex-1 bg-slate-800/70 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white transition-all cursor-pointer shadow-md"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Privacy Proof Modal */}
      {showShieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-md w-full bg-slate-900 border border-purple-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Zero-Knowledge Architecture Proof</span>
              </div>
              <button
                onClick={() => setShowShieldModal(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                <strong>1. Viewport Encryption:</strong> Every keystroke is encrypted natively by the Web Crypto API using <span className="text-purple-400 font-mono">AES-GCM 256-bit</span> before transmission.
              </p>
              <p>
                <strong>2. Server Blindness:</strong> The central node acts strictly as a packet pipe. It only handles ciphertext hashes like:
                <code className="block mt-1 p-2 bg-slate-950 rounded text-[10px] text-purple-300 font-mono break-all">
                  y5k2J0q...AES_GCM_96b_IV...8f2b1a9
                </code>
              </p>
              <p>
                <strong>3. Key Derivation:</strong> Keys are derived with PBKDF2 (100,000 rounds of SHA-256) and never leave your device.
              </p>
              <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-xl text-[11px] text-purple-200">
                <strong>Safety Verification Fingerprint:</strong>
                <div className="font-mono text-base font-bold text-center py-1 tracking-widest text-emerald-400">
                  {fingerprint}
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  Confirm this code matches your partner&apos;s screen to guarantee no man-in-the-middle.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowShieldModal(false)}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs rounded-xl cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
