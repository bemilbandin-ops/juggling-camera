import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { TrackerSettings, EffectSettings, TrackedObject, Particle } from '../types';
import { rgbToHsv, hsvToRgb, rgbToHex } from '../utils/color';
import { Maximize, Minimize, Video, Square } from 'lucide-react';

interface TrackingCanvasProps {
  trackerSettings: TrackerSettings;
  effectSettings: EffectSettings;
  selectedCameraId: string | null;
  videoFileUrl: string | null;
  onStatsChange: (stats: {
    activeClubs: number;
    fps: number;
    avgSpeed: number;
    tempo: number; // throws per minute
    peakSpeed: number;
  }) => void;
  onCameraListLoaded: (cameras: MediaDeviceInfo[]) => void;
  onSampleColor: (color: { r: number; g: number; b: number; h: number; s: number; v: number }) => void;
}

export interface TrackingCanvasRef {
  resetStats: () => void;
}

function catmullRomInterpolate(
  points: Array<{ canvasX: number; canvasY: number; radius: number; angle: number; t: number }>,
  subdivisions: number = 3
): Array<{ canvasX: number; canvasY: number; radius: number; angle: number; t: number }> {
  if (points.length < 2) return [...points];
  const result: typeof points = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom basis functions
      const cx = 0.5 * (
        (2 * p1.canvasX) +
        (-p0.canvasX + p2.canvasX) * t +
        (2 * p0.canvasX - 5 * p1.canvasX + 4 * p2.canvasX - p3.canvasX) * t2 +
        (-p0.canvasX + 3 * p1.canvasX - 3 * p2.canvasX + p3.canvasX) * t3
      );
      const cy = 0.5 * (
        (2 * p1.canvasY) +
        (-p0.canvasY + p2.canvasY) * t +
        (2 * p0.canvasY - 5 * p1.canvasY + 4 * p2.canvasY - p3.canvasY) * t2 +
        (-p0.canvasY + 3 * p1.canvasY - 3 * p2.canvasY + p3.canvasY) * t3
      );

      // Linearly interpolate radius and angle
      const radius = p1.radius + (p2.radius - p1.radius) * t;
      const angle = lerpAngle(p1.angle, p2.angle, t);
      const time = p1.t + (p2.t - p1.t) * t;

      result.push({ canvasX: cx, canvasY: cy, radius, angle, t: time });
    }
  }
  // Add the final point
  result.push(points[points.length - 1]);
  return result;
}

// Shortest-path angle interpolation
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

