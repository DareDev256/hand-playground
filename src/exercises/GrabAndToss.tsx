import { useRef, useEffect } from 'react';
import { useHandTracking } from '../useHandTracking';

const W = 960;
const H = 720;
const GRAVITY = 0.3;
const FRICTION = 0.985;
const BOUNCE = 0.7;

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  grabbed: boolean;
  trail: { x: number; y: number }[];
}

const BALL_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#BB8FCE', '#98D8C8', '#FFA07A', '#82E0AA'];

function createBalls(): Ball[] {
  return Array.from({ length: 8 }, (_, i) => ({
    x: 100 + (i % 4) * 200 + Math.random() * 60,
    y: 150 + Math.floor(i / 4) * 200 + Math.random() * 60,
    vx: 0,
    vy: 0,
    radius: 25 + Math.random() * 15,
    color: BALL_COLORS[i],
    grabbed: false,
    trail: [],
  }));
}

interface GrabState {
  ballIdx: number;
  grabHistory: { x: number; y: number; t: number }[];
}

export default function GrabAndToss() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ready, error, getHandData } = useHandTracking(W, H);
  const ballsRef = useRef<Ball[]>(createBalls());
  const grabRef = useRef<GrabState | null>(null);
  const scoreRef = useRef({ tosses: 0, maxSpeed: 0 });

  useEffect(() => {
    if (!ready) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    let raf = 0;

    function draw() {
      const hand = getHandData();
      const balls = ballsRef.current;
      const score = scoreRef.current;
      ctx.clearRect(0, 0, W, H);

      // Floor
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, H - 60, W, 60);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(0, H - 60);
      ctx.lineTo(W, H - 60);
      ctx.stroke();

      // Handle grabbing
      if (hand) {
        const hx = hand.indexTip.x;
        const hy = hand.indexTip.y;

        if (hand.isPinching) {
          if (grabRef.current === null) {
            // Try to grab nearest ball
            let nearest = -1;
            let nearestDist = Infinity;
            for (let i = 0; i < balls.length; i++) {
              const dx = hx - balls[i].x;
              const dy = hy - balls[i].y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < balls[i].radius + 30 && dist < nearestDist) {
                nearest = i;
                nearestDist = dist;
              }
            }
            if (nearest >= 0) {
              grabRef.current = { ballIdx: nearest, grabHistory: [] };
              balls[nearest].grabbed = true;
              balls[nearest].vx = 0;
              balls[nearest].vy = 0;
            }
          }

          if (grabRef.current !== null) {
            const ball = balls[grabRef.current.ballIdx];
            // Move ball to hand
            ball.x += (hx - ball.x) * 0.4;
            ball.y += (hy - ball.y) * 0.4;
            ball.vx = 0;
            ball.vy = 0;

            // Track position for velocity on release
            grabRef.current.grabHistory.push({ x: hx, y: hy, t: performance.now() });
            if (grabRef.current.grabHistory.length > 8) grabRef.current.grabHistory.shift();
          }
        } else {
          // Release — calculate toss velocity
          if (grabRef.current !== null) {
            const ball = balls[grabRef.current.ballIdx];
            ball.grabbed = false;
            const hist = grabRef.current.grabHistory;

            if (hist.length >= 2) {
              const last = hist[hist.length - 1];
              const prev = hist[Math.max(0, hist.length - 4)];
              const dt = (last.t - prev.t) / 16; // normalize to frames
              if (dt > 0) {
                ball.vx = (last.x - prev.x) / dt * 1.2;
                ball.vy = (last.y - prev.y) / dt * 1.2;
                const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                score.tosses++;
                if (speed > score.maxSpeed) score.maxSpeed = speed;
              }
            }
            grabRef.current = null;
          }
        }
      } else {
        // Lost hand — release any grab
        if (grabRef.current !== null) {
          balls[grabRef.current.ballIdx].grabbed = false;
          grabRef.current = null;
        }
      }

      // Physics for all balls
      for (const ball of balls) {
        if (ball.grabbed) continue;

        ball.vy += GRAVITY;
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.vx *= FRICTION;
        ball.vy *= FRICTION;

        // Bounce off walls
        if (ball.x - ball.radius < 0) {
          ball.x = ball.radius;
          ball.vx = Math.abs(ball.vx) * BOUNCE;
        }
        if (ball.x + ball.radius > W) {
          ball.x = W - ball.radius;
          ball.vx = -Math.abs(ball.vx) * BOUNCE;
        }

        // Floor bounce
        if (ball.y + ball.radius > H - 60) {
          ball.y = H - 60 - ball.radius;
          ball.vy = -Math.abs(ball.vy) * BOUNCE;
          // Kill tiny bounces
          if (Math.abs(ball.vy) < 1) ball.vy = 0;
        }

        // Ceiling
        if (ball.y - ball.radius < 0) {
          ball.y = ball.radius;
          ball.vy = Math.abs(ball.vy) * BOUNCE;
        }

        // Ball-to-ball collision
        for (const other of balls) {
          if (other === ball || other.grabbed) continue;
          const dx = other.x - ball.x;
          const dy = other.y - ball.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = ball.radius + other.radius;
          if (dist < minDist && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            ball.x -= nx * overlap * 0.5;
            ball.y -= ny * overlap * 0.5;
            other.x += nx * overlap * 0.5;
            other.y += ny * overlap * 0.5;
            // Exchange velocities along collision normal
            const dvx = ball.vx - other.vx;
            const dvy = ball.vy - other.vy;
            const dot = dvx * nx + dvy * ny;
            if (dot > 0) {
              ball.vx -= dot * nx * 0.5;
              ball.vy -= dot * ny * 0.5;
              other.vx += dot * nx * 0.5;
              other.vy += dot * ny * 0.5;
            }
          }
        }

        // Trail
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > 2) {
          ball.trail.push({ x: ball.x, y: ball.y });
          if (ball.trail.length > 12) ball.trail.shift();
        } else {
          if (ball.trail.length > 0) ball.trail.shift();
        }
      }

      // Draw trails
      for (const ball of balls) {
        if (ball.trail.length < 2) continue;
        for (let i = 1; i < ball.trail.length; i++) {
          const alpha = i / ball.trail.length;
          ctx.beginPath();
          ctx.moveTo(ball.trail[i - 1].x, ball.trail[i - 1].y);
          ctx.lineTo(ball.trail[i].x, ball.trail[i].y);
          ctx.strokeStyle = ball.color + Math.floor(alpha * 80).toString(16).padStart(2, '0');
          ctx.lineWidth = ball.radius * 0.4 * alpha;
          ctx.stroke();
        }
      }

      // Draw balls
      for (const ball of balls) {
        // Shadow
        ctx.beginPath();
        ctx.ellipse(ball.x, H - 56, ball.radius * 0.7, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fill();

        // Ball glow when grabbed
        if (ball.grabbed) {
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius + 10, 0, Math.PI * 2);
          ctx.fillStyle = ball.color + '30';
          ctx.fill();
        }

        // Ball body
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(
          ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, 0,
          ball.x, ball.y, ball.radius
        );
        grad.addColorStop(0, ball.color);
        grad.addColorStop(1, ball.color + '80');
        ctx.fillStyle = grad;
        ctx.fill();

        // Highlight
        ctx.beginPath();
        ctx.arc(ball.x - ball.radius * 0.25, ball.y - ball.radius * 0.25, ball.radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();

        // Speed indicator
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > 5) {
          ctx.strokeStyle = ball.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, ball.radius + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Grab line from hand to grabbed ball
      if (hand && grabRef.current !== null) {
        const ball = balls[grabRef.current.ballIdx];
        ctx.beginPath();
        ctx.moveTo(hand.indexTip.x, hand.indexTip.y);
        ctx.lineTo(ball.x, ball.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Cursor
      if (hand) {
        const isGrabbing = grabRef.current !== null;
        ctx.beginPath();
        ctx.arc(hand.indexTip.x, hand.indexTip.y, isGrabbing ? 12 : 8, 0, Math.PI * 2);
        ctx.fillStyle = hand.isPinching ? '#FF6B6B' : '#4ECDC4';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (isGrabbing) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.font = '11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('GRAB', hand.indexTip.x, hand.indexTip.y - 18);
        }
      }

      // Stats
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '13px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`Tosses: ${score.tosses}`, 20, H - 20);
      if (score.maxSpeed > 0) {
        ctx.fillText(`Top speed: ${Math.round(score.maxSpeed * 10)}`, 20, H - 38);
      }

      // Instructions
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Pinch near a ball to grab — Release to toss — Speed = momentum', W / 2, 40);

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, getHandData]);

  if (error) return <div style={{ color: '#FF6B6B', padding: 40 }}>Error: {error}</div>;
  if (!ready) return <div style={{ color: 'white', padding: 40 }}>Loading hand tracking model...</div>;

  return <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', margin: '0 auto', borderRadius: 12 }} />;
}
