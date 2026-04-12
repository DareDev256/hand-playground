import { useRef, useEffect, useState } from 'react';
import { useHandTracking, type HandData } from '../useHandTracking';

const W = 960;
const H = 720;

type ShapeType = 'circle' | 'triangle' | 'star';

interface Shape {
  type: ShapeType;
  points: { x: number; y: number }[];
  center: { x: number; y: number };
  radius: number;
}

function generateShape(type: ShapeType): Shape {
  const cx = W / 2;
  const cy = H / 2;
  const r = 140;
  const points: { x: number; y: number }[] = [];

  if (type === 'circle') {
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2 - Math.PI / 2;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  } else if (type === 'triangle') {
    for (let i = 0; i <= 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  } else {
    // star
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const sr = i % 2 === 0 ? r : r * 0.45;
      points.push({ x: cx + Math.cos(a) * sr, y: cy + Math.sin(a) * sr });
    }
  }

  return { type, points, center: { x: cx, y: cy }, radius: r };
}

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
const SHAPE_ORDER: ShapeType[] = ['circle', 'triangle', 'star'];

export default function ShapeTracer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ready, error, getHandData } = useHandTracking(W, H);
  const [shapeIdx, setShapeIdx] = useState(0);

  const stateRef = useRef({
    shape: generateShape('circle'),
    traceProgress: 0,
    nextPointIdx: 0,
    completed: false,
    sparkles: [] as Sparkle[],
    fillAlpha: 0,
    completedColor: COLORS[0],
    tracePoints: [] as { x: number; y: number }[],
  });

  useEffect(() => {
    const s = stateRef.current;
    s.shape = generateShape(SHAPE_ORDER[shapeIdx]);
    s.traceProgress = 0;
    s.nextPointIdx = 0;
    s.completed = false;
    s.sparkles = [];
    s.fillAlpha = 0;
    s.completedColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    s.tracePoints = [];
  }, [shapeIdx]);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;

    function draw() {
      const hand = getHandData();
      const s = stateRef.current;
      ctx.clearRect(0, 0, W, H);

      // Draw target shape outline
      ctx.beginPath();
      const pts = s.shape.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      if (s.shape.type === 'circle') {
        ctx.arc(s.shape.center.x, s.shape.center.y, s.shape.radius, 0, Math.PI * 2);
      } else {
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
      }
      ctx.strokeStyle = s.completed ? s.completedColor : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = s.completed ? 4 : 3;
      ctx.setLineDash(s.completed ? [] : [12, 8]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fill if completed
      if (s.completed) {
        s.fillAlpha = Math.min(s.fillAlpha + 0.02, 0.5);
        ctx.fillStyle = s.completedColor + Math.floor(s.fillAlpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
      }

      // Draw traced path
      if (s.tracePoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(s.tracePoints[0].x, s.tracePoints[0].y);
        for (let i = 1; i < s.tracePoints.length; i++) {
          ctx.lineTo(s.tracePoints[i].x, s.tracePoints[i].y);
        }
        ctx.strokeStyle = '#4ECDC4';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw next target point
      if (!s.completed && s.nextPointIdx < pts.length) {
        const tp = pts[s.nextPointIdx];
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(78, 205, 196, 0.6)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#4ECDC4';
        ctx.fill();
      }

      // Progress bar
      const progress = s.completed ? 1 : s.nextPointIdx / pts.length;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(30, H - 40, W - 60, 10);
      ctx.fillStyle = s.completed ? s.completedColor : '#4ECDC4';
      ctx.fillRect(30, H - 40, (W - 60) * progress, 10);

      // Hand tracking logic
      if (hand && !s.completed) {
        checkTrace(hand, s);
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

      // Sparkles
      updateSparkles(ctx, s);

      // Instructions
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      if (s.completed) {
        ctx.fillStyle = s.completedColor;
        ctx.font = 'bold 24px system-ui';
        ctx.fillText('Nice! Pinch to go next', W / 2, 40);
        if (hand?.isPinching) {
          setShapeIdx((i) => (i + 1) % SHAPE_ORDER.length);
        }
      } else {
        ctx.fillText(`Trace the ${s.shape.type} — move your finger to the glowing dot`, W / 2, 40);
      }

      // Shape label
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`Shape ${shapeIdx + 1}/${SHAPE_ORDER.length}: ${s.shape.type}`, W - 20, 30);
      ctx.textAlign = 'left';

      raf = requestAnimationFrame(draw);
    }

    function checkTrace(hand: HandData, s: typeof stateRef.current) {
      const pts = s.shape.points;
      if (s.nextPointIdx >= pts.length) return;

      const tp = pts[s.nextPointIdx];
      const dx = hand.indexTip.x - tp.x;
      const dy = hand.indexTip.y - tp.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 35) {
        s.tracePoints.push({ x: tp.x, y: tp.y });
        s.nextPointIdx++;

        // Small sparkle burst on each point hit
        for (let i = 0; i < 5; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 2;
          s.sparkles.push({
            x: tp.x,
            y: tp.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30,
            maxLife: 30,
            size: 2 + Math.random() * 3,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
          });
        }

        if (s.nextPointIdx >= pts.length) {
          s.completed = true;
          // Big sparkle burst
          for (let i = 0; i < 80; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            s.sparkles.push({
              x: s.shape.center.x + (Math.random() - 0.5) * 100,
              y: s.shape.center.y + (Math.random() - 0.5) * 100,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 40 + Math.random() * 40,
              maxLife: 80,
              size: 2 + Math.random() * 5,
              color: COLORS[Math.floor(Math.random() * COLORS.length)],
            });
          }
        }
      }
    }

    function updateSparkles(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
      s.sparkles = s.sparkles.filter((sp) => {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.05;
        sp.life--;
        const alpha = sp.life / sp.maxLife;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = sp.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
        return sp.life > 0;
      });
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, getHandData, shapeIdx]);

  if (error) return <div style={{ color: '#FF6B6B', padding: 40 }}>Error: {error}</div>;
  if (!ready) return <div style={{ color: 'white', padding: 40 }}>Loading hand tracking model...</div>;

  return <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', margin: '0 auto', borderRadius: 12 }} />;
}
