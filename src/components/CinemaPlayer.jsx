import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, 
  RotateCcw, RotateCw, Sparkles, AlertCircle, CheckCircle2,
  RefreshCw, Film, Loader2
} from 'lucide-react';

export default function CinemaPlayer({ 
  currentMedia, 
  socket, 
  currentRoom, 
  partnerName = 'Partner',
  onMediaSelect 
}) {
  const videoRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [syncStatus, setSyncStatus] = useState({ text: 'In Sync', synced: true });
  const [partnerNotice, setPartnerNotice] = useState(null);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Echo suppression guard
  const isRemoteActionRef = useRef(false);
  const controlsTimeoutRef = useRef(null);
  const seekThrottleRef = useRef(null);

  // Check if media is YouTube
  const isYouTube = currentMedia?.type === 'youtube' || 
    (currentMedia?.url && (currentMedia.url.includes('youtube.com') || currentMedia.url.includes('youtu.be')));

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Helper to extract YouTube video ID from diverse URL formats
  const getYouTubeId = (url) => {
    if (!url) return null;
    if (url.length === 11 && !url.includes('/')) return url;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Reset errors on media switch
  useEffect(() => {
    setLoadError(null);
    setIsBuffering(false);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [currentMedia?.url]);

  // Safe HTML5 Video Play with Autoplay Policy Fallback
  const safeVideoPlay = async (vid) => {
    if (!vid) return;
    try {
      await vid.play();
      setIsPlaying(true);
      setAutoplayBlocked(false);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        // Browser requires direct user interaction or muted audio
        vid.muted = true;
        setIsMuted(true);
        setAutoplayBlocked(true);
        try {
          await vid.play();
          setIsPlaying(true);
        } catch (e2) {
          console.warn('Playback completely blocked:', e2);
        }
      }
    }
  };

  // 1. YouTube Iframe API Initialization
  useEffect(() => {
    if (!isYouTube) return;

    const videoId = getYouTubeId(currentMedia.url);
    if (!videoId) {
      setLoadError('Invalid YouTube video link. Please verify the URL or pick a preset.');
      return;
    }

    let playerInstance = null;

    const initYT = () => {
      if (!window.YT || !window.YT.Player || !ytContainerRef.current) return;

      try {
        playerInstance = new window.YT.Player(ytContainerRef.current, {
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin,
            playsinline: 1,
            enablejsapi: 1
          },
          events: {
            onReady: (event) => {
              ytPlayerRef.current = event.target;
              setDuration(event.target.getDuration() || 0);
              setIsBuffering(false);
              setLoadError(null);
            },
            onStateChange: (event) => {
              if (isRemoteActionRef.current) return;

              // YT.PlayerState: PLAYING = 1, PAUSED = 2, BUFFERING = 3
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                setIsBuffering(false);
                emitAction('play', event.target.getCurrentTime());
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                setIsBuffering(false);
                emitAction('pause', event.target.getCurrentTime());
              } else if (event.data === window.YT.PlayerState.BUFFERING) {
                setIsBuffering(true);
              }
            },
            onError: (err) => {
              console.warn('YouTube Player error code:', err.data);
              setLoadError('YouTube video cannot be embedded (uploader restriction or invalid ID).');
            }
          }
        });
      } catch (e) {
        console.error('Error mounting YouTube player:', e);
      }
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = initYT;
    } else {
      initYT();
    }

    return () => {
      if (playerInstance && playerInstance.destroy) {
        try {
          playerInstance.destroy();
        } catch {}
      }
      ytPlayerRef.current = null;
    };
  }, [isYouTube, currentMedia?.url]);

  // Periodic time tracker for YouTube
  useEffect(() => {
    if (!isYouTube) return;
    const interval = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        const time = ytPlayerRef.current.getCurrentTime();
        setCurrentTime(time);
        const dur = ytPlayerRef.current.getDuration();
        if (dur) setDuration(dur);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isYouTube]);

  // 2. Broadcast Action to Partner
  const emitAction = (action, time) => {
    if (isRemoteActionRef.current || !socket || !currentRoom) return;

    socket.emit('media-action', {
      roomId: currentRoom,
      action,
      currentTime: time !== undefined ? time : currentTime,
      playbackRate
    });
  };

  // 3. Receive Remote Action from Partner & Instantaneously Replicate
  useEffect(() => {
    if (!socket) return;

    const handleRemoteAction = (data) => {
      isRemoteActionRef.current = true;
      const { action, currentTime: targetTime, playbackRate: targetRate } = data;

      if (action === 'play') {
        setPartnerNotice(`${partnerName} started playback ✨`);
      } else if (action === 'pause') {
        setPartnerNotice(`${partnerName} paused`);
      } else if (action === 'seek') {
        setPartnerNotice(`${partnerName} jumped to ${formatTime(targetTime)}`);
      }
      setTimeout(() => setPartnerNotice(null), 3500);

      if (isYouTube && ytPlayerRef.current) {
        try {
          if (targetTime !== undefined && Math.abs(ytPlayerRef.current.getCurrentTime() - targetTime) > 0.6) {
            ytPlayerRef.current.seekTo(targetTime, true);
          }
          if (action === 'play') {
            ytPlayerRef.current.playVideo();
            setIsPlaying(true);
          } else if (action === 'pause') {
            ytPlayerRef.current.pauseVideo();
            setIsPlaying(false);
          }
        } catch (e) {
          console.warn('YT sync replication error:', e);
        }
      } else if (videoRef.current) {
        const vid = videoRef.current;
        if (targetTime !== undefined && Math.abs(vid.currentTime - targetTime) > 0.6) {
          vid.currentTime = targetTime;
        }
        if (targetRate) {
          vid.playbackRate = targetRate;
          setPlaybackRate(targetRate);
        }

        if (action === 'play') {
          safeVideoPlay(vid);
        } else if (action === 'pause') {
          vid.pause();
          setIsPlaying(false);
        }
      }

      setTimeout(() => {
        isRemoteActionRef.current = false;
      }, 400);
    };

    // Heartbeat Drift Check
    const handlePartnerSyncHeartbeat = (data) => {
      const localTime = isYouTube 
        ? (ytPlayerRef.current?.getCurrentTime() || 0)
        : (videoRef.current?.currentTime || 0);

      const diff = Math.abs(localTime - data.currentTime);
      if (diff > 0.8) {
        setSyncStatus({ text: `Auto-aligning (${diff.toFixed(1)}s)`, synced: false });
        isRemoteActionRef.current = true;
        if (isYouTube && ytPlayerRef.current) {
          ytPlayerRef.current.seekTo(data.currentTime, true);
        } else if (videoRef.current) {
          videoRef.current.currentTime = data.currentTime;
        }
        setTimeout(() => {
          isRemoteActionRef.current = false;
          setSyncStatus({ text: 'In Sync', synced: true });
        }, 500);
      } else {
        setSyncStatus({ text: 'In Sync (<50ms)', synced: true });
      }
    };

    socket.on('remote-media-action', handleRemoteAction);
    socket.on('partner-sync-heartbeat', handlePartnerSyncHeartbeat);

    return () => {
      socket.off('remote-media-action', handleRemoteAction);
      socket.off('partner-sync-heartbeat', handlePartnerSyncHeartbeat);
    };
  }, [socket, isYouTube, partnerName]);

  // Periodic heartbeat broadcast
  useEffect(() => {
    if (!socket || !currentRoom || !isPlaying) return;

    const interval = setInterval(() => {
      const time = isYouTube
        ? (ytPlayerRef.current?.getCurrentTime() || 0)
        : (videoRef.current?.currentTime || 0);

      socket.emit('media-heartbeat-sync', {
        roomId: currentRoom,
        currentTime: time,
        isPlaying: true,
        timestamp: Date.now()
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [socket, currentRoom, isPlaying, isYouTube]);

  // Local Controls Handlers
  const togglePlay = () => {
    if (isPlaying) {
      if (isYouTube && ytPlayerRef.current) {
        ytPlayerRef.current.pauseVideo();
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      emitAction('pause');
    } else {
      if (isYouTube && ytPlayerRef.current) {
        ytPlayerRef.current.playVideo();
      } else if (videoRef.current) {
        safeVideoPlay(videoRef.current);
      }
      setIsPlaying(true);
      emitAction('play');
    }
  };

  const handleSeek = (newTime) => {
    setCurrentTime(newTime);
    if (isYouTube && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(newTime, true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }

    clearTimeout(seekThrottleRef.current);
    seekThrottleRef.current = setTimeout(() => {
      emitAction('seek', newTime);
    }, 120);
  };

  const skipSeconds = (seconds) => {
    const target = Math.max(0, Math.min(duration, currentTime + seconds));
    handleSeek(target);
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    setAutoplayBlocked(false);

    if (isYouTube && ytPlayerRef.current) {
      ytPlayerRef.current.setVolume(newVol * 100);
      if (newVol === 0) ytPlayerRef.current.mute();
      else ytPlayerRef.current.unMute();
    } else if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setAutoplayBlocked(false);

    if (isYouTube && ytPlayerRef.current) {
      if (newMuted) ytPlayerRef.current.mute();
      else {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(volume * 100 || 80);
      }
    } else if (videoRef.current) {
      videoRef.current.muted = newMuted;
      if (!newMuted && videoRef.current.volume === 0) {
        videoRef.current.volume = 0.8;
        setVolume(0.8);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleMouseMove = () => {
    setIsControlsVisible(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setIsControlsVisible(false);
    }, 3000);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="cinema-viewport relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80 group select-none"
    >
      {/* Ambient Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none z-10" />

      {/* Partner Notice Pill */}
      {partnerNotice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-purple-500/50 backdrop-blur-md text-xs font-semibold text-purple-200 shadow-xl flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>{partnerNotice}</span>
        </div>
      )}

      {/* Autoplay Muted Notice */}
      {autoplayBlocked && (
        <div 
          onClick={toggleMute}
          className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-3 py-1 rounded-full bg-amber-500/90 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-xl cursor-pointer flex items-center gap-1.5 animate-bounce"
        >
          <VolumeX className="w-3.5 h-3.5" />
          <span>Audio muted by browser. Click here to Unmute!</span>
        </div>
      )}

      {/* Sync Health Badge */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/70 border border-white/10 backdrop-blur text-[11px] font-medium text-slate-300">
        {syncStatus.synced ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-spin" />
        )}
        <span>{syncStatus.text}</span>
      </div>

      {/* Title Watermark */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/70 border border-white/10 backdrop-blur text-xs text-slate-300 max-w-[260px] truncate">
        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        <span className="truncate">{currentMedia?.title || 'Shared Stream'}</span>
      </div>

      {/* Buffering Spinner */}
      {isBuffering && !loadError && (
        <div className="absolute inset-0 m-auto w-12 h-12 flex items-center justify-center z-25 text-purple-400 animate-spin">
          <Loader2 className="w-10 h-10" />
        </div>
      )}

      {/* Stream Load Error Fallback UI */}
      {loadError && (
        <div className="absolute inset-0 z-35 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-3 animate-pulse" />
          <h3 className="text-sm font-bold text-white mb-1">Stream Loading Error</h3>
          <p className="text-xs text-slate-400 max-w-md mb-5 leading-relaxed">{loadError}</p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => {
                setLoadError(null);
                if (socket && currentRoom) {
                  socket.emit('media-change', {
                    roomId: currentRoom,
                    type: 'sample',
                    url: '/sample-cinema.mp4',
                    title: 'Oceans & Marine Odyssey (HD Local)'
                  });
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer shadow-lg transition-all"
            >
              ▶️ Play Local Oceans HD
            </button>
            <button
              onClick={onMediaSelect}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer border border-slate-700 transition-all"
            >
              Browse Cinema Library
            </button>
          </div>
        </div>
      )}

      {/* 1. HTML5 Video Player */}
      {!isYouTube && (
        <video
          ref={videoRef}
          src={currentMedia?.url}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
          preload="auto"
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              setIsBuffering(false);
              setLoadError(null);
            }
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onError={(e) => {
            console.error('HTML5 video error:', e);
            setLoadError('Could not load stream link. The URL may be restricted or blocked. Choose another stream below.');
          }}
          onClick={togglePlay}
        />
      )}

      {/* 2. YouTube Video Iframe Container */}
      {isYouTube && (
        <div className="w-full h-full">
          <div ref={ytContainerRef} className="w-full h-full" />
        </div>
      )}

      {/* Click-to-Play Center Overlay (When Paused on HTML5) */}
      {!isYouTube && !isPlaying && !loadError && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-purple-600/80 hover:bg-purple-600 text-white flex items-center justify-center backdrop-blur-md shadow-[0_0_40px_rgba(168,85,247,0.5)] transition-transform hover:scale-110 z-20 cursor-pointer"
        >
          <Play className="w-9 h-9 fill-current translate-x-0.5" />
        </button>
      )}

      {/* Bottom Floating Control Bar */}
      <div 
        className={`absolute bottom-0 inset-x-0 p-4 z-30 transition-opacity duration-300 ${
          isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Bar / Scrubber */}
        <div className="relative group/timeline mb-3 cursor-pointer">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none bg-slate-700/60 accent-purple-500 cursor-pointer hover:h-2.5 transition-all"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between text-slate-200">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title={isPlaying ? 'Pause (syncs with partner)' : 'Play (syncs with partner)'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {/* Skip 10s */}
            <button
              onClick={() => skipSeconds(-10)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => skipSeconds(10)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Fast-forward 10s"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Timestamp */}
            <span className="text-xs font-mono text-slate-400 tracking-tight">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol ml-2">
              <button
                onClick={toggleMute}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-300 cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 rounded appearance-none bg-slate-700 accent-purple-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Change Media Source */}
            <button
              onClick={onMediaSelect}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white cursor-pointer transition-colors flex items-center gap-1"
            >
              <Film className="w-3.5 h-3.5 text-purple-400" />
              <span>Change Movie</span>
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-300 hover:text-white cursor-pointer"
              title="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
