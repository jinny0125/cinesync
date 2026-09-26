import React, { useState, useEffect } from 'react';
import { Film, Lock, Shield, Sparkles, Heart, Users, Copy, Check, ArrowRight } from 'lucide-react';
import { generateRandomPassphrase } from '../utils/crypto';

export default function RoomLobby({ onJoinRoom }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [copied, setCopied] = useState(false);

  // Auto-detect invite link parameters in URL hash or search params
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const urlRoom = params.get('room');
    const urlKey = params.get('key');

    if (urlRoom) setRoomId(urlRoom);
    if (urlKey) setPassphrase(urlKey);
    else if (!passphrase) {
      setPassphrase(generateRandomPassphrase());
    }

    if (!roomId && !urlRoom) {
      const randomRoomId = `flix-${Math.floor(100 + Math.random() * 900)}`;
      setRoomId(randomRoomId);
    }
  }, []);

  const handleCreateNewRoom = () => {
    const newRoom = `flix-${Math.floor(100 + Math.random() * 900)}`;
    setRoomId(newRoom);
    setPassphrase(generateRandomPassphrase());
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim() || !passphrase.trim()) return;

    onJoinRoom({
      username: username.trim(),
      roomId: roomId.trim().toLowerCase(),
      passphrase: passphrase.trim()
    });
  };

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}#room=${encodeURIComponent(roomId)}&key=${encodeURIComponent(passphrase)}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-[#06080d]">
      {/* Ambient Cinema Backdrop Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium mb-3 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Anti-Gravity Cinema & P2P Sanctuary</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Flix<span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">Together</span>
          </h1>
          <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
            Real-time movie nights for long-distance partners & close friends. Zero-delay sync, anti-gravity floating reactions, and shielded privacy.
          </p>
        </div>

        {/* Setup Card */}
        <div className="bg-slate-900/70 border border-purple-500/20 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>Your Name / Nickname</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Maya or Leo"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Room ID Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-pink-400" />
                  <span>Cinema Room ID</span>
                </label>
                <button
                  type="button"
                  onClick={handleCreateNewRoom}
                  className="text-[11px] text-purple-400 hover:text-purple-300 cursor-pointer"
                >
                  Generate New
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="e.g. flix-402"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-mono text-purple-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* E2EE Passphrase */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>E2EE Shield Key (AES-256)</span>
                </label>
                <span className="text-[10px] text-emerald-400/90 font-mono">In-Browser Key</span>
              </div>
              <input
                type="text"
                required
                placeholder="Secret key or phrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-mono text-emerald-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Quick Share Invite Link */}
            <div className="pt-1">
              <button
                type="button"
                onClick={copyInviteLink}
                className="w-full py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
                <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Partner Invite Link'}</span>
              </button>
            </div>

            {/* Enter Cinema Button */}
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2 group"
            >
              <span>Enter Private Cinema Sanctuary</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Privacy & Feature Highlights */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 text-center">
            <div className="p-2 rounded-xl bg-slate-800/30">
              <Shield className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
              <span>AES-256 E2EE Chat</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/30">
              <Film className="w-3.5 h-3.5 text-purple-400 mx-auto mb-1" />
              <span>Zero-Lag Sync Lock</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/30">
              <Heart className="w-3.5 h-3.5 text-pink-400 mx-auto mb-1" />
              <span>Anti-Gravity Reactions</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
