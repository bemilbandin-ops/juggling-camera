import { useState, useRef, useCallback } from 'react';
import { TrackerSettings, EffectSettings } from './types';
import { TrackingCanvas, TrackingCanvasRef } from './components/TrackingCanvas';
import { ControlPanel } from './components/ControlPanel';
import { 
  Zap, 
  Activity, 
  Gauge, 
  TrendingUp, 
  HelpCircle, 
  RefreshCw, 
  Camera, 
  Dribbble,
  Sparkles,
  Info,
  Video
} from 'lucide-react';

export default function App() {
  // Tracker settings with sensible, high-performance defaults
  const [trackerSettings, setTrackerSettings] = useState<TrackerSettings>({
    mode: 'brightness',
    targetColor: { r: 239, g: 68, b: 68, h: 0, s: 95, v: 90 }, // Default Red
    colorTolerance: 18,
    minBrightness: 220,
    minSaturation: 0,
    motionFilter: true,
    motionSensitivity: 4.5,
    downscaleFactor: 3 // 3x downscale balances processing speed & spatial resolution
  });

  // Visual effects settings with highly artistic default configurations
  const [effectSettings, setEffectSettings] = useState<EffectSettings>({
    trailType: 'neon',
    trailLength: 28,
    trailWidth: 15,
    trailOpacity: 0.8,
    trailGlow: 12,
    trailSmoothing: 3,
    fadeCurve: 2.2,
    glowType: 'pulse',
    glowSize: 45,
    particleType: 'none',
    particleDensity: 3,
    overlayType: 'none',
    effectColorMode: 'match',
    customColor: '#3b82f6' // Default Blue
  });

  // Tracked live statistics
  const [stats, setStats] = useState({
    activeClubs: 0,
    fps: 0,
    avgSpeed: 0,
    tempo: 0, // estimated throws per minute
    peakSpeed: 0
  });

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const trackerRef = useRef<TrackingCanvasRef>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('video/')) {
        setVideoFileUrl(URL.createObjectURL(file));
      } else {
        alert('Please drop a valid video file (.mp4, .webm, etc).');
      }
    }
  }, []);

  // Trigger camera list load
  const handleCameraListLoaded = useCallback((camerasList: MediaDeviceInfo[]) => {
    setCameras(camerasList);
    // Auto-select back camera if on Android, or default to first camera
    if (camerasList.length > 0 && !selectedCameraId) {
      const backCam = camerasList.find(cam => 
        cam.label.toLowerCase().includes('back') || 
        cam.label.toLowerCase().includes('rear') ||
        cam.label.toLowerCase().includes('environment')
      );
      setSelectedCameraId(backCam ? backCam.deviceId : camerasList[0].deviceId);
    }
  }, [selectedCameraId]);

  // Color selection from camera click
  const handleSampleColor = useCallback((sampledColor: typeof trackerSettings.targetColor) => {
    setTrackerSettings(prev => ({
      ...prev,
      mode: 'color', // automatically lock onto color mode once clicked
      targetColor: sampledColor
    }));
  }, []);

  const handleResetStats = () => {
    if (trackerRef.current) {
      trackerRef.current.resetStats();
    }
    setStats({
      activeClubs: 0,
      fps: 0,
      avgSpeed: 0,
      tempo: 0,
      peakSpeed: 0
    });
  };

  return (
    <div 
      id="app_root_viewport" 
      className="min-h-screen bg-[#0A0A0B] text-neutral-100 font-sans flex flex-col selection:bg-cyan-500 selection:text-[#0A0A0B] relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
      {isDragging && (
        <div className="absolute inset-0 z-[100] bg-cyan-500/10 backdrop-blur-[2px] border-4 border-cyan-500 border-dashed flex items-center justify-center pointer-events-none">
          <div className="bg-[#0C0C0E] p-8 rounded-none border border-cyan-500 shadow-2xl shadow-cyan-500/50 flex flex-col items-center gap-4">
            <Video className="w-16 h-16 text-cyan-400 animate-bounce" />
            <span className="text-2xl font-display font-black tracking-widest text-white">DROP VIDEO FILE</span>
            <span className="text-sm font-mono text-cyan-400 uppercase">to load into tracking engine</span>
          </div>
        </div>
      )}

      {/* Top Main Navigation Header */}
      <header id="main_header" className="border-b border-white/10 bg-[#0C0C0E] sticky top-0 z-50 px-6 py-5 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div id="brand_badge" className="w-11 h-11 rounded-none bg-gradient-to-tr from-cyan-500 via-emerald-400 to-indigo-600 p-[1px] flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <div className="w-full h-full rounded-none bg-[#09090b] flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-display font-black tracking-tight text-white flex items-center gap-2">
              LUMEN TRACKER
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-none font-mono font-bold tracking-widest">
                v4.2 PRO
              </span>
            </h1>
            <p className="text-xs text-neutral-400">High-speed on-device computer vision for luminous juggling hardware</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] text-neutral-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LATENCY: &lt;5ms</span>
          </div>
          <button
            id="global_reset_btn"
            onClick={handleResetStats}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#121214] hover:bg-neutral-800 active:bg-black border border-white/10 rounded-none text-xs font-mono font-semibold text-neutral-300 hover:text-white transition-all shadow-md active:scale-95 cursor-pointer"
            title="Reset calibration, peak velocity, and rhythm calculations"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            RESET ANALYZER
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main id="main_dashboard_layout" className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: CAMERA ENGINE & STATISTICS VIEWPORT (8 COLS) */}
        <section id="viewport_and_stats_column" className="lg:col-span-8 flex flex-col gap-6 w-full">
          
          {/* Main live-tracker viewfinder */}
          <div className="w-full flex flex-col">
            <TrackingCanvas
              ref={trackerRef}
              trackerSettings={trackerSettings}
              effectSettings={effectSettings}
              selectedCameraId={selectedCameraId}
              videoFileUrl={videoFileUrl}
              onStatsChange={setStats}
              onCameraListLoaded={handleCameraListLoaded}
              onSampleColor={handleSampleColor}
            />
          </div>

          {/* TELEMETRY DASHBOARD PANEL (HUMAN LABELS ONLY, NO TECH-SLOP) */}
          <div id="telemetry_dashboard_panel" className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            
            {/* Active Clubs Lock */}
            <div id="stat_card_active_clubs" className="bg-[#121214]/90 border border-white/10 rounded-none p-5 flex flex-col justify-between relative overflow-hidden group hover:border-cyan-500/40 transition-all duration-300 shadow-md">
              <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 w-12 h-[1px] bg-gradient-to-r from-cyan-500/50 to-transparent" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">ACTIVE CLUBS</span>
                <Dribbble className={`w-4 h-4 transition-colors ${stats.activeClubs > 0 ? 'text-cyan-400 animate-spin' : 'text-neutral-600'}`} style={{ animationDuration: stats.activeClubs > 0 ? '3s' : '0s' }} />
              </div>
              <div>
                <span className="text-4xl font-black tracking-tight text-white font-mono leading-none">
                  {stats.activeClubs}
                </span>
                <p className="text-[10px] text-neutral-500 mt-1.5 uppercase font-mono tracking-wider">Locked in flight</p>
              </div>
            </div>

            {/* Juggling Rhythm / Tempo */}
            <div id="stat_card_tempo" className="bg-[#121214]/90 border border-white/10 rounded-none p-5 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300 shadow-md">
              <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 w-12 h-[1px] bg-gradient-to-r from-emerald-500/50 to-transparent" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">THROW TEMPO</span>
                <Activity className={`w-4 h-4 ${stats.tempo > 0 ? 'text-emerald-400 animate-pulse' : 'text-neutral-600'}`} />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black tracking-tight text-white font-mono leading-none">
                    {stats.tempo > 0 ? stats.tempo : '---'}
                  </span>
                  {stats.tempo > 0 && <span className="text-[10px] text-neutral-400 font-bold font-mono">TPM</span>}
                </div>
                <p className="text-[10px] text-neutral-500 mt-1.5 uppercase font-mono tracking-wider">Throws per minute</p>
              </div>
            </div>

            {/* Average Velocity */}
            <div id="stat_card_avg_speed" className="bg-[#121214]/90 border border-white/10 rounded-none p-5 flex flex-col justify-between relative overflow-hidden group hover:border-sky-500/40 transition-all duration-300 shadow-md">
              <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-sky-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 w-12 h-[1px] bg-gradient-to-r from-sky-500/50 to-transparent" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">AVG VELOCITY</span>
                <Gauge className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black tracking-tight text-white font-mono leading-none">
                    {stats.avgSpeed > 0 ? Math.round(stats.avgSpeed * 60) : '0'}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-bold font-mono">px/s</span>
                </div>
                <p className="text-[10px] text-neutral-500 mt-1.5 uppercase font-mono tracking-wider">Movement speed</p>
              </div>
            </div>

            {/* Peak Velocity */}
            <div id="stat_card_peak_speed" className="bg-[#121214]/90 border border-white/10 rounded-none p-5 flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300 shadow-md">
              <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 w-12 h-[1px] bg-gradient-to-r from-purple-500/50 to-transparent" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">PEAK SPEED</span>
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black tracking-tight text-white font-mono leading-none">
                    {stats.peakSpeed > 0 ? Math.round(stats.peakSpeed * 60) : '0'}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-bold font-mono">px/s</span>
                </div>
                <p className="text-[10px] text-neutral-500 mt-1.5 uppercase font-mono tracking-wider">Session peak record</p>
              </div>
            </div>

          </div>

          {/* Core Hardware & Frame Rate Performance HUD */}
          <div id="camera_hardware_telemetry_bar" className="bg-[#121214]/60 border border-white/10 rounded-none p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full text-xs shadow-md">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-cyan-400" />
              <div>
                <span className="font-semibold text-neutral-300 font-display">Tracking Engine Feed rate:</span>
                <span className={`ml-2 font-mono font-bold ${stats.fps >= 55 ? 'text-emerald-400' : stats.fps >= 30 ? 'text-cyan-400' : 'text-neutral-500'}`}>
                  {stats.fps > 0 ? `${stats.fps} FPS` : '---'}
                </span>
                {stats.fps >= 55 && (
                  <span className="ml-1.5 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-none font-mono font-bold tracking-wider">
                    ULTRA HIGH HERTZ
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>PARSER CORES: ONLINE</span>
            </div>
          </div>

        </section>

        {/* RIGHT COLUMN: INTERACTIVE CONTROLS PANEL (4 COLS) */}
        <section id="interactive_settings_column" className="lg:col-span-4 w-full">
          <ControlPanel
            trackerSettings={trackerSettings}
            setTrackerSettings={setTrackerSettings}
            effectSettings={effectSettings}
            setEffectSettings={setEffectSettings}
            cameras={cameras}
            selectedCameraId={selectedCameraId}
            setSelectedCameraId={setSelectedCameraId}
            videoFileUrl={videoFileUrl}
            setVideoFileUrl={setVideoFileUrl}
            onResetStats={handleResetStats}
          />
        </section>

      </main>

      {/* QUICK CALIBRATION USER ASSISTANT DRAWER */}
      <footer id="app_instruction_footer" className="mt-auto border-t border-white/10 bg-[#0C0C0E] px-6 py-8 text-center text-xs text-neutral-500">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-center gap-2 text-neutral-300 font-semibold text-sm font-display">
            <Info className="w-4.5 h-4.5 text-cyan-400" />
            <span>CALIBRATION PROTOCOLS &amp; PRO JUGGLING OPTIMIZATION</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mt-2 text-[11px] leading-relaxed">
            <div className="bg-[#121214]/60 p-4 rounded-none border border-white/10">
              <h5 className="font-bold text-white mb-1.5 font-display tracking-wide">1. Environment Setup</h5>
              <p className="text-neutral-400">For best results, juggle in a moderately dimmed or dark room. High contrast between your glowing LED clubs and the background enables flawless high-frequency tracking.</p>
            </div>
            <div className="bg-[#121214]/60 p-4 rounded-none border border-white/10">
              <h5 className="font-bold text-white mb-1.5 font-display tracking-wide">2. Locking Onto Colors</h5>
              <p className="text-neutral-400">Switch to <strong className="text-cyan-400">Color Locked</strong> mode and click directly on a club in the camera feed. The tracker will lock onto that precise color hue, filtering out other light sources.</p>
            </div>
            <div className="bg-[#121214]/60 p-4 rounded-none border border-white/10">
              <h5 className="font-bold text-white mb-1.5 font-display tracking-wide">3. Eliminating Lamp Noise</h5>
              <p className="text-neutral-400">If static household lamps or windows appear in your background, make sure <strong className="text-cyan-400">Active Motion Filtering</strong> is checked. This filters out anything that isn&apos;t physically flying through the air!</p>
            </div>
          </div>
          <p className="text-[10px] text-neutral-600 mt-2 font-mono">
            LUMEN TRACKER is powered by low-latency computer vision routines compiling dynamically onto device-local sandbox buffers. Zero server dependencies ensure instant feed response.
          </p>
        </div>
      </footer>

    </div>
  );
}
