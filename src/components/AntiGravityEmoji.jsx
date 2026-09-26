import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Heart, Flame, Sparkles, Smile, Popcorn, Plus } from 'lucide-react';

const PRESET_EMOJIS = [
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '🔥', label: 'Hype' },
  { emoji: '🍿', label: 'Popcorn' },
  { emoji: '🥺', label: 'Tears' },
  { emoji: '😱', label: 'Shock' },
  { emoji: '✨', label: 'Sparkle' },
  { emoji: '🥂', label: 'Cheers' }
];

export default function AntiGravityEmoji({ socket, currentRoom, partnerName = 'Partner', myName = 'You' }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animFrameRef = useRef(null);
  const [combo, setCombo] = useState(0);
  const [lastEmoji, setLastEmoji] = useState(null);
  const comboTimerRef = useRef(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('');

  // Spawn physics-based particles
  const spawnParticles = useCallback((emoji, xRatio = 0.5, count = 1, isRemote = false, senderName = '') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    const originX = Math.max(40, Math.min(width - 40, width * xRatio));

    for (let i = 0; i < count; i++) {
      // Small horizontal scatter around anchor
      const scatterX = (Math.random() - 0.5) * 60;
      const initialY = height - 20 - Math.random() * 30;

      particlesRef.current.push({
        x: originX + scatterX,
        y: initialY,
        startX: originX + scatterX,
        // Anti-gravity velocity (negative Y is upward)
        vy: -(3.5 + Math.random() * 3.5),
        ay: -(0.02 + Math.random() * 0.03), // Continual upward acceleration
        wobbleSpeed: 0.03 + Math.random() * 0.04,
        wobbleAmp: 15 + Math.random() * 30,
        wobblePhase: Math.random() * Math.PI * 2,
        rotation: (Math.random() - 0.5) * 0.4,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        size: 32 + Math.random() * 20,
        opacity: 1,
        fadeSpeed: 0.007 + Math.random() * 0.005,
        emoji,
        isRemote,
        senderName: isRemote ? (senderName || 'Partner') : null
      });
    }
  }, []);

  // Listen for remote partner reactions
  useEffect(() => {
    if (!socket) return;

    const handleRemoteReaction = (data) => {
      spawnParticles(data.emoji, data.xRatio, data.count || 1, true, data.senderName);
    };

    socket.on('remote-reaction', handleRemoteReaction);

    return () => {
      socket.off('remote-reaction', handleRemoteReaction);
    };
  }, [socket, spawnParticles]);

  // Main canvas animation loop with anti-gravity physics simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Handle high DPI
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let running = true;

    const render = () => {
      if (!running) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Anti-gravity physics integration
        p.vy += p.ay; // accelerate upward
        p.y += p.vy;
        p.wobblePhase += p.wobbleSpeed;
        p.x = p.startX + Math.sin(p.wobblePhase) * p.wobbleAmp;
        p.rotation += p.rotSpeed;
        p.opacity -= p.fadeSpeed;

        if (p.y < -50 || p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        // Partner visual aura
        if (p.isRemote) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(236, 72, 153, 0.15)'; // Rose aura for partner
          ctx.fill();
        }

        // Draw emoji
        ctx.font = `${p.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);

        // Optional badge for remote sender on initial float
        if (p.isRemote && p.senderName && p.opacity > 0.6) {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = 'rgba(244, 114, 182, 0.9)';
          ctx.fillText(p.senderName, 0, p.size * 0.75);
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Handle local click on reaction anchor
  const handleReact = (emoji, event) => {
    let xRatio = 0.5;
    if (event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const parentRect = event.currentTarget.closest('.cinema-viewport')?.getBoundingClientRect();
      if (parentRect) {
        xRatio = (rect.left + rect.width / 2 - parentRect.left) / parentRect.width;
      }
    }

    // Combo system for rapid tapping
    setLastEmoji(emoji);
    setCombo((prev) => {
      const next = prev + 1;
      clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => setCombo(0), 1800);
      return next;
    });

    const count = combo > 5 ? 3 : 1;
    spawnParticles(emoji, xRatio, count, false, myName);

    if (socket && currentRoom) {
      socket.emit('anti-gravity-reaction', {
        roomId: currentRoom,
        emoji,
        xRatio,
        count
      });
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customEmoji.trim()) {
      handleReact(customEmoji.trim());
      setCustomEmoji('');
      setShowCustomPicker(false);
    }
  };

  return (
    <>
      {/* Overlaid Anti-Gravity Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-30"
      />

      {/* Floating Reaction Bar */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 p-1.5 rounded-full bg-slate-950/80 backdrop-blur-xl border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.25)] transition-all hover:border-purple-500/60">
        {PRESET_EMOJIS.map(({ emoji, label }) => (
          <button
            key={emoji}
            onClick={(e) => handleReact(emoji, e)}
            title={label}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-lg sm:text-xl transition-transform hover:scale-135 active:scale-95 bg-white/5 hover:bg-white/15 cursor-pointer relative group"
          >
            <span>{emoji}</span>
            <span className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 pointer-events-none">
              {label}
            </span>
          </button>
        ))}

        {/* Custom Emoji Button */}
        <button
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          title="Custom Emoji"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors hover:bg-white/15 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Combo Indicator */}
        {combo > 2 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-extrabold text-xs animate-bounce shadow-lg">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>{combo}x</span>
          </div>
        )}

        {/* Custom Emoji Input Popover */}
        {showCustomPicker && (
          <form
            onSubmit={handleCustomSubmit}
            className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 rounded-xl bg-slate-900/95 border border-purple-500/40 backdrop-blur-xl shadow-2xl"
          >
            <input
              type="text"
              placeholder="Paste emoji..."
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)}
              className="w-28 px-2 py-1 bg-slate-800 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
              autoFocus
            />
            <button
              type="submit"
              className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded cursor-pointer"
            >
              Float
            </button>
          </form>
        )}
      </div>
    </>
  );
}
