import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, 
  Users, Shield, Wifi, RefreshCw 
} from 'lucide-react';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function WebRTCVideoCall({ socket, currentRoom, partner, myName = 'You' }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState('idle'); // idle | connecting | connected
  const [mediaError, setMediaError] = useState(null);
  const [isTestMode, setIsTestMode] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // Initialize Local Media Stream
  const startLocalMedia = async () => {
    try {
      setMediaError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 } },
        audio: true
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.warn('Could not access real camera/mic (device missing or permission denied):', err);
      setMediaError('Camera/Mic permission needed. Running in Virtual Avatar Mode.');
      setIsTestMode(true);
      return null;
    }
  };

  // Toggle Mute Audio
  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    } else {
      setIsMicOn(!isMicOn);
    }
  };

  // Toggle Video Track
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    } else {
      setIsVideoOn(!isVideoOn);
    }
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert to camera
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      const stream = await startLocalMedia();
      if (stream && peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(stream.getVideoTracks()[0]);
        }
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        setLocalStream(screenStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          }
        }

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          startLocalMedia();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen share cancelled:', err);
      }
    }
  };

  // Setup WebRTC PeerConnection
  const setupPeerConnection = (stream) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && currentRoom) {
        socket.emit('p2p-signal-ice', {
          roomId: currentRoom,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setCallStatus('connected');
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setCallStatus('idle');
      }
    };

    return pc;
  };

  // Start Call (create offer)
  const initiateCall = async () => {
    setCallStatus('connecting');
    let stream = localStream;
    if (!stream && !isTestMode) {
      stream = await startLocalMedia();
    }

    const pc = setupPeerConnection(stream);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('p2p-signal-offer', {
        roomId: currentRoom,
        offer
      });
    } catch (err) {
      console.error('Failed to create offer:', err);
      setCallStatus('idle');
    }
  };

  // Listen for WebRTC Signaling via Socket
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async (data) => {
      setCallStatus('connecting');
      let stream = localStream;
      if (!stream && !isTestMode) {
        stream = await startLocalMedia();
      }

      const pc = setupPeerConnection(stream);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('p2p-signal-answer', {
          roomId: currentRoom,
          answer
        });
      } catch (err) {
        console.error('Error handling remote offer:', err);
      }
    };

    const handleAnswer = async (data) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          setCallStatus('connected');
        } catch (err) {
          console.error('Error setting remote answer:', err);
        }
      }
    };

    const handleIceCandidate = async (data) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    };

    socket.on('p2p-signal-offer', handleOffer);
    socket.on('p2p-signal-answer', handleAnswer);
    socket.on('p2p-signal-ice', handleIceCandidate);

    return () => {
      socket.off('p2p-signal-offer', handleOffer);
      socket.off('p2p-signal-answer', handleAnswer);
      socket.off('p2p-signal-ice', handleIceCandidate);
    };
  }, [socket, currentRoom, localStream, isTestMode]);

  // Clean-up on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  return (
    <div className="bg-slate-950/80 rounded-2xl border border-slate-800 backdrop-blur-xl p-3 shadow-2xl flex flex-col gap-3">
      {/* P2P Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Wifi className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-200">Direct P2P Video</span>
              <span className={`w-1.5 h-1.5 rounded-full ${callStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
            </div>
            <p className="text-[10px] text-slate-400">Zero Server Intermediation</p>
          </div>
        </div>

        {callStatus === 'idle' && (
          <button
            onClick={initiateCall}
            className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg text-xs font-medium cursor-pointer shadow-md transition-all flex items-center gap-1"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Connect Cam</span>
          </button>
        )}
      </div>

      {/* Video Viewports Container */}
      <div className="grid grid-cols-2 gap-2">
        {/* Local Participant */}
        <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center group">
          {localStream && isVideoOn ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-500">
              <div className="w-9 h-9 rounded-full bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                {myName.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-[10px]">{isMicOn ? '🎙️ Mic Active' : 'Muted'}</span>
            </div>
          )}

          <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur text-[9px] text-slate-300 font-medium">
            You ({myName})
          </div>
        </div>

        {/* Remote Partner */}
        <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center group">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-500 text-center px-2">
              <div className="w-9 h-9 rounded-full bg-pink-900/40 border border-pink-500/30 flex items-center justify-center text-pink-300 font-bold text-xs">
                {partner ? partner.username.substring(0, 2).toUpperCase() : '??'}
              </div>
              <span className="text-[10px] text-slate-400">
                {callStatus === 'connecting' ? 'P2P Handshake...' : partner ? `${partner.username} Ready` : 'Waiting for Partner'}
              </span>
            </div>
          )}

          <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur text-[9px] text-slate-300 font-medium">
            {partner ? partner.username : 'Partner'}
          </div>
        </div>
      </div>

      {/* Notice / Status */}
      {mediaError && (
        <div className="text-[10px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
          {mediaError}
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <button
          onClick={toggleMic}
          className={`p-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
            isMicOn 
              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' 
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
          }`}
          title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
        >
          {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
            isVideoOn 
              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' 
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
          }`}
          title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`p-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
            isScreenSharing 
              ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]' 
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title="Share Screen"
        >
          <ScreenShare className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
