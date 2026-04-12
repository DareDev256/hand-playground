import { useRef, useEffect } from 'react';
import { useHandTracking } from '../useHandTracking';

const W = 960;
const H = 720;

// 3D cube vertices
const VERTICES = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1],  [1, -1, 1],  [1, 1, 1],  [-1, 1, 1],
];
const EDGES = [
  [0,1],[1,2],[2,3],[3,0], // back face
  [4,5],[5,6],[6,7],[7,4], // front face
  [0,4],[1,5],[2,6],[3,7], // connections
];
const FACE_INDICES = [
  [0,1,2,3], [4,5,6,7], [0,1,5,4], [2,3,7,6], [0,3,7,4], [1,2,6,5],
];
const FACE_COLORS = [
  'rgba(78, 205, 196, 0.15)',
  'rgba(255, 107, 107, 0.15)',
  'rgba(69, 183, 209, 0.15)',
  'rgba(255, 160, 122, 0.15)',
  'rgba(152, 216, 200, 0.15)',
  'rgba(187, 143, 206, 0.15)',
];

function project(v: number[], zoom: number): { x: number; y: number; z: number } {
  const fov = 4;
  const sizeScale = 150 * (1 + zoom);
  const scale = fov / (fov + v[2]);
  return {
    x: W / 2 + v[0] * scale * sizeScale,
    y: H / 2 + v[1] * scale * sizeScale,
    z: v[2],
  };
}

function rotateX(v: number[], a: number): number[] {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

function rotateY(v: number[], a: number): number[] {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

export default function CubeController() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ready, error, getHandData } = useHandTracking(W, H);
  const rotRef = useRef({ rx: 0.4, ry: 0.4, zoom: 0, autoRotY: 0 });

  useEffect(() => {
    if (!ready) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    let raf = 0;

    function draw() {
      const hand = getHandData();
      const r = rotRef.current;
      ctx.clearRect(0, 0, W, H);

      // Update rotation from hand position
      if (hand) {
        const targetRY = ((hand.indexTip.x / W) - 0.5) * Math.PI * 2;
        const targetRX = ((hand.indexTip.y / H) - 0.5) * Math.PI * 2;
        r.ry += (targetRY - r.ry) * 0.08;
        r.rx += (targetRX - r.rx) * 0.08;
        // Pinch = zoom in. Map pinch distance (0.07 threshold) to zoom 0-2.
        // Closer pinch = higher zoom. Open hand = no zoom.
        const pinchZoom = hand.isPinching
          ? Math.max(0, 2 - hand.pinchDistance * 30)
          : 0;
        r.zoom += (pinchZoom - r.zoom) * 0.12;
      } else {
        r.autoRotY += 0.01;
      }

      const rx = hand ? r.rx : 0.4;
      const ry = hand ? r.ry : r.autoRotY;

      // Transform vertices
      const transformed = VERTICES.map((v) => {
        let tv = rotateX([...v], rx);
        tv = rotateY(tv, ry);
        return tv;
      });
      const projected = transformed.map((v) => project(v, r.zoom));

      // Draw faces (sorted by avg z)
      const facesWithZ = FACE_INDICES.map((fi, idx) => {
        const avgZ = fi.reduce((sum, i) => sum + transformed[i][2], 0) / fi.length;
        return { indices: fi, z: avgZ, color: FACE_COLORS[idx] };
      });
      facesWithZ.sort((a, b) => a.z - b.z);

      for (const face of facesWithZ) {
        ctx.beginPath();
        const p0 = projected[face.indices[0]];
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < face.indices.length; i++) {
          const p = projected[face.indices[i]];
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle = face.color;
        ctx.fill();
      }

      // Draw edges
      for (const [a, b] of EDGES) {
        const pa = projected[a];
        const pb = projected[b];
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        const avgZ = (transformed[a][2] + transformed[b][2]) / 2;
        const brightness = Math.max(0.3, Math.min(1, 0.7 - avgZ * 0.15));
        ctx.strokeStyle = `rgba(78, 205, 196, ${brightness})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw vertices
      for (const p of projected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#4ECDC4';
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
      ctx.fillText('Move hand to rotate cube — Pinch to zoom in', W / 2, 40);

      // Zoom indicator
      if (hand && r.zoom > 0.05) {
        ctx.fillStyle = '#FF6B6B';
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(`ZOOM ${Math.round(r.zoom * 50)}%`, W - 20, 30);
        ctx.textAlign = 'left';
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
