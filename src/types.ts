export interface TrackerSettings {
  mode: 'brightness' | 'color';
  targetColor: { r: number; g: number; b: number; h: number; s: number; v: number };
  colorTolerance: number; // tolerance for color matching (0 to 100)
  minBrightness: number;  // threshold for brightness (0 to 255)
  minSaturation: number;  // threshold for saturation (0 to 255)
  motionFilter: boolean;  // whether to ignore stationary lights
  motionSensitivity: number; // speed threshold below which an object is considered stationary (pixels per frame)
  downscaleFactor: number; // downscale factor for fast pixel processing (e.g. 2 or 4)
}

export interface EffectSettings {
  trailType: 'none' | 'neon' | 'ribbon' | 'rainbow' | 'ghost' | 'shutter';
  trailLength: number; // number of past frames to keep
  trailWidth: number;  // line width in pixels
  trailOpacity: number;    // overall trail brightness multiplier (0.1 to 1.0)
  trailGlow: number;       // blur/bloom radius around each ghost (0 to 40 pixels)
  trailSmoothing: number;  // curve interpolation subdivisions (1 to 6)
  fadeCurve: number;       // exponential fade power (0.5 = linear-ish, 4.0 = sharp head)
  glowType: 'none' | 'pulse' | 'halo' | 'spark';
  glowSize: number;    // glow radius in pixels
  particleType: 'none' | 'sparkles' | 'smoke' | 'magic';
  particleDensity: number; // count of particles emitted per frame of movement
  overlayType: 'none' | 'cyber' | 'bubbles';
  effectColorMode: 'match' | 'rainbow' | 'custom';
  customColor: string; // hex representation, e.g. '#3b82f6'
}

export interface TrackedObject {
  id: string;
  x: number; // normalized x (0 to 100)
  y: number; // normalized y (0 to 100)
  canvasX: number; // actual canvas pixel x
  canvasY: number; // actual canvas pixel y
  vx: number; // velocity x (pixels per frame)
  vy: number; // velocity y (pixels per frame)
  color: { r: number; g: number; b: number };
  radius: number; // physical radius of the object in display pixels
  history: Array<{ x: number; y: number; canvasX: number; canvasY: number; t: number; radius: number; angle: number }>;
  life: number; // frames remaining to survive if not matched in current frame
  maxLife: number;
  stationaryCount: number; // frames spent with minimal movement
  isMoving: boolean; // calculated based on recent displacement
  pulseTimer: number; // pulse phase timer for drawing effects
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  angle?: number;
  spin?: number;
}

export interface Preset {
  name: string;
  description: string;
  tracker: Partial<TrackerSettings>;
  effects: Partial<EffectSettings>;
}
