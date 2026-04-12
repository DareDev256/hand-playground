import { useRef, useEffect } from 'react';
import { useHandTracking } from '../useHandTracking';
import { OneEuroFilter } from '../oneEuroFilter';

const W = 960;
const H = 720;
const NUM_LAYERS = 5;

interface Layer {
  label: string;
  color: string;
  items: string[];
}

const LAYERS: Layer[] = [
  { label: 'Surface', color: '#4ECDC4', items: ['Quick Actions', 'Notifications', 'Time'] },
  { label: 'Apps', color: '#45B7D1', items: ['Dashboard', 'Terminal', 'Browser', 'Chat'] },
  { label: 'Projects', color: '#BB8FCE', items: ['Passion Agent', 'BetMetrics', 'LetsTrade', 'City Pulse'] },
  { label: 'Memory', color: '#F7DC6F', items: ['Sessions', 'Feedback', 'Blockers', 'Patterns'] },
  { label: 'System', color: '#FF6B6B', items: ['Config', 'Logs', 'Health', 'Network'] },
];

export default function DepthControl() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ready, error, getHandData } = useHandTracking(W, H);
  const depthFilter = useRef(new OneEuroFilter(30, 0.5, 0.005));
  const stateRef = useRef({
    currentDepth: 0,
    targetDepth: 0,
    smoothDepth: 0,
    baseSpread: 0,
    calibrated: false,
    calibrationFrames: 0,
    spreadSamples: [] as number[],
    pulsePhase: 0,
  });

  useEffect(() => {
    if (!ready) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    let raf = 0;

    function getHandSpread(landmarks: { x: number; y: number; z: number }[]): number {
      // Distance from wrist (0) to middle finger tip (12) — correlates with hand distance from camera
      const wrist = landmarks[0];
      const middle = landmarks[12];
      const dx = wrist.x - middle.x;
      const dy = wrist.y - middle.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function draw() {
      const hand = getHandData();
      const s = stateRef.current;
      ctx.clearRect(0, 0, W, H);
      s.pulsePhase += 0.03;

      if (hand) {
        const spread = getHandSpread(hand.landmarks);

        // Calibration: collect spread samples for first 30 frames to get baseline
        if (!s.calibrated) {
          s.spreadSamples.push(spread);
          s.calibrationFrames++;
          if (s.calibrationFrames >= 30) {
            s.baseSpread = s.spreadSamples.reduce((a, b) => a + b) / s.spreadSamples.length;
            s.calibrated = true;
          }
        }

        if (s.calibrated) {
          // Map spread relative to baseline
          // Closer hand = larger spread, further = smaller
          // Normalize: baseSpread = depth 0.5 (middle)
          const ratio = spread / s.baseSpread;
          // ratio > 1 = hand closer = deeper layers
          // ratio < 1 = hand further = surface layers
          const rawDepth = (ratio - 0.6) * 2.5; // tuned range
          const clampedDepth = Math.max(0, Math.min(NUM_LAYERS - 1, rawDepth * (NUM_LAYERS - 1)));
          const now = performance.now() / 1000;
          s.smoothDepth = depthFilter.current.filter(clampedDepth, now);
          s.targetDepth = s.smoothDepth;
        }
      }

      // Animate current depth
      s.currentDepth += (s.targetDepth - s.currentDepth) * 0.1;

      const activeLayer = Math.round(s.currentDepth);
      const depthFrac = s.currentDepth;

      // Draw depth tunnel
      for (let i = NUM_LAYERS - 1; i >= 0; i--) {
        const layer = LAYERS[i];
        const distFromCurrent = i - depthFrac;
        const zScale = Math.max(0.1, 1 - Math.abs(distFromCurrent) * 0.2);
        const alpha = Math.max(0.05, 1 - Math.abs(distFromCurrent) * 0.35);
        const yOffset = distFromCurrent * 60;

        const layerW = (W - 120) * zScale;
        const layerH = 100 * zScale;
        const layerX = W / 2 - layerW / 2;
        const layerY = H / 2 - layerH / 2 + yOffset;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Layer background
        ctx.beginPath();
        ctx.roundRect(layerX, layerY, layerW, layerH, 12 * zScale);
        const isActive = i === activeLayer;
        const bgAlpha = isActive ? 0.25 : 0.08;
        ctx.fillStyle = layer.color + Math.floor(bgAlpha * 255).toString(16).padStart(2, '0');
        ctx.fill();

        // Border with pulse on active
        const borderAlpha = isActive
          ? 0.5 + Math.sin(s.pulsePhase) * 0.2
          : 0.15;
        ctx.strokeStyle = layer.color + Math.floor(borderAlpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = isActive ? 2.5 : 1;
        ctx.stroke();

        // Layer label
        ctx.fillStyle = isActive ? layer.color : `rgba(255,255,255,${0.3 * alpha})`;
        ctx.font = `${isActive ? 'bold ' : ''}${Math.round(18 * zScale)}px system-ui`;
        ctx.textAlign = 'left';
        ctx.fillText(layer.label, layerX + 20 * zScale, layerY + 30 * zScale);

        // Depth indicator
        ctx.fillStyle = `rgba(255,255,255,${0.2 * alpha})`;
        ctx.font = `${Math.round(12 * zScale)}px system-ui`;
        ctx.textAlign = 'right';
        ctx.fillText(`Layer ${i}`, layerX + layerW - 15 * zScale, layerY + 25 * zScale);

        // Items
        if (zScale > 0.4) {
          const itemY = layerY + 55 * zScale;
          const itemSpacing = layerW / (layer.items.length + 1);
          for (let j = 0; j < layer.items.length; j++) {
            const ix = layerX + itemSpacing * (j + 1);

            // Item box
            const boxW = 80 * zScale;
            const boxH = 30 * zScale;
            ctx.beginPath();
            ctx.roundRect(ix - boxW / 2, itemY - boxH / 2, boxW, boxH, 6 * zScale);
            ctx.fillStyle = isActive
              ? layer.color + '25'
              : 'rgba(255,255,255,0.03)';
            ctx.fill();
            ctx.strokeStyle = isActive
              ? layer.color + '40'
              : 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Item text
            ctx.fillStyle = isActive
              ? `rgba(255,255,255,${0.8 * alpha})`
              : `rgba(255,255,255,${0.3 * alpha})`;
            ctx.font = `${Math.round(11 * zScale)}px system-ui`;
            ctx.textAlign = 'center';
            ctx.fillText(layer.items[j], ix, itemY + 4 * zScale);
          }
        }

        ctx.restore();
      }

      // Depth gauge on the right
      const gaugeX = W - 50;
      const gaugeTop = 100;
      const gaugeH = H - 200;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gaugeX, gaugeTop);
      ctx.lineTo(gaugeX, gaugeTop + gaugeH);
      ctx.stroke();

      // Layer markers on gauge
      for (let i = 0; i < NUM_LAYERS; i++) {
        const gy = gaugeTop + (i / (NUM_LAYERS - 1)) * gaugeH;
        const isActive = i === activeLayer;
        ctx.beginPath();
        ctx.arc(gaugeX, gy, isActive ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? LAYERS[i].color : 'rgba(255,255,255,0.2)';
        ctx.fill();

        ctx.fillStyle = isActive ? LAYERS[i].color : 'rgba(255,255,255,0.2)';
        ctx.font = `${isActive ? 'bold 12' : '11'}px system-ui`;
        ctx.textAlign = 'right';
        ctx.fillText(LAYERS[i].label, gaugeX - 14, gy + 4);
      }

      // Current depth indicator on gauge
      const indicatorY = gaugeTop + (s.currentDepth / (NUM_LAYERS - 1)) * gaugeH;
      ctx.beginPath();
      ctx.moveTo(gaugeX + 10, indicatorY - 5);
      ctx.lineTo(gaugeX + 18, indicatorY);
      ctx.lineTo(gaugeX + 10, indicatorY + 5);
      ctx.fillStyle = LAYERS[activeLayer].color;
      ctx.fill();

      // Calibration overlay
      if (!stateRef.current.calibrated && hand) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#4ECDC4';
        ctx.font = 'bold 24px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Calibrating...', W / 2, H / 2 - 20);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '16px system-ui';
        ctx.fillText('Hold your hand still at a comfortable distance', W / 2, H / 2 + 15);

        // Progress bar
        const progress = stateRef.current.calibrationFrames / 30;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.roundRect(W / 2 - 100, H / 2 + 40, 200, 8, 4);
        ctx.fill();
        ctx.fillStyle = '#4ECDC4';
        ctx.beginPath();
        ctx.roundRect(W / 2 - 100, H / 2 + 40, 200 * progress, 8, 4);
        ctx.fill();
      }

      // Cursor
      if (hand) {
        ctx.beginPath();
        ctx.arc(hand.indexTip.x, hand.indexTip.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = hand.isPinching ? '#FF6B6B' : '#4ECDC4';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Instructions
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      if (stateRef.current.calibrated) {
        ctx.fillText('Move hand closer to camera = deeper layers — Pull back = surface', W / 2, 40);
      } else if (!hand) {
        ctx.fillText('Show your hand to begin depth calibration', W / 2, 40);
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, getHandData]);

  if (error) return <div style={{ color: '#FF6B6B', padding: 40 }}>Error: {error}</div>;
  if (!ready) return <div style={{ color: 'white', padding: 40 }}>Loading hand tracking model...</div>;

  return <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', margin: '0 auto', borderRadius: 12 }} />;
}
