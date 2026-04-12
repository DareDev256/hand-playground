import { useRef, useEffect } from 'react';
import { useHandTracking } from '../useHandTracking';

const W = 960;
const H = 720;
const NUM_PARTICLES = 200;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  hue: number;
  baseSpeed: number;
}

const PALETTE = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#82E0AA'];

function createParticles(): Particle[] {
  return Array.from({ length: NUM_PARTICLES }, () => {
    const hue = Math.random() * 360;
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: 2 + Math.random() * 4,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      hue,
      baseSpeed: 0.5 + Math.random() * 1.5,
    };
  });
}

export default function ParticleMagnet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ready, error, getHandData } = useHandTracking(W, H);
  const particlesRef = useRef<Particle[]>(createParticles());
  const frozenRef = useRef(false);
  const modeRef = useRef<'attract' | 'repel' | 'freeze'>('attract');

  useEffect(() => {
    if (!ready) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    let raf = 0;

    function draw() {
      const hand = getHandData();
      const particles = particlesRef.current;

      // Fade trail
      ctx.fillStyle = 'rgba(15, 15, 25, 0.15)';
      ctx.fillRect(0, 0, W, H);

      // Determine mode
      let mode: 'attract' | 'repel' | 'freeze' = 'attract';
      if (hand) {
        if (hand.isOpenPalm && !hand.isPinching) {
          mode = 'freeze';
        } else if (hand.isPinching) {
          mode = 'repel';
        } else {
          mode = 'attract';
        }
      }
      modeRef.current = mode;

      // Handle freeze transition
      if (mode === 'freeze' && !frozenRef.current) {
        frozenRef.current = true;
      } else if (mode !== 'freeze') {
        frozenRef.current = false;
      }

      for (const p of particles) {
        if (hand && mode !== 'freeze') {
          const dx = hand.indexTip.x - p.x;
          const dy = hand.indexTip.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 300;

          if (dist < maxDist && dist > 1) {
            const force = (1 - dist / maxDist) * 0.8;
            const nx = dx / dist;
            const ny = dy / dist;

            if (mode === 'attract') {
              // Attract + orbit effect
              p.vx += nx * force * 0.5;
              p.vy += ny * force * 0.5;
              // Tangential force for orbiting
              p.vx += -ny * force * 0.3;
              p.vy += nx * force * 0.3;
            } else {
              // Repel
              p.vx -= nx * force * 2.0;
              p.vy -= ny * force * 2.0;
            }
          }
        }

        if (!frozenRef.current) {
          // Apply velocity
          p.x += p.vx;
          p.y += p.vy;

          // Damping
          p.vx *= 0.97;
          p.vy *= 0.97;

          // Gentle drift when no hand
          if (!hand) {
            p.vx += (Math.random() - 0.5) * 0.1;
            p.vy += (Math.random() - 0.5) * 0.1;
          }

          // Wrap around edges
          if (p.x < -10) p.x = W + 10;
          if (p.x > W + 10) p.x = -10;
          if (p.y < -10) p.y = H + 10;
          if (p.y > H + 10) p.y = -10;
        }

        // Draw particle
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const glowSize = p.size + Math.min(speed * 2, 6);

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = p.color + '30';
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Trail line when moving fast
        if (speed > 2 && !frozenRef.current) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
          ctx.strokeStyle = p.color + '40';
          ctx.lineWidth = p.size * 0.5;
          ctx.stroke();
        }

        // Draw connections to nearby particles
        if (hand && mode === 'attract') {
          const dx = hand.indexTip.x - p.x;
          const dy = hand.indexTip.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(hand.indexTip.x, hand.indexTip.y);
            ctx.strokeStyle = p.color + Math.floor((1 - dist / 80) * 60).toString(16).padStart(2, '0');
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Cursor with mode indicator
      if (hand) {
        // Outer ring
        ctx.beginPath();
        ctx.arc(hand.indexTip.x, hand.indexTip.y, mode === 'repel' ? 20 : 12, 0, Math.PI * 2);
        ctx.strokeStyle = mode === 'repel' ? '#FF6B6B' : mode === 'freeze' ? '#F7DC6F' : '#4ECDC4';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(hand.indexTip.x, hand.indexTip.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = mode === 'repel' ? '#FF6B6B' : mode === 'freeze' ? '#F7DC6F' : '#4ECDC4';
        ctx.fill();

        // Freeze icon (snowflake-ish)
        if (mode === 'freeze') {
          ctx.strokeStyle = '#F7DC6F80';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(hand.indexTip.x, hand.indexTip.y);
            ctx.lineTo(
              hand.indexTip.x + Math.cos(a) * 18,
              hand.indexTip.y + Math.sin(a) * 18
            );
            ctx.stroke();
          }
        }
      }

      // Instructions
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Point to attract — Pinch to repel — Open palm to freeze', W / 2, 40);

      // Mode indicator
      if (hand) {
        const modeLabel = mode === 'attract' ? 'ATTRACT' : mode === 'repel' ? 'REPEL' : 'FROZEN';
        const modeColor = mode === 'attract' ? '#4ECDC4' : mode === 'repel' ? '#FF6B6B' : '#F7DC6F';
        ctx.fillStyle = modeColor;
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(modeLabel, W - 20, 30);
        ctx.textAlign = 'left';
      }

      raf = requestAnimationFrame(draw);
    }

    // Clear canvas initially
    ctx.fillStyle = '#0f0f19';
    ctx.fillRect(0, 0, W, H);

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, getHandData]);

  if (error) return <div style={{ color: '#FF6B6B', padding: 40 }}>Error: {error}</div>;
  if (!ready) return <div style={{ color: 'white', padding: 40 }}>Loading hand tracking model...</div>;

  return <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', margin: '0 auto', borderRadius: 12 }} />;
}
