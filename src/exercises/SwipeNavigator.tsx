import { useRef, useEffect } from 'react';
import { useHandTracking } from '../useHandTracking';

const W = 960;
const H = 720;

const CARDS = [
  { title: 'Passion Agent', desc: 'Autonomous AI operating system', color: '#4ECDC4', icon: '🧠' },
  { title: 'PACT Dashboard', desc: 'Mission control interface', color: '#FF6B6B', icon: '📊' },
  { title: 'BetMetrics', desc: 'Sports analytics platform', color: '#45B7D1', icon: '🎯' },
  { title: 'LetsTrade', desc: 'Options trading scanner', color: '#F7DC6F', icon: '📈' },
  { title: 'Toronto Pulse', desc: '3D city intelligence map', color: '#BB8FCE', icon: '🗺️' },
  { title: 'Privacy Shield', desc: 'Defensive OSINT platform', color: '#98D8C8', icon: '🛡️' },
];

const SWIPE_THRESHOLD = 120;   // pixels of movement to trigger
const VELOCITY_THRESHOLD = 8;  // px/frame minimum speed

interface SwipeState {
  cardIndex: number;
  offsetX: number;
  targetOffsetX: number;
  gestureStartX: number;
  gestureStartY: number;
  tracking: boolean;
  posHistory: { x: number; y: number; t: number }[];
  lastSwipeDir: string;
  lastSwipeAlpha: number;
  ripples: { x: number; y: number; r: number; maxR: number; alpha: number; color: string }[];
}

