# 🍿 FlixTogether — Anti-Gravity Real-Time Watch Party & P2P Sanctuary

> A real-time collaborative cinema sanctuary designed to bridge the physical gap in long-distance relationships and friendships by merging low-latency media synchronization with private, intimate communication.

---

## 🌟 The 3 Foundational Pillars

### 1. ⏱️ Real-Time Media Synchronization
- **Unified Control**: When either participant clicks **Play**, **Pause**, or drags the timeline (**Seek**) on a video file or YouTube stream, the action replicates instantaneously on the partner's screen.
- **Zero Manual Alignment**: Eliminates counting down (*"3, 2, 1, play"*) over a phone call. Micro-drift reconciliation constantly checks timeline alignment and softly corrects deviations over 0.5s.
- **Echo & Feedback Suppression**: Smart action guards ensure remote actions do not bounce back into local event handlers, preventing infinite seek/play ping-pong loops.
- **Multi-Source Cinema Engine**:
  - **YouTube Iframe API**: Synchronized playback of YouTube movies, trailers, and livestreams.
  - **HTML5 Direct Stream**: Full playback support for MP4, WebM, and online video files.
  - **Synced Local File Mode**: Both partners can choose their local copy of a video file (e.g. `movie.mp4`) directly from their hard drives. Video is played locally at high quality with zero cloud upload bandwidth, while play/pause/seek timestamps stay locked across the network.

---

### 2. 🎈 The Anti-Gravity Engagement Layer
- **Dynamic Emotional Feedback**: Standard text streams can feel rigid during intense cinema moments. CineSync introduces an **Anti-Gravity Floating Emoji Framework**.
- **Visual Expression**: Clicking reaction anchors (**❤️**, **😂**, **🔥**, **🍿**, **🥺**, **😱**, **✨**, **🥂**) or custom emojis instantly spawns real-time physics particles.
- **Physics Simulation**: Emojis defy gravity, floating upward across the cinema viewport with sinusoidal horizontal sway, rotation, and soft atmospheric fading.
- **Synchronized Partner Auras**: Partner reactions display distinct glowing auras and sender tags so you instantly feel your partner's emotional pulse in real time.
- **Combo & Burst Fountain**: Rapid clicks increase combo multipliers and trigger upward bursts of emotion.

---

### 3. 🛡️ Dual-Layer Privacy & Shielding
- **Client-Side E2EE Communication Infrastructure**:
  - Text messages are encrypted right inside the browser viewport before traveling over transmission channels using the browser-native **Web Crypto API (AES-GCM 256-bit)**.
  - **Zero-Knowledge Server**: The Node.js application node acts purely as a routing mechanism and is cryptographically blind to your conversation.
  - **URL Hash Key Protection**: Passphrases and room keys are held in the URL fragment (`#room=...&key=...`), which browsers never send to web servers in HTTP request headers.
  - **Safety Fingerprint**: Partners can verify matching 12-character cryptographic fingerprints to guarantee connection security.
- **Peer-to-Peer (P2P) Media Routing**:
  - Live webcam and microphone feeds bypass intermediate database storage, establishing a **direct browser-to-browser connection** using **WebRTC** and STUN signaling.
  - No audio or video data is ever stored, recorded, or routed through central database servers.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+) & npm

### Starting the Platform
The platform can be started with the development server or the full unified production server:

```bash
# 1. Navigate to the project directory
cd cinesync

# 2. Run the unified server (WebSockets + API + Static SPA on Port 4000)
npm start

# OR run the Vite dev server with hot reloading
npm run dev
```

- **Frontend App**: [http://localhost:5173](http://localhost:5173) (Dev) or [http://localhost:4000](http://localhost:4000) (Production)
- **Signaling & Health API**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 👥 How to Test with Long-Distance Partner / Dual Tabs

1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. Enter your name (e.g. `Maya`), a Room ID (e.g. `cine-romantic`), and an E2EE Passphrase.
3. Click **"Copy Partner Invite Link"** or click **"Enter Private Cinema Sanctuary"**.
4. Open a **second tab / private incognito window** and paste the copied URL (e.g. `http://localhost:5173#room=cine-romantic&key=...`).
5. Enter a partner nickname (e.g. `Leo`) and join.
6. **Watch the magic happen**:
   - Hit **Play** or drag the seek slider in Tab 1 $\rightarrow$ Tab 2 mirrors instantly!
   - Tap **❤️** or **🔥** in Tab 1 $\rightarrow$ Watch the floating emojis ascend smoothly across both screens!
   - Send an encrypted message in Tab 1 $\rightarrow$ Decrypted in real-time in Tab 2 with E2EE verification!
   - Enable your camera/mic $\rightarrow$ Direct WebRTC peer connection established!

---

## 📁 Project Structure

```
cinesync/
├── index.html                 # Cinematic app shell & typography
├── package.json               # Dependencies and scripts
├── vite.config.js             # Vite configuration with Tailwind v4 & proxy
├── server/
│   └── index.js               # Zero-knowledge WebSocket signaling & sync router
└── src/
    ├── App.jsx                # Main unified application container
    ├── main.jsx               # React entry point
    ├── index.css              # Custom cinema dark aesthetics & keyframes
    ├── components/
    │   ├── AntiGravityEmoji.jsx      # Physics-based canvas reaction engine
    │   ├── CinemaPlayer.jsx          # Unified YouTube & HTML5 video sync player
    │   ├── E2EEChat.jsx              # WebCrypto AES-GCM 256-bit encrypted chat
    │   ├── WebRTCVideoCall.jsx       # Direct P2P webcam & microphone overlay
    │   ├── RoomLobby.jsx             # Room creation & 1-click invite link generator
    │   └── MediaSourceSelector.jsx   # Curated library, YouTube, and local file sync
    └── utils/
        ├── crypto.js          # Web Crypto API AES-GCM & PBKDF2 key derivation
        └── socket.js          # Socket.io client singleton
```