function drawClubGhost(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number,
  angle: number,
  alpha: number,
  color: string,
  glowBlur: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;

  // Soft bloom/glow behind the oval
  if (glowBlur > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glowBlur;
  }

  // Draw a soft oval — slightly elongated along the movement direction
  // This matches how an LED light source looks in real long exposure photography
  const rx = radius * 1.3;  // slightly wider along movement axis
  const ry = radius * 0.9;  // slightly narrower perpendicular

  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

export const TrackingCanvas = forwardRef<TrackingCanvasRef, TrackingCanvasProps>(({
  trackerSettings,
  effectSettings,
  selectedCameraId,
  videoFileUrl,
  onStatsChange,
  onCameraListLoaded,
  onSampleColor
}, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  
  // New Feature States
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Core tracking states
  const trackedObjectsRef = useRef<TrackedObject[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const nextTrackIdRef = useRef<number>(1);
  const peakSpeedSessionRef = useRef<number>(0);

  // Recording References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Multi-frame statistics & timing
  const lastFrameTimeRef = useRef<number>(performance.now());
  const fpsIntervalRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const currentFpsRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);

  // Peak detection for juggling tempo (Throws Per Minute)
  const throwPeaksRef = useRef<Array<{ id: string; time: number }>>([]);
  const previousYRef = useRef<Record<string, number>>({});
  const previousVyRef = useRef<Record<string, number>>({});

  // Reset session statistics
  const resetStats = () => {
    peakSpeedSessionRef.current = 0;
    throwPeaksRef.current = [];
    trackedObjectsRef.current = [];
    particlesRef.current = [];
  };

  useImperativeHandle(ref, () => ({
    resetStats
  }));

  const onCameraListLoadedRef = useRef(onCameraListLoaded);
  useEffect(() => {
    onCameraListLoadedRef.current = onCameraListLoaded;
  }, [onCameraListLoaded]);

  const trackerSettingsRef = useRef(trackerSettings);
  const effectSettingsRef = useRef(effectSettings);
  const onStatsChangeRef = useRef(onStatsChange);
  const onSampleColorRef = useRef(onSampleColor);

  useEffect(() => {
    trackerSettingsRef.current = trackerSettings;
  }, [trackerSettings]);

  useEffect(() => {
    effectSettingsRef.current = effectSettings;
  }, [effectSettings]);

  useEffect(() => {
    onStatsChangeRef.current = onStatsChange;
  }, [onStatsChange]);

  useEffect(() => {
    onSampleColorRef.current = onSampleColor;
  }, [onSampleColor]);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Recording Handler
  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!displayCanvasRef.current) return;
      recordedChunksRef.current = [];
      try {
        const stream = displayCanvasRef.current.captureStream(60);
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.style.display = 'none';
          a.href = url;
          a.download = `juggling-tracker-session-${new Date().getTime()}.webm`;
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error starting recording:", err);
      }
    }
  };

  const processingLoopRef = useRef<() => void>(() => {});
  
  const tick = () => {
    processingLoopRef.current();
  };

  // Enumerate cameras
  useEffect(() => {
    async function getCameras() {
      try {
        // Request permissions first to get complete labels
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        onCameraListLoadedRef.current(videoDevices);
      } catch (err: any) {
        console.error("Failed to list cameras, trying fallback enumeration:", err);
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          if (videoDevices.length > 0) {
            onCameraListLoadedRef.current(videoDevices);
          }
        } catch (e) {
          console.error("Fallback enumeration failed too:", e);
        }
      }
    }
    getCameras();
  }, []);

  // Start Camera Stream with highly resilient fallback constraints
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function startStream() {
      setError(null);
      setIsCameraActive(false);

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }

      if (videoFileUrl) {
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = videoFileUrl;
          videoRef.current.loop = true;
          try {
            await videoRef.current.play();
            setIsCameraActive(true);
          } catch (err: any) {
             setError("Could not play local video: " + err.message);
          }
        }
        return;
      }

      // 1. High-speed target spec (ideal: 60fps)
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedCameraId ? { ideal: selectedCameraId } : undefined,
          frameRate: { ideal: 60 },
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err: any) {
          console.warn("High-spec camera constraints failed, attempting fallback:", err);
          try {
            // Fallback 1: Ideal device ID, fallback standard 30fps
            const fallbackConstraints: MediaStreamConstraints = {
              video: selectedCameraId ? { deviceId: { ideal: selectedCameraId } } : true
            };
            stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          } catch (fallbackErr: any) {
            console.warn("Device-specific fallback failed, trying absolute default video stream:", fallbackErr);
            // Fallback 2: Absolute default stream
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }

        activeStream = stream;

        if (videoRef.current) {
          videoRef.current.src = '';
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.error("Video play() failed:", playErr);
          }
          setIsCameraActive(true);
        }
      } catch (err: any) {
        console.error("Camera access failed completely:", err);
        setError(`Camera error: ${err.message || "Could not access device. Please check permissions."}`);
      }
    }

    startStream();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedCameraId, videoFileUrl]);

  // Handle video resize and starts processing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      animationFrameIdRef.current = requestAnimationFrame(tick);
    };

    video.addEventListener('playing', handlePlay);

    // If video is already playing, start loop immediately
    if (!video.paused && !video.ended) {
      handlePlay();
    }

    return () => {
      video.removeEventListener('playing', handlePlay);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  // Pixel picker / Color Sampler on click
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

    // To sample accurate color, we sample from a temporary tiny canvas that mirrors the video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth || 640;
    tempCanvas.height = video.videoHeight || 480;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Draw frame to extract color
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Scale user clicked canvas coords to original video size
    const videoX = Math.round((x / canvas.width) * tempCanvas.width);
    const videoY = Math.round((y / canvas.height) * tempCanvas.height);

    try {
      const pixel = tempCtx.getImageData(videoX, videoY, 1, 1).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      const hsv = rgbToHsv(r, g, b);

      onSampleColorRef.current({ r, g, b, ...hsv });
    } catch (e) {
      console.error("Sampling color error:", e);
    }
  };

  // Main Tracking & Rendering Loop
  const processingLoop = () => {
    const video = videoRef.current;
    const canvas = displayCanvasRef.current;
    const offscreen = offscreenCanvasRef.current;

    const trackerSettings = trackerSettingsRef.current;
    const effectSettings = effectSettingsRef.current;
    const onStatsChange = onStatsChangeRef.current;

    if (!video || !canvas || !offscreen || video.paused || video.ended) {
      animationFrameIdRef.current = requestAnimationFrame(tick);
      return;
    }

    const ctx = canvas.getContext('2d');
    const oCtx = offscreen.getContext('2d', { willReadFrequently: true });

    if (!ctx || !oCtx) {
      animationFrameIdRef.current = requestAnimationFrame(tick);
      return;
    }

    // Measure actual processing FPS
    const now = performance.now();
    const elapsed = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    
    frameCountRef.current++;
    fpsIntervalRef.current += elapsed;
    if (fpsIntervalRef.current >= 1000) {
      currentFpsRef.current = Math.round((frameCountRef.current * 1000) / fpsIntervalRef.current);
      frameCountRef.current = 0;
      fpsIntervalRef.current = 0;
    }

    // Synchronize canvas size with video size to preserve aspect ratio
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;
    
    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

    // Setup offscreen canvas for computer vision downscaling
    const processWidth = Math.max(16, Math.floor(videoWidth / trackerSettings.downscaleFactor));
    const processHeight = Math.max(12, Math.floor(videoHeight / trackerSettings.downscaleFactor));

    if (offscreen.width !== processWidth || offscreen.height !== processHeight) {
      offscreen.width = processWidth;
      offscreen.height = processHeight;
    }

    // 1. Draw video onto offscreen canvas for CV analysis
    oCtx.drawImage(video, 0, 0, processWidth, processHeight);
    const imgData = oCtx.getImageData(0, 0, processWidth, processHeight);
    const pixels = imgData.data;

    // 2. Perform pixel classification to identify potential LED components (continuous masking)
    const width = processWidth;
    const height = processHeight;
    const size = width * height;
    const isTarget = new Uint8Array(size);

    const mode = trackerSettings.mode;
    const targetH = trackerSettings.targetColor.h;
    const targetS = trackerSettings.targetColor.s;
    const targetV = trackerSettings.targetColor.v;
    const colorTolerance = trackerSettings.colorTolerance;
    const minBrightness = trackerSettings.minBrightness;
    const minSaturation = trackerSettings.minSaturation;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        let matches = false;
        const luma = 0.299 * r + 0.587 * g + 0.114 * b; // perceived brightness
        
        if (mode === 'brightness') {
          if (luma >= minBrightness) {
            matches = true;
          }
        } else {
          // Color tracking mode: Convert current pixel to HSV
          const hsv = rgbToHsv(r, g, b);
          
          if (hsv.v >= minBrightness && hsv.s >= minSaturation) {
            // Compute circular difference in hue channel
            let dh = Math.abs(hsv.h - targetH);
            if (dh > 180) dh = 360 - dh;

            // Normalize differences
            const hueDiff = dh / 1.8; // map 0-180 diff to 0-100 scale
            const satDiff = Math.abs(hsv.s - targetS);
            const valDiff = Math.abs(hsv.v - targetV);

            // Distance calculation prioritizing Hue
            const distance = Math.sqrt(hueDiff * hueDiff * 0.75 + satDiff * satDiff * 0.15 + valDiff * valDiff * 0.10);

            if (distance <= colorTolerance) {
              matches = true;
            }
          }
        }

        if (matches) {
          isTarget[y * width + x] = 1;
        }
      }
    }

    // 3. Pixel-perfect Connected Component Labeling (BFS/DFS)
    const visited = new Uint8Array(size);
    const blobs: Array<{
      sumX: number;
      sumY: number;
      count: number;
      sumR: number;
      sumG: number;
      sumB: number;
    }> = [];

    // Pre-allocated stack to prevent garbage collection spikes at 60fps
    const stackX = new Int32Array(size);
    const stackY = new Int32Array(size);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const startIdx = y * width + x;
        if (isTarget[startIdx] === 0 || visited[startIdx] === 1) {
          continue;
        }

        // Found a new contiguous component
        let count = 0;
        let sumX = 0;
        let sumY = 0;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;

        let stackPtr = 0;
        stackX[stackPtr] = x;
        stackY[stackPtr] = y;
        stackPtr++;
        visited[startIdx] = 1;

        while (stackPtr > 0) {
          stackPtr--;
          const cx = stackX[stackPtr];
          const cy = stackY[stackPtr];

          count++;
          sumX += cx;
          sumY += cy;

          const pIdx = (cy * width + cx) * 4;
          sumR += pixels[pIdx];
          sumG += pixels[pIdx + 1];
          sumB += pixels[pIdx + 2];

          // 4-connectivity for extremely fast and robust spatial grouping
          const neighbors = [
            { px: cx + 1, py: cy },
            { px: cx - 1, py: cy },
            { px: cx,     py: cy + 1 },
            { px: cx,     py: cy - 1 }
          ];

          for (const n of neighbors) {
            if (n.px >= 0 && n.px < width && n.py >= 0 && n.py < height) {
              const nIdx = n.py * width + n.px;
              if (isTarget[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                stackX[stackPtr] = n.px;
                stackY[stackPtr] = n.py;
                stackPtr++;
              }
            }
          }
        }

        // Enforce a strict minimum pixel size to filter out camera noise
        // AND a maximum size to filter out huge objects like walls, windows, or shirts!
        if (count >= 16 && count <= 1500) {
          blobs.push({ sumX, sumY, count, sumR, sumG, sumB });
        }
      }
    }

    // Convert pixel components to detected blobs in display canvas coordinates
    interface Blob {
      x: number; // normalized coordinate (0-100)
      y: number; // normalized coordinate (0-100)
      canvasX: number; // actual display coordinates
      canvasY: number;
      size: number;
      color: { r: number; g: number; b: number };
    }

    const detectedBlobs: Blob[] = [];
    const scaleX = videoWidth / processWidth;
    const scaleY = videoHeight / processHeight;

    for (const b of blobs) {
      const avgX = b.sumX / b.count;
      const avgY = b.sumY / b.count;

      const canvasX = avgX * scaleX;
      const canvasY = avgY * scaleY;

      const r = Math.round(b.sumR / b.count);
      const g = Math.round(b.sumG / b.count);
      const b_val = Math.round(b.sumB / b.count);

      detectedBlobs.push({
        x: (canvasX / videoWidth) * 100,
        y: (canvasY / videoHeight) * 100,
        canvasX,
        canvasY,
        size: b.count,
        color: { r, g, b: b_val }
      });
    }

    // Sort detected blobs by physical size descending
    detectedBlobs.sort((a, b) => b.size - a.size);
    // Keep only the top 8 largest blobs to ignore background clutter
    if (detectedBlobs.length > 8) {
      detectedBlobs.length = 8;
    }

    // 4. Update track states (Frame-to-Frame Temporal Tracking with Constant Velocity Ballistic Prediction!)
    const activeTracks = trackedObjectsRef.current;
    
    // Increment pulse phase timers
    for (const track of activeTracks) {
      track.pulseTimer = (track.pulseTimer + 1) % 1000;
    }

    // Strict temporal matching with distance gating and constant velocity prediction
    const maxMatchDistance = Math.max(70, videoWidth * 0.12); // Restrict matching field to prevent teleportation
    const matchedBlobs = new Set<number>();

    for (const track of activeTracks) {
      let bestBlobIdx = -1;
      let minDistance = Infinity;

      // Predict next frame's position based on constant velocity model
      const predX = track.canvasX + (track.vx || 0);
      const predY = track.canvasY + (track.vy || 0);

      for (let j = 0; j < detectedBlobs.length; j++) {
        if (matchedBlobs.has(j)) continue;

        const blob = detectedBlobs[j];
        // Calculate Euclidean distance between velocity-predicted position and blob
        const dx = blob.canvasX - predX;
        const dy = blob.canvasY - predY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDistance && dist < maxMatchDistance) {
          minDistance = dist;
          bestBlobIdx = j;
        }
      }

      if (bestBlobIdx !== -1) {
        matchedBlobs.add(bestBlobIdx);
        const blob = detectedBlobs[bestBlobIdx];

        // Exponential Moving Average position smoothing (highly stabilized)
        const smoothingFactor = 0.55;
        const prevCanvasX = track.canvasX;
        const prevCanvasY = track.canvasY;

        track.canvasX = prevCanvasX * (1 - smoothingFactor) + blob.canvasX * smoothingFactor;
        track.canvasY = prevCanvasY * (1 - smoothingFactor) + blob.canvasY * smoothingFactor;
        
        track.x = (track.canvasX / videoWidth) * 100;
        track.y = (track.canvasY / videoHeight) * 100;

        // Velocity represents movement delta
        track.vx = track.canvasX - prevCanvasX;
        track.vy = track.canvasY - prevCanvasY;

        // Reset track lifetime state
        track.life = track.maxLife; // refresh life
        track.color = blob.color;

        // Compute physical radius of the detected blob in display canvas pixels
        const matchedRadius = Math.max(8, Math.min(25, Math.sqrt(blob.size / Math.PI) * trackerSettings.downscaleFactor));
        // Smoothly blend radius changes to avoid size flickering
        track.radius = track.radius ? (track.radius * 0.85 + matchedRadius * 0.15) : matchedRadius;

        // Track history path with physical size recorded per frame
        const angle = Math.atan2(track.vy, track.vx);
        track.history.push({
          x: track.x,
          y: track.y,
          canvasX: track.canvasX,
          canvasY: track.canvasY,
          radius: track.radius,
          angle,
          t: now
        });

        if (track.history.length > effectSettings.trailLength) {
          track.history.shift();
        }

        // Active motion detection
        const speed = Math.sqrt(track.vx * track.vx + track.vy * track.vy);
        if (speed >= trackerSettings.motionSensitivity) {
          track.isMoving = true;
          track.stationaryCount = 0;
        } else {
          track.stationaryCount++;
          if (track.stationaryCount > 10) { // ~0.16s stationary limit
            track.isMoving = false;
          }
        }

        // Record peak velocities for stats
        if (speed > peakSpeedSessionRef.current) {
          peakSpeedSessionRef.current = speed;
        }

        // Juggling peak detection (estimating tempo)
        const lastY = previousYRef.current[track.id] || 0;
        const lastVy = previousVyRef.current[track.id] || 0;

        if (lastVy < -0.5 && track.vy > 0.5) {
          throwPeaksRef.current.push({ id: track.id, time: now });
        }

        previousYRef.current[track.id] = track.canvasY;
        previousVyRef.current[track.id] = track.vy;
      } else {
        // Drop-out protection: Track was NOT matched in this frame (coasting!)
        track.life--;

        if (track.life > 0) {
          // Coast the track forward along its physical ballistic parabola (constant velocity + gravity)
          const prevCanvasX = track.canvasX;
          const prevCanvasY = track.canvasY;

          // Apply physics: gravity pull (positive Y is down in canvas coordinates)
          track.vy += 0.40; // Simulated gravitational acceleration
          
          // Apply velocity friction dampening to coasting speed
          track.vx *= 0.96;
          track.vy *= 0.96;

          track.canvasX += track.vx;
          track.canvasY += track.vy;

          track.x = (track.canvasX / videoWidth) * 100;
          track.y = (track.canvasY / videoHeight) * 100;

          // Push the predicted trajectory point to history to ensure trail continuity!
          const angle = Math.atan2(track.vy, track.vx);
          track.history.push({
            x: track.x,
            y: track.y,
            canvasX: track.canvasX,
            canvasY: track.canvasY,
            radius: track.radius || 15,
            angle,
            t: now
          });

          if (track.history.length > effectSettings.trailLength) {
            track.history.shift();
          }

          // Coasting speed is not active motion
          const speed = Math.sqrt(track.vx * track.vx + track.vy * track.vy);
          if (speed < trackerSettings.motionSensitivity) {
            track.stationaryCount++;
            if (track.stationaryCount > 10) {
              track.isMoving = false;
            }
          }
        }
      }
    }

    // Spawn new tracks for remaining unmatched blobs
    for (let j = 0; j < detectedBlobs.length; j++) {
      if (matchedBlobs.has(j)) continue;

      const blob = detectedBlobs[j];
      const newId = `club_${nextTrackIdRef.current++}`;
      const initRadius = Math.max(8, Math.min(25, Math.sqrt(blob.size / Math.PI) * trackerSettings.downscaleFactor));
      
      activeTracks.push({
        id: newId,
        x: blob.x,
        y: blob.y,
        canvasX: blob.canvasX,
        canvasY: blob.canvasY,
        vx: 0,
        vy: 0,
        color: blob.color,
        radius: initRadius,
        history: [{ x: blob.x, y: blob.y, canvasX: blob.canvasX, canvasY: blob.canvasY, radius: initRadius, angle: 0, t: now }],
        life: 4, // 4 frame dropout allowance (shorter decay avoids ghosting)
        maxLife: 4,
        stationaryCount: 0,
        isMoving: false,
        pulseTimer: Math.floor(Math.random() * 100)
      });
    }

    // Filter out decayed tracks
    const survivingTracks = activeTracks.filter(track => track.life > 0);
    trackedObjectsRef.current = survivingTracks;

    // Filter to only PROMOTED tracks (stable objects detected for at least 6 frames)
    // This removes single-frame or transient noise flashes that cause "flickering all over the screen"
    const stableTracks = survivingTracks.filter(track => track.history.length >= 6);

    // 5. Clean up old peaks & calculate real-time Juggling Tempo (Throws Per Minute)
    // Keep only peaks from the last 6 seconds
    const sixSecondsAgo = now - 6000;
    throwPeaksRef.current = throwPeaksRef.current.filter(p => p.time > sixSecondsAgo);
    
    // Estimate throwing tempo: (count of peaks / 6 seconds) * 60 seconds = count * 10
    // If we have active moving clubs, estimate tempo
    const activeMovingClubs = stableTracks.filter(t => !trackerSettings.motionFilter || t.isMoving);
    const calculatedTempo = activeMovingClubs.length > 0 && throwPeaksRef.current.length > 1
      ? Math.round(throwPeaksRef.current.length * 10) 
      : 0;

    // Average speed of active clubs
    let totalSpeed = 0;
    let speedCount = 0;
    stableTracks.forEach(t => {
      if (!trackerSettings.motionFilter || t.isMoving) {
        totalSpeed += Math.sqrt(t.vx * t.vx + t.vy * t.vy);
        speedCount++;
      }
    });
    const avgSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;

    // Callback with unified live statistics
    onStatsChange({
      activeClubs: activeMovingClubs.length,
      fps: currentFpsRef.current,
      avgSpeed: parseFloat(avgSpeed.toFixed(1)),
      tempo: calculatedTempo,
      peakSpeed: parseFloat(peakSpeedSessionRef.current.toFixed(1))
    });

    // 6. Draw background and effects onto display canvas
    ctx.clearRect(0, 0, videoWidth, videoHeight);
    
    // Always render pristine, unmodified background video footage
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    // Filter particles and update them
    let particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      p.alpha = p.life / p.maxLife;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    // Render individual particles
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      
      if (effectSettings.particleType === 'sparkles') {
        // Draw elegant diamond star
        const r = p.size;
        ctx.moveTo(p.x, p.y - r);
        ctx.lineTo(p.x + r / 2, p.y - r / 2);
        ctx.lineTo(p.x + r, p.y);
        ctx.lineTo(p.x + r / 2, p.y + r / 2);
        ctx.lineTo(p.x, p.y + r);
        ctx.lineTo(p.x - r / 2, p.y + r / 2);
        ctx.lineTo(p.x - r, p.y);
        ctx.lineTo(p.x - r / 2, p.y - r / 2);
      } else {
        // Simple glowing circle
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      
      ctx.fill();
      ctx.restore();
    }

    // Spawn new particles for active moving objects
    for (const track of stableTracks) {
      if (trackerSettings.motionFilter && !track.isMoving) continue;
      if (effectSettings.particleType === 'none') continue;

      const pColor = getEffectColor(track, effectSettings);
      
      // Velocity-directed particles (trail particles)
      const speed = Math.sqrt(track.vx * track.vx + track.vy * track.vy);
      const angle = speed > 0.1 ? Math.atan2(track.vy, track.vx) : Math.random() * Math.PI * 2;

      for (let k = 0; k < effectSettings.particleDensity; k++) {
        // Slightly random scattering in the opposite direction of motion
        const scatterAngle = angle + Math.PI + (Math.random() - 0.5) * 1.5;
        const scatterSpeed = (Math.random() * 0.4 + 0.1) * Math.max(2, speed);
        
        const size = effectSettings.particleType === 'sparkles'
          ? Math.random() * 4 + 2
          : effectSettings.particleType === 'smoke'
            ? Math.random() * 8 + 4
            : Math.random() * 6 + 3; // magic dust

        const maxLife = effectSettings.particleType === 'smoke' ? 45 : 30;

        particles.push({
          x: track.canvasX + (Math.random() - 0.5) * 10,
          y: track.canvasY + (Math.random() - 0.5) * 10,
          vx: Math.cos(scatterAngle) * scatterSpeed + (Math.random() - 0.5) * 1.5,
          vy: Math.sin(scatterAngle) * scatterSpeed + (Math.random() - 0.5) * 1.5,
          size,
          color: pColor,
          alpha: 1,
          life: maxLife,
          maxLife
        });
      }
    }

    // Render Trails
    if (effectSettings.trailType !== 'none') {
      for (const track of stableTracks) {
        if (trackerSettings.motionFilter && !track.isMoving) continue;
        if (track.history.length < 2) continue;

        // Interpolate for smoothness — subdivisions controlled by user setting
        const smoothPoints = catmullRomInterpolate(track.history, effectSettings.trailSmoothing ?? 3);
        const len = smoothPoints.length;

        ctx.save();

        for (let i = 0; i < len; i++) {
          const p = smoothPoints[i];
          const ratio = i / (len - 1); // 0 = oldest, 1 = newest

          // Exponential opacity with user-tunable fade curve and brightness
          const fadePower = effectSettings.fadeCurve ?? 2.2;
          const maxOpacity = effectSettings.trailOpacity ?? 0.8;
          const alpha = Math.pow(ratio, fadePower) * maxOpacity;
          if (alpha < 0.01) continue; // skip invisible ghosts

          // Clamp radius to prevent oversized blobs
          const drawRadius = Math.min(p.radius, 30);

          // Glow bloom controlled by user setting
          const glowBlur = effectSettings.trailGlow ?? 12;

          let colorHex = getEffectColor(track, effectSettings);

          if (effectSettings.trailType === 'rainbow') {
            const segmentHue = (track.pulseTimer * 1.5 + ratio * 360) % 360;
            const rgb = hsvToRgb(segmentHue, 95, 95);
            colorHex = rgbToHex(rgb.r, rgb.g, rgb.b);
          }

          if (effectSettings.trailType === 'shutter') {
            // Shutter: thin streak line + bright head
            if (i === len - 1) {
              ctx.beginPath();
              ctx.moveTo(smoothPoints[0].canvasX, smoothPoints[0].canvasY);
              for (let j = 1; j < len; j++) {
                ctx.lineTo(smoothPoints[j].canvasX, smoothPoints[j].canvasY);
              }
              ctx.strokeStyle = colorHex;
              ctx.lineWidth = Math.max(2, effectSettings.trailWidth * 0.3);
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.globalAlpha = 0.4 * maxOpacity;
              ctx.stroke();

              // Bright head
              drawClubGhost(ctx, p.canvasX, p.canvasY, drawRadius, p.angle, 1.0, colorHex, glowBlur);
            }
          } else {
            // neon, ribbon, ghost, rainbow: draw oriented oval ghost at each point
            drawClubGhost(ctx, p.canvasX, p.canvasY, drawRadius, p.angle, alpha, colorHex, glowBlur);

            if (effectSettings.trailType === 'neon' && alpha > 0.15) {
              // Neon: brighter white-hot core
              ctx.save();
              ctx.translate(p.canvasX, p.canvasY);
              ctx.rotate(p.angle);
              ctx.globalAlpha = alpha * 0.6;
              ctx.fillStyle = '#ffffff';
              const coreRx = drawRadius * 0.6;
              const coreRy = drawRadius * 0.4;
              ctx.beginPath();
              ctx.ellipse(0, 0, coreRx, coreRy, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }
        }
        ctx.restore();
      }
    }

    // Render Glow Pulse
    if (effectSettings.glowType !== 'none') {
      for (const track of stableTracks) {
        if (trackerSettings.motionFilter && !track.isMoving) continue;

        const baseColor = getEffectColor(track, effectSettings);
        const { r, g, b } = rgbToRgbObj(baseColor);

        ctx.save();
        
        if (effectSettings.glowType === 'pulse') {
          // Breathing concentric radial gradient
          const pulseScale = 1 + 0.25 * Math.sin(track.pulseTimer * 0.05);
          const size = effectSettings.glowSize * pulseScale;

          const grad = ctx.createRadialGradient(track.canvasX, track.canvasY, 1, track.canvasX, track.canvasY, size);
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
          grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.3)`);
          grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(track.canvasX, track.canvasY, size, 0, Math.PI * 2);
          ctx.fill();

        } else if (effectSettings.glowType === 'halo') {
          // Sharp neon ring outlining the LED point
          ctx.strokeStyle = baseColor;
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 10;
          ctx.lineWidth = 3;
          
          ctx.beginPath();
          ctx.arc(track.canvasX, track.canvasY, effectSettings.glowSize * 0.5, 0, Math.PI * 2);
          ctx.stroke();

        } else if (effectSettings.glowType === 'spark') {
          // Elegant sunburst lines radiating outward
          const size = effectSettings.glowSize;
          const rayCount = 8;
          const rotation = track.pulseTimer * 0.02;

          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.75;

          for (let rIdx = 0; rIdx < rayCount; rIdx++) {
            const angle = (rIdx / rayCount) * Math.PI * 2 + rotation;
            const innerR = size * 0.2;
            const outerR = size * (0.8 + 0.25 * Math.sin(track.pulseTimer * 0.03 + rIdx));

            ctx.beginPath();
            ctx.moveTo(track.canvasX + Math.cos(angle) * innerR, track.canvasY + Math.sin(angle) * innerR);
            ctx.lineTo(track.canvasX + Math.cos(angle) * outerR, track.canvasY + Math.sin(angle) * outerR);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    // Render Overlays
    if (effectSettings.overlayType !== 'none') {
      for (const track of stableTracks) {
        if (trackerSettings.motionFilter && !track.isMoving) continue;

        const baseColor = getEffectColor(track, effectSettings);

        if (effectSettings.overlayType === 'cyber') {
          // Futuristic hud target ring
          ctx.save();
          ctx.strokeStyle = baseColor;
          ctx.fillStyle = baseColor;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.65;

          const size = 35;
          
          // Spinning bracket ticks
          const spinAngle = track.pulseTimer * 0.015;
          ctx.beginPath();
          ctx.arc(track.canvasX, track.canvasY, size, spinAngle, spinAngle + Math.PI * 0.4);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(track.canvasX, track.canvasY, size, spinAngle + Math.PI, spinAngle + Math.PI * 1.4);
          ctx.stroke();

          // Speed telemetry tag (No tech slop, real math-driven speed values!)
          const speedPixelsPerSec = Math.round(Math.sqrt(track.vx * track.vx + track.vy * track.vy) * 60);
          ctx.font = '500 10px monospace';
          ctx.fillText(`ID:${track.id.split('_')[1]}`, track.canvasX + size + 6, track.canvasY - 4);
          ctx.fillText(`${speedPixelsPerSec} px/s`, track.canvasX + size + 6, track.canvasY + 8);
          
          // Tiny crosshair dot
          ctx.beginPath();
          ctx.arc(track.canvasX, track.canvasY, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();

        } else if (effectSettings.overlayType === 'bubbles') {
          // Rising translucent soap bubbles
          if (track.isMoving && Math.random() < 0.12) {
            const bSize = Math.random() * 12 + 6;
            particles.push({
              x: track.canvasX + (Math.random() - 0.5) * 20,
              y: track.canvasY + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 1,
              vy: -Math.random() * 1.5 - 0.5, // Float upwards
              size: bSize,
              color: `rgba(${rgbToRgbObj(baseColor).r}, ${rgbToRgbObj(baseColor).g}, ${rgbToRgbObj(baseColor).b}, 0.25)`,
              alpha: 1,
              life: 80,
              maxLife: 80
            });
          }
        }
      }
    }

    // Keep loop humming at refresh rate
    animationFrameIdRef.current = requestAnimationFrame(tick);
  };

  processingLoopRef.current = processingLoop;

  // Helper function to extract correct drawing hex color
  const getEffectColor = (track: TrackedObject, settings: EffectSettings): string => {
    if (settings.effectColorMode === 'custom') {
      return settings.customColor;
    } else if (settings.effectColorMode === 'rainbow') {
      const hue = (track.pulseTimer * 2.5) % 360;
      const rgb = hsvToRgb(hue, 95, 95);
      return rgbToHex(rgb.r, rgb.g, rgb.b);
    } else {
      // Matches the actual detected LED light pixel color
      return rgbToHex(track.color.r, track.color.g, track.color.b);
    }
  };

  // Helper conversion for transparency gradients
  const rgbToRgbObj = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 }; // Tailwind blue default
  };

  return (
    <div 
      id="tracking_viewport_container" 
      ref={containerRef}
      className="relative w-full aspect-video md:aspect-[4/3] lg:aspect-video rounded-none overflow-hidden bg-[#0C0C0E] border border-white/10 shadow-2xl group flex justify-center items-center"
    >
      {/* Underlying raw streaming video (hidden from display, used as tracker input buffer) */}
      <video
        id="camera_input_stream"
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />

      {/* Main interactive tracking display */}
      <canvas
        id="display_output_canvas"
        ref={displayCanvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full object-cover cursor-crosshair block transition-opacity duration-300"
        style={{ opacity: isCameraActive ? 1 : 0.35 }}
      />

      {/* Offscreen computer-vision sandbox for ultra-fast processing (hidden) */}
      <canvas
        id="cv_analysis_sandbox"
        ref={offscreenCanvasRef}
        className="hidden"
      />

      {/* Frame assistance guidelines & hints overlay */}
      {isCameraActive && (
        <div id="canvas_calibration_watermark" className="absolute top-4 left-4 flex items-center space-x-2 bg-[#0C0C0E]/95 px-3 py-1.5 rounded-none border border-cyan-500/20 select-none pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-md">
          <div className="w-2 h-2 rounded-none bg-cyan-400 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">
            TAP CANVAS TO SAMPLE COLOR HUE
          </span>
        </div>
      )}

      {/* Loading & Error Overlays */}
      {!isCameraActive && !error && (
        <div id="loading_overlay" className="absolute inset-0 flex flex-col items-center justify-center bg-[#0C0C0E]/95 backdrop-blur-sm">
          <div className="w-12 h-12 rounded-none border-2 border-white/5 border-t-2 border-t-cyan-400 animate-spin mb-4" />
          <p className="text-xs font-mono font-bold tracking-widest text-neutral-300 uppercase">INITIALIZING INTEGRATION STREAM...</p>
          <p className="text-[10px] font-mono text-neutral-500 uppercase mt-1">Accept camera prompt permissions when requested</p>
        </div>
      )}

      {error && (
        <div id="error_overlay" className="absolute inset-0 flex flex-col items-center justify-center bg-[#0C0C0E] p-6 text-center">
          <div className="w-12 h-12 rounded-none bg-red-950/20 flex items-center justify-center border border-red-500/30 text-red-400 font-bold mb-4 text-sm font-mono">!</div>
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-red-400 mb-1">Camera Stream Inaccessible</p>
          <p className="text-[11px] text-neutral-400 max-w-sm mb-4 font-mono uppercase tracking-wide">
            {error}
          </p>
          <button
            id="retry_camera_btn"
            onClick={() => {
              // Force reload page / toggle state
              const video = videoRef.current;
              if (video) video.load();
            }}
            className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 active:bg-red-950/40 border border-red-500/30 hover:border-red-500/50 text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest rounded-none transition-all cursor-pointer"
          >
            Retry Stream Link
          </button>
        </div>
      )}

      {/* Floating Viewport Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2 z-50">
        {isCameraActive && (
          <button
            onClick={toggleRecording}
            className={`flex items-center gap-2 px-3 py-1.5 backdrop-blur-sm border rounded-none transition-colors shadow-md ${
              isRecording 
                ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30 animate-pulse' 
                : 'bg-black/50 border-white/10 text-neutral-300 hover:text-white hover:bg-black/80'
            }`}
            title={isRecording ? "Stop Recording & Save" : "Start Canvas Recording"}
          >
            {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Video className="w-4 h-4" />}
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase">
              {isRecording ? 'REC' : 'CAPTURE'}
            </span>
          </button>
        )}
        <button
          onClick={toggleFullscreen}
          className="flex items-center justify-center p-1.5 backdrop-blur-sm bg-black/50 border border-white/10 text-neutral-300 hover:text-white hover:bg-black/80 rounded-none transition-colors shadow-md"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
});

TrackingCanvas.displayName = 'TrackingCanvas';