export default function SwipeNavigator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ready, error, getHandData } = useHandTracking(W, H);

  const state = useRef<SwipeState>({
    cardIndex: 0,
    offsetX: 0,
    targetOffsetX: 0,
    gestureStartX: 0,
    gestureStartY: 0,
    tracking: false,
    posHistory: [],
    lastSwipeDir: '',
    lastSwipeAlpha: 0,
    ripples: [],
  });

  useEffect(() => {
    if (!ready) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    let raf = 0;

    function drawCard(x: number, y: number, w: number, h: number, card: typeof CARDS[0], scale: number, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;

      // Card background
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 16);
      ctx.fillStyle = card.color + '20';
      ctx.fill();
      ctx.strokeStyle = card.color + '60';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner glow
      const grad = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, w * 0.6);
      grad.addColorStop(0, card.color + '15');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fill();

      // Icon
      ctx.font = `${48 * scale}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText(card.icon, x + w / 2, y + h * 0.38);

      // Title
      ctx.fillStyle = 'white';
      ctx.font = `bold ${24 * scale}px system-ui`;
      ctx.fillText(card.title, x + w / 2, y + h * 0.55);

      // Description
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${16 * scale}px system-ui`;
      ctx.fillText(card.desc, x + w / 2, y + h * 0.65);

      ctx.restore();
    }

    function draw() {
      const hand = getHandData();
      const s = state.current;
      ctx.clearRect(0, 0, W, H);

      // Track hand position history for velocity
      if (hand) {
        const now = performance.now();
        s.posHistory.push({ x: hand.indexTip.x, y: hand.indexTip.y, t: now });
        // Keep last 10 frames
        if (s.posHistory.length > 10) s.posHistory.shift();

        // Start tracking when hand appears and isn't pinching
        if (!s.tracking && !hand.isPinching) {
          s.tracking = true;
          s.gestureStartX = hand.indexTip.x;
          s.gestureStartY = hand.indexTip.y;
        }

        // Detect swipe on fist/pinch (gesture end) or large displacement
        if (s.tracking && s.posHistory.length >= 3) {
          const dx = hand.indexTip.x - s.gestureStartX;
          const recent = s.posHistory;
          const velocityX = (recent[recent.length - 1].x - recent[Math.max(0, recent.length - 4)].x) /
            Math.max(1, recent.length - 1);

          // Live drag offset
          s.targetOffsetX = dx * 0.4;

          // Check for completed swipe
          if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(velocityX) > VELOCITY_THRESHOLD) {
            if (dx < 0 && s.cardIndex < CARDS.length - 1) {
              // Swipe left = next card
              s.cardIndex++;
              s.lastSwipeDir = 'LEFT';
              s.lastSwipeAlpha = 1;
              s.ripples.push({
                x: hand.indexTip.x, y: hand.indexTip.y,
                r: 0, maxR: 200, alpha: 1, color: CARDS[s.cardIndex].color,
              });
            } else if (dx > 0 && s.cardIndex > 0) {
              // Swipe right = prev card
              s.cardIndex--;
              s.lastSwipeDir = 'RIGHT';
              s.lastSwipeAlpha = 1;
              s.ripples.push({
                x: hand.indexTip.x, y: hand.indexTip.y,
                r: 0, maxR: 200, alpha: 1, color: CARDS[s.cardIndex].color,
              });
            }
            // Reset gesture
            s.tracking = false;
            s.targetOffsetX = 0;
            s.gestureStartX = hand.indexTip.x;
            s.posHistory = [];
          }
        }

        // Reset tracking if hand closes
        if (hand.isPinching) {
          s.tracking = false;
          s.targetOffsetX = 0;
          s.gestureStartX = hand.indexTip.x;
        }
      } else {
        s.tracking = false;
        s.targetOffsetX = 0;
        s.posHistory = [];
      }

      // Animate offset
      s.offsetX += (s.targetOffsetX - s.offsetX) * 0.15;

      // Draw ripples
      s.ripples = s.ripples.filter((rip) => {
        rip.r += 6;
        rip.alpha *= 0.94;
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = rip.color + Math.floor(rip.alpha * 100).toString(16).padStart(2, '0');
        ctx.lineWidth = 3;
        ctx.stroke();
        return rip.alpha > 0.02;
      });

      // Draw cards (current + neighbors for peek)
      const cardW = 360;
      const cardH = 280;
      const cardY = H / 2 - cardH / 2 - 20;

      for (let offset = -1; offset <= 1; offset++) {
        const idx = s.cardIndex + offset;
        if (idx < 0 || idx >= CARDS.length) continue;

        const baseX = W / 2 - cardW / 2 + offset * (cardW + 40) + s.offsetX;
        const scale = offset === 0 ? 1 : 0.85;
        const alpha = offset === 0 ? 1 : 0.4;
        const adjustedW = cardW * scale;
        const adjustedH = cardH * scale;
        const adjustedX = baseX + (cardW - adjustedW) / 2;
        const adjustedY = cardY + (cardH - adjustedH) / 2;

        drawCard(adjustedX, adjustedY, adjustedW, adjustedH, CARDS[idx], scale, alpha);
      }

      // Page dots
      const dotY = cardY + cardH + 40;
      for (let i = 0; i < CARDS.length; i++) {
        ctx.beginPath();
        ctx.arc(W / 2 + (i - (CARDS.length - 1) / 2) * 20, dotY, i === s.cardIndex ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = i === s.cardIndex ? CARDS[i].color : 'rgba(255,255,255,0.2)';
        ctx.fill();
      }

      // Swipe direction flash
      if (s.lastSwipeAlpha > 0) {
        s.lastSwipeAlpha *= 0.93;
        ctx.fillStyle = `rgba(255,255,255,${s.lastSwipeAlpha * 0.6})`;
        ctx.font = 'bold 20px system-ui';
        ctx.textAlign = 'center';
        const arrow = s.lastSwipeDir === 'LEFT' ? '← SWIPE LEFT' : 'SWIPE RIGHT →';
        ctx.fillText(arrow, W / 2, dotY + 40);
      }

      // Velocity bar (visual feedback)
      if (hand && s.posHistory.length >= 2) {
        const recent = s.posHistory;
        const vx = recent[recent.length - 1].x - recent[Math.max(0, recent.length - 3)].x;
        const barLen = Math.min(Math.abs(vx) * 3, 150);
        if (barLen > 5) {
          const barX = W / 2 - barLen / 2;
          ctx.fillStyle = Math.abs(vx) > VELOCITY_THRESHOLD
            ? CARDS[s.cardIndex].color + '80'
            : 'rgba(255,255,255,0.15)';
          ctx.beginPath();
          ctx.roundRect(barX, H - 30, barLen, 6, 3);
          ctx.fill();
        }
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
      ctx.fillText('Swipe left/right to browse cards — Speed matters!', W / 2, 40);

      // Card counter
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`${s.cardIndex + 1} / ${CARDS.length}`, W - 20, 30);
      ctx.textAlign = 'left';

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, getHandData]);

  if (error) return <div style={{ color: '#FF6B6B', padding: 40 }}>Error: {error}</div>;
  if (!ready) return <div style={{ color: 'white', padding: 40 }}>Loading hand tracking model...</div>;

  return <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', margin: '0 auto', borderRadius: 12 }} />;
}
