import React, { useState } from 'react';
import { Film, Globe, HardDrive, Sparkles, X, Check, Play } from 'lucide-react';

const PRESET_MOVIES = [
  {
    id: 'oceans-local',
    title: 'Oceans Odyssey (HD Local Cinema)',
    category: 'Nature / Cinema',
    type: 'mp4',
    url: '/sample-cinema.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    description: 'Captivating cinematic ocean film, bundled locally for guaranteed zero buffering and zero delay.'
  },
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny (Animation 4K)',
    category: 'Animation / Comedy',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    description: 'Beloved 4K animation classic, synced via YouTube Iframe API for cozy movie dates.'
  },
  {
    id: 'tears-of-steel',
    title: 'Tears of Steel (Sci-Fi Cinema 4K)',
    category: 'Sci-Fi / Cyberpunk',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=R6MlUcmOul8',
    thumbnail: 'https://images.unsplash.com/photo-1514533450685-4493e01d1fdc?auto=format&fit=crop&w=600&q=80',
    description: 'High octane sci-fi dystopian film featuring futuristic robotic VFX and synths.'
  },
  {
    id: 'lofi-midnight',
    title: 'Lofi Girl - Midnight Chill & Beats',
    category: 'Music & Vibes',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    description: 'Shared ambient study session, relaxing beats, and peaceful evening mood.'
  },
  {
    id: 'aurora-borealis',
    title: 'Cosmic Aurora Borealis 4K',
    category: 'Cosmic / Ambient',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=17XpDkF_pW8',
    thumbnail: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=600&q=80',
    description: 'Spellbinding northern lights timelapse under starlit skies.'
  },
  {
    id: 'cdn-oceans',
    title: 'Marine Wonders (CDN Stream)',
    category: 'Direct MP4 CDN',
    type: 'mp4',
    url: 'https://vjs.zencdn.net/v/oceans.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80',
    description: 'Fast high-bandwidth CDN video stream for testing remote direct MP4 sync.'
  }
];

export default function MediaSourceSelector({ socket, currentRoom, onSelect, onClose }) {
  const [tab, setTab] = useState('presets'); // presets | youtube | direct | local
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');

  const handleApplyMedia = (media) => {
    onSelect(media);
    if (socket && currentRoom) {
      socket.emit('media-change', {
        roomId: currentRoom,
        ...media
      });
    }
    onClose();
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    const url = customUrl.trim();
    const isYt = url.includes('youtube.com') || url.includes('youtu.be');
    
    handleApplyMedia({
      type: isYt ? 'youtube' : 'mp4',
      url,
      title: customTitle.trim() || (isYt ? 'YouTube Video' : 'Direct Video Stream')
    });
  };

  const handleLocalFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      handleApplyMedia({
        type: 'local',
        url: objectUrl,
        title: `Local File: ${file.name}`
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="max-w-2xl w-full bg-slate-950 border border-purple-500/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Select Shared Cinema Media</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-2 bg-slate-900/30 border-b border-slate-800 text-xs font-medium">
          <button
            onClick={() => setTab('presets')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
              tab === 'presets'
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Curated Cinema</span>
          </button>

          <button
            onClick={() => setTab('youtube')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
              tab === 'youtube'
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-3.5 h-3.5 text-rose-500 fill-current" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span>YouTube Link</span>
          </button>

          <button
            onClick={() => setTab('direct')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
              tab === 'direct'
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Direct Video URL</span>
          </button>

          <button
            onClick={() => setTab('local')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
              tab === 'local'
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>Synced Local Movie</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {tab === 'presets' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRESET_MOVIES.map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => handleApplyMedia(movie)}
                  className="group relative bg-slate-900/80 rounded-xl overflow-hidden border border-slate-800 hover:border-purple-500/50 cursor-pointer transition-all hover:scale-[1.02] shadow-lg flex flex-col"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                    <img
                      src={movie.thumbnail}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-[10px] font-semibold text-purple-300">
                      {movie.category}
                    </div>
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
                        {movie.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {movie.description}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="uppercase font-mono font-bold text-slate-400">{movie.type}</span>
                      <span className="text-purple-400 font-medium group-hover:underline">Load Cinema →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(tab === 'youtube' || tab === 'direct') && (
            <form onSubmit={handleCustomSubmit} className="space-y-4 max-w-lg mx-auto py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {tab === 'youtube' ? 'YouTube URL' : 'Direct MP4 / WebM URL'}
                </label>
                <input
                  type="url"
                  required
                  placeholder={tab === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://example.com/video.mp4'}
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Display Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Inception, Our Favorite Sci-Fi Trailer"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl cursor-pointer shadow-lg transition-all"
              >
                Sync with Partner
              </button>
            </form>
          )}

          {tab === 'local' && (
            <div className="max-w-lg mx-auto py-4 space-y-4 text-center">
              <div className="p-6 border-2 border-dashed border-slate-700 hover:border-purple-500/60 rounded-2xl bg-slate-900/40 transition-colors">
                <HardDrive className="w-10 h-10 text-purple-400 mx-auto mb-2" />
                <h3 className="text-xs font-bold text-white mb-1">Play Same Local File</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                  Have a 4K movie file on your hard drive? Both partners select the same video file locally. FlixTogether synchronizes playback timestamps with zero server bandwidth!
                </p>
                <label className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs rounded-xl cursor-pointer shadow-md transition-all">
                  Browse Video File (.mp4, .mkv, .webm)
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleLocalFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
