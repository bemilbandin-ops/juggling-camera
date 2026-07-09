import { useState } from 'react';
import { TrackerSettings, EffectSettings, Preset } from '../types';
import { Sliders, Sparkles, Video, HelpCircle, RefreshCw, Layers, ShieldAlert } from 'lucide-react';
import { rgbToHex } from '../utils/color';

interface ControlPanelProps {
  trackerSettings: TrackerSettings;
  setTrackerSettings: (settings: TrackerSettings) => void;
  effectSettings: EffectSettings;
  setEffectSettings: (settings: EffectSettings) => void;
  cameras: MediaDeviceInfo[];
  selectedCameraId: string | null;
  setSelectedCameraId: (id: string | null) => void;
  videoFileUrl: string | null;
  setVideoFileUrl: (url: string | null) => void;
  onResetStats: () => void;
}

export function ControlPanel({
  trackerSettings,
  setTrackerSettings,
  effectSettings,
  setEffectSettings,
  cameras,
  selectedCameraId,
  setSelectedCameraId,
  videoFileUrl,
  setVideoFileUrl,
  onResetStats
}: ControlPanelProps) {
  const [activeTab, setActiveTab] = useState<'calibrate' | 'effects' | 'presets'>('calibrate');

  const updateTracker = (key: keyof TrackerSettings, value: any) => {
    setTrackerSettings({ ...trackerSettings, [key]: value });
  };

  const updateEffects = (key: keyof EffectSettings, value: any) => {
    setEffectSettings({ ...effectSettings, [key]: value });
  };

  // Preset Configurations
  const presets: Preset[] = [
    {
      name: 'Neon Sparkle',
      description: 'Bright glowing traces with golden diamond bursts. Great for fast juggling.',
      tracker: {
        mode: 'brightness',
        minBrightness: 160,
        motionFilter: true,
        motionSensitivity: 5
      },
      effects: {
        trailType: 'neon',
        trailLength: 28,
        trailWidth: 15,
        glowType: 'pulse',
        glowSize: 45,
        particleType: 'sparkles',
        particleDensity: 3,
        overlayType: 'none',
        effectColorMode: 'match'
      }
    },
    {
      name: 'Midnight Ribbon',
      description: 'Slow-fading translucent ribbon trails. Soft, mystical purple aesthetic.',
      tracker: {
        mode: 'brightness',
        minBrightness: 140,
        motionFilter: true,
        motionSensitivity: 3
      },
      effects: {
        trailType: 'ribbon',
        trailLength: 35,
        trailWidth: 20,
        glowType: 'halo',
        glowSize: 30,
        particleType: 'smoke',
        particleDensity: 1,
        overlayType: 'none',
        effectColorMode: 'custom',
        customColor: '#a855f7' // purple
      }
    },
    {
      name: 'Rainbow Cyber HUD',
      description: 'Rainbow-colored trails with target lock HUDs and spinning velocity overlays.',
      tracker: {
        mode: 'brightness',
        minBrightness: 170,
        motionFilter: true,
        motionSensitivity: 6
      },
      effects: {
        trailType: 'rainbow',
        trailLength: 30,
        trailWidth: 14,
        glowType: 'spark',
        glowSize: 50,
        particleType: 'magic',
        particleDensity: 4,
        overlayType: 'cyber',
        effectColorMode: 'rainbow'
      }
    },
    {
      name: 'Green Color Lock',
      description: 'Locks tracking strictly to green LED colors, ignoring other lights completely.',
      tracker: {
        mode: 'color',
        targetColor: { r: 0, g: 255, b: 0, h: 120, s: 90, v: 85 },
        colorTolerance: 20,
        minBrightness: 110,
        minSaturation: 40,
        motionFilter: true,
        motionSensitivity: 4
      },
      effects: {
        trailType: 'neon',
        trailLength: 25,
        trailWidth: 15,
        glowType: 'pulse',
        glowSize: 40,
        particleType: 'sparkles',
        particleDensity: 2,
        overlayType: 'none',
        effectColorMode: 'match'
      }
    },
    {
      name: 'Pure Bubbles',
      description: 'Fun floating bubbles that inflate and drift upwards as the clubs move.',
      tracker: {
        mode: 'brightness',
        minBrightness: 150,
        motionFilter: true,
        motionSensitivity: 4
      },
      effects: {
        trailType: 'none',
        glowType: 'none',
        particleType: 'none',
        overlayType: 'bubbles',
        effectColorMode: 'match'
      }
    }
  ];

  const applyPreset = (preset: Preset) => {
    setTrackerSettings({ ...trackerSettings, ...preset.tracker } as TrackerSettings);
    setEffectSettings({ ...effectSettings, ...preset.effects } as EffectSettings);
    onResetStats();
  };

  const commonColors = [
    { name: 'Red', r: 239, g: 68, b: 68, h: 0, s: 95, v: 90, class: 'bg-red-500' },
    { name: 'Green', r: 34, g: 197, b: 94, h: 120, s: 95, v: 85, class: 'bg-green-500' },
    { name: 'Blue', r: 59, g: 130, b: 246, h: 220, s: 95, v: 90, class: 'bg-blue-500' },
    { name: 'Purple', r: 168, g: 85, b: 247, h: 270, s: 90, v: 90, class: 'bg-purple-500' },
    { name: 'Cyan', r: 6, g: 182, b: 212, h: 190, s: 90, v: 85, class: 'bg-cyan-500' },
    { name: 'Yellow', r: 234, g: 179, b: 8, h: 50, s: 90, v: 90, class: 'bg-yellow-500' }
  ];

  const hexTargetColor = rgbToHex(trackerSettings.targetColor.r, trackerSettings.targetColor.g, trackerSettings.targetColor.b);

  return (
    <div id="control_panel_root" className="w-full bg-[#121214] border border-white/10 rounded-none overflow-hidden shadow-xl flex flex-col h-full">
      {/* Category Tabs */}
      <div id="tabs_navigation" className="flex border-b border-white/10 bg-[#0C0C0E]/90">
        <button
          id="tab_btn_calibrate"
          onClick={() => setActiveTab('calibrate')}
          className={`flex-1 py-4 px-2 text-[11px] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
            activeTab === 'calibrate'
              ? 'text-cyan-400 border-cyan-400 bg-white/5'
              : 'text-neutral-400 border-transparent hover:text-neutral-200 hover:bg-white/2'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Tuning
        </button>
        <button
          id="tab_btn_effects"
          onClick={() => setActiveTab('effects')}
          className={`flex-1 py-4 px-2 text-[11px] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
            activeTab === 'effects'
              ? 'text-cyan-400 border-cyan-400 bg-white/5'
              : 'text-neutral-400 border-transparent hover:text-neutral-200 hover:bg-white/2'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Effects
        </button>
        <button
          id="tab_btn_presets"
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-4 px-2 text-[11px] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
            activeTab === 'presets'
              ? 'text-cyan-400 border-cyan-400 bg-white/5'
              : 'text-neutral-400 border-transparent hover:text-neutral-200 hover:bg-white/2'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Presets
        </button>
      </div>

      {/* Tab Panels */}
      <div id="tabs_content_container" className="flex-1 overflow-y-auto p-5 space-y-5 max-h-[500px] md:max-h-[600px] lg:max-h-none">
        
        {/* PANEL 1: CALIBRATE & TUNING */}
        {activeTab === 'calibrate' && (
          <div id="tuning_panel_content" className="space-y-5 animate-fade-in">
            {/* Mode Selector */}
            <div id="tracking_mode_section">
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-2">
                Tracking Mode
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-none border border-white/5">
                <button
                  id="mode_btn_brightness"
                  onClick={() => updateTracker('mode', 'brightness')}
                  className={`py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-none transition-all cursor-pointer ${
                    trackerSettings.mode === 'brightness'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 font-bold shadow-inner'
                      : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
                  }`}
                >
                  Brightness
                </button>
                <button
                  id="mode_btn_color"
                  onClick={() => updateTracker('mode', 'color')}
                  className={`py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-none transition-all cursor-pointer ${
                    trackerSettings.mode === 'color'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 font-bold shadow-inner'
                      : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
                  }`}
                >
                  Color Hue
                </button>
              </div>
              <p className="text-[10px] text-neutral-500 mt-2 leading-relaxed">
                {trackerSettings.mode === 'brightness'
                  ? 'Tracks exceptionally bright elements. Ideal for dark environments or glowing juggling clubs.'
                  : 'Locks onto a custom color hue. Ideal to ignore background lights or isolate specific club colors.'}
              </p>
            </div>

            {/* Color Lock Sub-panel */}
            {trackerSettings.mode === 'color' && (
              <div id="color_lock_controls" className="p-4 bg-neutral-950 rounded-none border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-300 font-bold">Hue Swatch Lock</span>
                  <div className="flex items-center gap-2">
                    <div
                      id="target_color_swatch"
                      className="w-4 h-4 rounded-none border border-white/20 shadow-inner"
                      style={{ backgroundColor: hexTargetColor }}
                    />
                    <span className="text-[10px] font-mono text-neutral-400">{hexTargetColor}</span>
                  </div>
                </div>

                {/* Preset colors */}
                <div className="grid grid-cols-6 gap-2">
                  {commonColors.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => updateTracker('targetColor', color)}
                      className={`h-7 rounded-none ${color.class} flex items-center justify-center relative shadow group transition-transform active:scale-95 cursor-pointer`}
                      title={`Lock to ${color.name}`}
                    >
                      {Math.abs(trackerSettings.targetColor.h - color.h) < 10 && (
                        <div className="w-2.5 h-2.5 rounded-none bg-white ring-2 ring-neutral-950" />
                      )}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono text-neutral-400 mb-1">
                    <span>Hue Tolerance</span>
                    <span className="font-mono text-cyan-400 font-bold">{trackerSettings.colorTolerance}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="1"
                    value={trackerSettings.colorTolerance}
                    onChange={(e) => updateTracker('colorTolerance', parseInt(e.target.value))}
                    className="w-full accent-cyan-400 h-1 bg-neutral-800 rounded-none appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono text-neutral-400 mb-1">
                    <span>Minimum Saturation</span>
                    <span className="font-mono text-cyan-400 font-bold">{trackerSettings.minSaturation}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="2"
                    value={trackerSettings.minSaturation}
                    onChange={(e) => updateTracker('minSaturation', parseInt(e.target.value))}
                    className="w-full accent-cyan-400 h-1 bg-neutral-800 rounded-none appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Common Tuning Sliders */}
            <div id="brightness_tolerance_control" className="space-y-4">
              <div>
                <div className="flex justify-between text-[11px] font-mono text-neutral-300 mb-1 font-bold">
                  <span>Brightness Cutoff Threshold</span>
                  <span className="font-mono text-cyan-400">{trackerSettings.minBrightness}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="240"
                  step="5"
                  value={trackerSettings.minBrightness}
                  onChange={(e) => updateTracker('minBrightness', parseInt(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-850 rounded-none appearance-none cursor-pointer"
                />
                <p className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
                  Increase value to filter out static white room lights, desktop screens, or window reflections.
                </p>
              </div>

              {/* Motion Filter Option */}
              <div id="motion_filter_controls" className="p-4 bg-neutral-950 rounded-none border border-white/10 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-neutral-200">Velocity Filter</span>
                    <span className="text-[10px] text-neutral-500">Render overlay effects only on moving items</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={trackerSettings.motionFilter}
                    onChange={(e) => updateTracker('motionFilter', e.target.checked)}
                    className="w-4 h-4 rounded-none border-white/20 text-cyan-500 focus:ring-cyan-400 focus:ring-offset-[#121214] bg-neutral-900 cursor-pointer"
                  />
                </div>

                {trackerSettings.motionFilter && (
                  <div className="pt-3 border-t border-white/5 space-y-2.5">
                    <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                      <span>Motion Sensitivity</span>
                      <span className="font-mono text-cyan-400 font-bold">{trackerSettings.motionSensitivity} px/fr</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="0.5"
                      value={trackerSettings.motionSensitivity}
                      onChange={(e) => updateTracker('motionSensitivity', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-neutral-800 rounded-none appearance-none cursor-pointer"
                    />
                    <p className="text-[9px] text-neutral-500 leading-normal">
                      Objects moving slower than this velocity cutoff are classified as static background noise.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Downscale Control */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-neutral-300 mb-2">
                  <span>Resolution Parser Scaler</span>
                  <span className="font-mono text-neutral-400 font-semibold">{trackerSettings.downscaleFactor}x fast</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 4].map((f) => (
                    <button
                      key={f}
                      onClick={() => updateTracker('downscaleFactor', f)}
                      className={`py-1.5 text-[10px] font-mono font-bold rounded-none border transition-all cursor-pointer ${
                        trackerSettings.downscaleFactor === f
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                          : 'border-white/10 text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      {f}X ({f === 4 ? 'MAX FPS' : f === 3 ? 'BALANCED' : 'HQ RES'})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 2: VISUAL EFFECTS */}
        {activeTab === 'effects' && (
          <div id="effects_panel_content" className="space-y-5 animate-fade-in">
            {/* Trail Type */}
            <div>
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-2">
                Traces & Trails
              </label>
              <select
                value={effectSettings.trailType}
                onChange={(e) => updateEffects('trailType', e.target.value)}
                className="w-full bg-neutral-950 text-neutral-300 text-xs rounded-none border border-white/10 p-2.5 focus:border-cyan-500 focus:outline-none"
              >
                <option value="none">No Trails</option>
                <option value="neon">Neon Core Trace</option>
                <option value="ribbon">Polygonal Ribbon</option>
                <option value="rainbow">Shifting Rainbow Ribbon</option>
                <option value="ghost">Ghostly Fading Imprint</option>
                <option value="shutter">Slow Sync Shutter Drag</option>
              </select>

              {effectSettings.trailType !== 'none' && (
                <>
                <div className="grid grid-cols-2 gap-3 mt-3.5">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
                      <span>Length</span>
                      <span className="font-mono text-cyan-400 font-bold">{effectSettings.trailLength}f</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={effectSettings.trailLength}
                      onChange={(e) => updateEffects('trailLength', parseInt(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-neutral-850 rounded-none appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
                      <span>Thickness</span>
                      <span className="font-mono text-cyan-400 font-bold">{effectSettings.trailWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="24"
                      value={effectSettings.trailWidth}
                      onChange={(e) => updateEffects('trailWidth', parseInt(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-neutral-850 rounded-none appearance-none cursor-pointer"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
                      <span>Brightness</span>
                      <span className="font-mono text-cyan-400 font-bold">{Math.round(effectSettings.trailOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={Math.round(effectSettings.trailOpacity * 100)}
                      onChange={(e) => updateEffects('trailOpacity', parseInt(e.target.value) / 100)}
                      className="w-full accent-cyan-400 h-1 bg-neutral-850 rounded-none appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
                      <span>Glow Bloom</span>
                      <span className="font-mono text-cyan-400 font-bold">{effectSettings.trailGlow}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={effectSettings.trailGlow}
                      onChange={(e) => updateEffects('trailGlow', parseInt(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-neutral-850 rounded-none appearance-none cursor-pointer"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
                      <span>Smoothing</span>
                      <span className="font-mono text-cyan-400 font-bold">{effectSettings.trailSmoothing}x</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      value={effectSettings.trailSmoothing}
                      onChange={(e) => updateEffects('trailSmoothing', parseInt(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-neutral-850 rounded-none appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
                      <span>Fade Curve</span>
                      <span className="font-mono text-cyan-400 font-bold">{effectSettings.fadeCurve.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="40"
                      value={Math.round(effectSettings.fadeCurve * 10)}
                      onChange={(e) => updateEffects('fadeCurve', parseInt(e.target.value) / 10)}
                      className="w-full accent-cyan-400 h-1 bg-neutral-850 rounded-none appearance-none cursor-pointer"
                    />
                    <p className="text-[9px] text-neutral-500 mt-1">Low = gradual fade, High = sharp bright head</p>
                  </div>
                </div>
                </>
              )}
            </div>

            {/* Glow Aura */}
            <div>
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-2">
                Center Glow Aura
              </label>
              <select
                value={effectSettings.glowType}
                onChange={(e) => updateEffects('glowType', e.target.value)}
                className="w-full bg-neutral-950 text-neutral-300 text-xs rounded-none border border-white/10 p-2.5 focus:border-cyan-500 focus:outline-none"
              >
                <option value="none">No Glow</option>
                <option value="pulse">Radial Pulse (Breathing)</option>
                <option value="halo">Neon Halo (Outer Outline)</option>
                <option value="spark">Solar Starburst Rays</option>
              </select>

              {effectSettings.glowType !== 'none' && (
                <div className="mt-3.5">
                  <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
                    <span>Glow Diameter</span>
                    <span className="font-mono text-cyan-400 font-bold">{effectSettings.glowSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="90"
                    value={effectSettings.glowSize}
                    onChange={(e) => updateEffects('glowSize', parseInt(e.target.value))}
                    className="w-full accent-cyan-400 h-1 bg-neutral-850 rounded-none appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Particles */}
            <div>
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-2">
                Sparkle Sprays
              </label>
              <select
                value={effectSettings.particleType}
                onChange={(e) => updateEffects('particleType', e.target.value)}
                className="w-full bg-neutral-950 text-neutral-300 text-xs rounded-none border border-white/10 p-2.5 focus:border-cyan-500 focus:outline-none"
              >
                <option value="none">No Sparkles</option>
                <option value="sparkles">Twinkling Diamond Stars</option>
                <option value="smoke">Whimsical Fading Smoke</option>
                <option value="magic">Pixie Magic Dust</option>
              </select>

              {effectSettings.particleType !== 'none' && (
                <div className="mt-3.5">
                  <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
                    <span>Spray Density</span>
                    <span className="font-mono text-cyan-400 font-bold">{effectSettings.particleDensity} per frame</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    value={effectSettings.particleDensity}
                    onChange={(e) => updateEffects('particleDensity', parseInt(e.target.value))}
                    className="w-full accent-cyan-400 h-1 bg-neutral-855 rounded-none appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Overlays / HUDs */}
            <div>
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-2">
                HUD HUDs & Overlays
              </label>
              <select
                value={effectSettings.overlayType}
                onChange={(e) => updateEffects('overlayType', e.target.value)}
                className="w-full bg-neutral-950 text-neutral-300 text-xs rounded-none border border-white/10 p-2.5 focus:border-cyan-500 focus:outline-none"
              >
                <option value="none">No Overlays</option>
                <option value="cyber">Cyber Crosshair & Speed Telemetry</option>
                <option value="bubbles">Floating Orbs & Bubbles</option>
              </select>
            </div>

            {/* Effect Color Strategy */}
            <div className="pt-4 border-t border-white/10">
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-2">
                Visual Effect Color
              </label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-950 rounded-none border border-white/5 mb-3.5">
                <button
                  onClick={() => updateEffects('effectColorMode', 'match')}
                  className={`py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded-none transition-all cursor-pointer ${
                    effectSettings.effectColorMode === 'match'
                      ? 'bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/25'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  Match LED
                </button>
                <button
                  onClick={() => updateEffects('effectColorMode', 'rainbow')}
                  className={`py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded-none transition-all cursor-pointer ${
                    effectSettings.effectColorMode === 'rainbow'
                      ? 'bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/25'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  Rainbow
                </button>
                <button
                  onClick={() => updateEffects('effectColorMode', 'custom')}
                  className={`py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded-none transition-all cursor-pointer ${
                    effectSettings.effectColorMode === 'custom'
                      ? 'bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/25'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  Custom
                </button>
              </div>

              {effectSettings.effectColorMode === 'custom' && (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={effectSettings.customColor}
                    onChange={(e) => updateEffects('customColor', e.target.value)}
                    className="w-10 h-10 rounded-none border-0 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={effectSettings.customColor}
                    onChange={(e) => updateEffects('customColor', e.target.value)}
                    className="flex-1 bg-neutral-950 border border-white/10 text-neutral-300 text-xs p-2 rounded-none font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL 3: PRESETS & DEV SETUP */}
        {activeTab === 'presets' && (
          <div id="presets_panel_content" className="space-y-5 animate-fade-in">
            {/* Quick Presets Grid */}
            <div>
              <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-2.5">
                Quick Setup Presets
              </label>
              <div className="space-y-2">
                {presets.map((preset) => {
                  const isActive = 
                    preset.effects.trailType === effectSettings.trailType &&
                    preset.effects.glowType === effectSettings.glowType &&
                    preset.tracker.mode === trackerSettings.mode;
 
                  return (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className={`w-full text-left p-4 rounded-none border transition-all flex flex-col gap-1 cursor-pointer ${
                        isActive
                          ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/10'
                          : 'bg-neutral-950/40 border-white/10 hover:border-cyan-500/20 hover:bg-neutral-950/70'
                      }`}
                    >
                      <span className={`text-xs font-bold font-mono uppercase tracking-wider ${isActive ? 'text-cyan-400' : 'text-neutral-200'}`}>
                        {preset.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 leading-normal">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hardware Selectors */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div id="camera_hardware_select">
                <div className="flex items-center gap-1.5 text-neutral-300 text-xs font-bold mb-2 font-display">
                  <Video className="w-4.5 h-4.5 text-cyan-400" />
                  <span>Juggling Camera Source</span>
                </div>
                
                <div className="flex gap-2 mb-3">
                  <label className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-[10px] text-center font-mono cursor-pointer transition-colors text-cyan-400 font-bold tracking-wider">
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setVideoFileUrl(URL.createObjectURL(file));
                    }} />
                    UPLOAD MP4 VIDEO
                  </label>
                  {videoFileUrl && (
                    <button onClick={() => setVideoFileUrl(null)} className="px-3 bg-red-900/50 hover:bg-red-900 border border-red-500/50 text-[10px] font-mono cursor-pointer text-red-400 font-bold">
                      X CAMERA
                    </button>
                  )}
                </div>

                {!videoFileUrl && (
                  cameras.length > 0 ? (
                    <select
                      value={selectedCameraId || ''}
                      onChange={(e) => setSelectedCameraId(e.target.value || null)}
                      className="w-full bg-neutral-950 text-neutral-300 text-xs rounded-none border border-white/10 p-2.5 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">Default Integrated Camera</option>
                      {cameras.map((cam) => (
                        <option key={cam.deviceId} value={cam.deviceId}>
                          {cam.label || `Camera ${cam.deviceId.slice(0, 5)}...`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3.5 bg-neutral-950 border border-white/10 rounded-none text-[10px] text-neutral-400 flex items-center gap-2 font-mono">
                      <ShieldAlert className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span>NO EXTERNAL HARDWARE DETECTED. DEFAULTING TO INTEGRATED CAMERA FEED.</span>
                    </div>
                  )
                )}
                <p className="text-[10px] text-neutral-500 mt-2 leading-normal">
                  Testing on an Android device? Select the rear-facing camera to unlock high frame rate options and better distance tracking.
                </p>
              </div>

              {/* Utility reset button */}
              <button
                id="reset_session_stats_btn"
                onClick={onResetStats}
                className="w-full py-3 bg-neutral-950 hover:bg-neutral-900 text-neutral-300 border border-white/10 text-xs font-mono font-bold uppercase tracking-wider rounded-none flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Calibration
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Direct Quick Instructions Panel footer */}
      <div id="control_panel_footer" className="bg-neutral-950 p-4 border-t border-white/10 text-[11px] text-neutral-400 flex gap-2.5 items-start select-none">
        <HelpCircle className="w-4.5 h-4.5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-neutral-300 font-display">Calibration Protocol:</strong> Pure brightness tracking works perfectly with <strong className="text-cyan-400">Auto Brightness</strong> in dark rooms. If there are lamps in the frame, turn on <strong className="text-cyan-400">Velocity Filter</strong> to discard static room lights.
        </p>
      </div>
    </div>
  );
}
