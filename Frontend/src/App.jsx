import { useState, useEffect, useRef } from 'react'
import {
  Mic,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Settings,
  Plus,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Volume2,
  Home,
  LayoutGrid,
  History,
  Sparkles,
  X,
  VolumeX
} from 'lucide-react'
import './App.css'

function App() {
  const [prompt, setPrompt] = useState('')
  const [generatedAudios, setGeneratedAudios] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(0)
  const [isPlayingSequence, setIsPlayingSequence] = useState(false)

  // Settings State
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [uiSize, setUiSize] = useState('M') // Options: XS, S, M, L, XL

  // Navigation State
  const [activeTab, setActiveTab] = useState('home') // home, history, voices

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null)

  // History State
  const [historyList, setHistoryList] = useState([])
  const [activeSession, setActiveSession] = useState(null)

  /* Background Audio Reference and State */
  const backgroundAudioRef = useRef(null);
  const [bgVolume, setBgVolume] = useState(0.4); // Default 40% volume

  /* Podcast Audio State */
  const podcastAudioRef = useRef(null);
  const [podcastVolume, setPodcastVolume] = useState(1.0);

  /* UI Toggles */
  const [showAmbienceVol, setShowAmbienceVol] = useState(false);
  const [showPodcastVol, setShowPodcastVol] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [generatedAudios]); // Refresh history when new audios are generated

  /* Sync Podcast Volume */
  useEffect(() => {
    if (podcastAudioRef.current) {
      podcastAudioRef.current.volume = podcastVolume;
    }
  }, [podcastVolume, currentPlayingIndex, isPlayingSequence]);

  /* Sync Background Noise */
  useEffect(() => {
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.volume = bgVolume; // Update volume whenever it changes

      if (isPlayingSequence) {
        backgroundAudioRef.current.play()
          .then(() => console.log("Background audio playing"))
          .catch(e => console.error("Background play failed:", e));
      } else {
        backgroundAudioRef.current.pause();
      }
    }
  }, [isPlayingSequence, bgVolume]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:5011/history');
      const data = await res.json();
      setHistoryList(data);
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      setIsLoading(true);
      const res = await fetch(`http://localhost:5011/history/${sessionId}`);
      const data = await res.json();

      if (data.segments) {
        setGeneratedAudios(data.segments);
        setActiveSession(sessionId);
        setCurrentPlayingIndex(0);
        setIsPlayingSequence(false);
      }
    } catch (e) {
      console.error("Failed to load session", e);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setGeneratedAudios([]);
    setPrompt('');
    setActiveSession(null);
    setCurrentPlayingIndex(0);
    setIsPlayingSequence(false);
  };

  const sizes = [
    { id: 'XS', label: 'Extra Small' },
    { id: 'S', label: 'Small' },
    { id: 'M', label: 'Medium' },
    { id: 'L', label: 'Large' },
    { id: 'XL', label: 'Extra Large' },
  ];

  /* File Upload Handler */
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedFile({
        file: file,
        dataUrl: reader.result,
        name: file.name,
        type: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        processFile(file);
        e.preventDefault(); // Prevent standard paste if it's an image
        break;
      }
    }
  };


  const handleGenerate = async () => {
    if (!prompt.trim() && !selectedFile) return;

    setIsLoading(true);

    try {
      const payload = { message: prompt };
      if (selectedFile) {
        payload.file_data = selectedFile.dataUrl;
        payload.file_type = selectedFile.type;
      }

      const response = await fetch('http://localhost:5011/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      console.log("Received metadata:", data);

      if (data.audio_segments && data.audio_segments.length > 0) {
        setGeneratedAudios(prev => {
          const newAudios = [...prev, ...data.audio_segments];
          if (!isPlayingSequence && prev.length === currentPlayingIndex) {
            setIsPlayingSequence(true);
          }
          return newAudios;
        });
      }

      setPrompt('');
      setSelectedFile(null); // Clear file after sending

    } catch (error) {
      console.error("Error generating podcast:", error);
      alert("Failed to generate podcast. Ensure backend is running.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleAudioEnded = () => {
    if (currentPlayingIndex < generatedAudios.length - 1) {
      setCurrentPlayingIndex(prev => prev + 1);
    } else {
      setIsPlayingSequence(false);
    }
  };

  return (
    <div className="main-layout" data-size={uiSize}>
      {/* Sidebar Navigation */}
      <aside className="sidebar-nav">
        <div className="brand-section">
          <div className="brand-logo">
            <Volume2 size={24} color="#38bdf8" />
          </div>
          <span className="brand-name">Ashtra</span>
        </div>

        <nav className="nav-menu">
          <button
            className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <Home size={20} />
            <span>Home</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'explore' ? 'active' : ''}`}
            onClick={() => setActiveTab('explore')}
          >
            <LayoutGrid size={20} />
            <span>Explore</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={20} />
            <span>History</span>
          </button>
        </nav>

        <div className="sidebar-divider"></div>

        <div className="history-section">
          <div className="section-header">
            <span>Recent Projects</span>
            <button className="new-project-btn-mini" onClick={startNewChat} title="New Project">
              <Plus size={16} />
            </button>
          </div>
          <div className="history-list">
            {historyList.map(session => (
              <div
                key={session.id}
                className={`history-item ${activeSession === session.id ? 'active' : ''}`}
                onClick={() => loadSession(session.id)}
              >
                <MessageSquare size={14} className="history-icon" />
                <span className="history-text">{session.title || session.id}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="user-profile">
          <div className="user-avatar">A</div>
          <div className="user-info">
            <span className="user-name">Agnos</span>
            <span className="user-plan">Pro Plan</span>
          </div>
          <button
            className="settings-trigger"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <Settings size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header / Greeting */}
        <header className="content-header">
          <div className="header-greeting">
            <h1>Good morning, Agnos</h1>
            <p>Ready to create your next audio masterpiece?</p>
          </div>
          <div className="header-actions">
            {/* Settings Dropdown (Previously standalone) */}
            {settingsOpen && (
              <div className="settings-popover">
                <h3>Interface Scale</h3>
                <div className="scale-options">
                  {sizes.map(size => (
                    <button
                      key={size.id}
                      className={`scale-btn ${uiSize === size.id ? 'active' : ''}`}
                      onClick={() => { setUiSize(size.id); setSettingsOpen(false); }}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
                <div className="volume-control">
                  <h3>Ambience</h3>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgVolume}
                    onChange={(e) => setBgVolume(parseFloat(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="content-scroll-area">

          {/* Creation Studio Card */}
          <div className="studio-card">
            <div className="card-header">
              <Sparkles size={18} className="sparkle-icon" />
              <h2>AI Podcast Studio</h2>
            </div>

            <div className="input-area">
              <textarea
                id="prompt"
                placeholder="Describe your podcast topic... (e.g., A debate about AI ethics between a scientist and a philosopher)"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onPaste={handlePaste}
              />

              <div className="input-tools">
                <label className="tool-btn attachment-btn">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleFileChange}
                    hidden
                  />
                  <Paperclip size={16} />
                  <span>{selectedFile ? 'Change File' : 'Attach Reference'}</span>
                </label>

                {selectedFile && (
                  <span className="file-chip">
                    {selectedFile.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                    <span className="file-name">{selectedFile.name}</span>
                    <button onClick={(e) => { e.preventDefault(); setSelectedFile(null) }}><X size={12} /></button>
                  </span>
                )}

                <div className="flex-spacer"></div>

                <button
                  className="generate-action-btn"
                  onClick={handleGenerate}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : 'Generate Audio'}
                  <Mic size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Generated Content Section */}
          {generatedAudios.length > 0 && (
            <div className="results-section">
              <div className="stage-wrapper">
                {/* Visualizer / Stage */}
                <div className={`stage-display ${generatedAudios[currentPlayingIndex] ? (() => {
                  const match = generatedAudios[currentPlayingIndex].voice.match(/\d+/);
                  return match ? `voice-${match[0]}` : '';
                })() : ''}`}>

                  {generatedAudios[currentPlayingIndex] ? (
                    <>
                      <div className="voice-tag">
                        <Mic size={14} />
                        {generatedAudios[currentPlayingIndex].voice}
                      </div>
                      <div className="active-subtitle">
                        "{generatedAudios[currentPlayingIndex].text}"
                      </div>

                      <div className="playback-controls">

                        {/* Left: Ambience Control */}
                        <div className="control-group left">
                          <button
                            className={`control-btn secondary ${showAmbienceVol ? 'active' : ''}`}
                            onClick={() => {
                              setShowAmbienceVol(!showAmbienceVol);
                              setShowPodcastVol(false);
                            }}
                            title="Ambience Volume"
                          >
                            <Sparkles size={20} className={bgVolume > 0 ? 'text-highlight' : ''} />
                          </button>

                          <div className={`volume-slider-popup left-aligned ${showAmbienceVol ? 'visible' : ''}`}>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={bgVolume}
                              onChange={(e) => setBgVolume(parseFloat(e.target.value))}
                              className="styled-range"
                            />
                          </div>
                        </div>

                        {/* Center: Playback Navigation */}
                        <div className="control-group center">
                          <button
                            className="control-btn secondary"
                            onClick={() => {
                              setCurrentPlayingIndex(prev => Math.max(0, prev - 1));
                              setIsPlayingSequence(true);
                            }}
                            disabled={currentPlayingIndex === 0}
                            title="Previous Message"
                          >
                            <SkipBack size={24} />
                          </button>

                          <button
                            className="control-btn primary"
                            onClick={() => setIsPlayingSequence(!isPlayingSequence)}
                            title={isPlayingSequence ? "Pause" : "Play"}
                          >
                            {isPlayingSequence ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                          </button>

                          <button
                            className="control-btn secondary"
                            onClick={() => {
                              setCurrentPlayingIndex(prev => Math.min(generatedAudios.length - 1, prev + 1));
                              setIsPlayingSequence(true);
                            }}
                            disabled={currentPlayingIndex === generatedAudios.length - 1}
                            title="Next Message"
                          >
                            <SkipForward size={24} />
                          </button>
                        </div>

                        {/* Right: Podcast Volume */}
                        <div className="control-group right">
                          <button
                            className={`control-btn secondary ${showPodcastVol ? 'active' : ''}`}
                            onClick={() => {
                              setShowPodcastVol(!showPodcastVol);
                              setShowAmbienceVol(false);
                            }}
                            title="Voice Volume"
                          >
                            {podcastVolume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                          </button>
                          <div className={`volume-slider-popup right-aligned ${showPodcastVol ? 'visible' : ''}`}>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={podcastVolume}
                              onChange={(e) => setPodcastVolume(parseFloat(e.target.value))}
                              className="styled-range"
                            />
                          </div>
                        </div>

                      </div>
                    </>
                  ) : (
                    <div className="empty-state">Waiting to generate...</div>
                  )}
                </div>
              </div>

              <div className="transcript-panel">
                <h3>Conversation Log</h3>
                <div className="transcript-list">
                  {generatedAudios.map((audio, index) => (
                    <div
                      key={index}
                      className={`transcript-row ${index === currentPlayingIndex ? 'playing' : ''}`}
                      onClick={() => {
                        setCurrentPlayingIndex(index);
                        setIsPlayingSequence(true);
                      }}
                    >
                      <span className="speaker-label">{audio.voice}</span>
                      <p className="speaker-text">{audio.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Hidden Audio Players */}
        {generatedAudios.length > 0 && isPlayingSequence && generatedAudios[currentPlayingIndex] && (
          <audio
            ref={podcastAudioRef}
            autoPlay
            src={generatedAudios[currentPlayingIndex].url}
            onEnded={handleAudioEnded}
            onError={(e) => console.error("Audio error", e)}
            style={{ display: 'none' }}
          />
        )}
        <audio
          ref={backgroundAudioRef}
          src="http://localhost:5011/assets/whitenoise.mp3"
          loop
          style={{ display: 'none' }}
        />

      </main>
    </div>
  )
}

export default App

