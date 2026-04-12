import { useRef, useEffect } from 'react';
import { useHandTracking } from '../useHandTracking';

const W = 960;
const H = 720;
const NUM_KEYS = 8;
const KEY_H = 180;
const KEY_GAP = 6;

// C major scale starting from C4
const NOTES = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
const NOTE_NAMES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
const KEY_COLORS = [
  '#FF6B6B', '#FF8E53', '#FFA07A', '#F7DC6F',
  '#98D8C8', '#4ECDC4', '#45B7D1', '#BB8FCE',
];

export default function PianoKeys() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ready, error, getHandData } = useHandTracking(W, H);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeOscRef = useRef<{ osc: OscillatorNode; gain: GainNode; vibrato: OscillatorNode; key: number } | null>(null);
  const keyBrightnessRef = useRef<number[]>(new Array(NUM_KEYS).fill(0));

  useEffect(() => {
    if (!ready) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    let raf = 0;

    function getKeyWidth() {
      return (W - KEY_GAP * (NUM_KEYS + 1)) / NUM_KEYS;
    }

    function getHoveredKey(x: number, y: number): number {
      if (y < H - KEY_H || y > H) return -1;
      const kw = getKeyWidth();
      for (let i = 0; i < NUM_KEYS; i++) {
        const kx = KEY_GAP + i * (kw + KEY_GAP);
        if (x >= kx && x <= kx + kw) return i;
      }
      return -1;
    }

    function playNote(keyIdx: number, sustain: boolean) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ac = audioCtxRef.current;
      const active = activeOscRef.current;

      if (active && active.key === keyIdx) {
        if (sustain) {
          active.gain.gain.setTargetAtTime(0.25, ac.currentTime, 0.1);
        }
        return;
      }

      stopNote();

      if (keyIdx < 0) return;

      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = NOTES[keyIdx];
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(0.2, ac.currentTime, 0.02);

      const vibrato = ac.createOscillator();
      const vibratoGain = ac.createGain();
      vibrato.frequency.value = 5;
      vibratoGain.gain.value = 2;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start();

      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();

      activeOscRef.current = { osc, gain, vibrato, key: keyIdx };
    }

    function stopNote() {
      if (activeOscRef.current && audioCtxRef.current) {
        const ac = audioCtxRef.current;
        const active = activeOscRef.current;
        active.gain.gain.setTargetAtTime(0, ac.currentTime, 0.06);
        const v = active;
        setTimeout(() => {
          try { v.osc.stop(); } catch {}
          try { v.vibrato.stop(); } catch {}
        }, 200);
        activeOscRef.current = null;
      }
    }

    function draw() {
      const hand = getHandData();
      ctx.clearRect(0, 0, W, H);

      const kw = getKeyWidth();
      const hoveredKey = hand ? getHoveredKey(hand.indexTip.x, hand.indexTip.y) : -1;
      const brightness = keyBrightnessRef.current;

      for (let i = 0; i < NUM_KEYS; i++) {
        const target = i === hoveredKey ? 1 : 0;
        brightness[i] += (target - brightness[i]) * 0.15;
      }

      if (hand) {
        if (hoveredKey >= 0) {
          playNote(hoveredKey, hand.isPinching);
        } else {
          stopNote();
        }
      } else {
        stopNote();
      }

      for (let i = 0; i < NUM_KEYS; i++) {
        const kx = KEY_GAP + i * (kw + KEY_GAP);
        const ky = H - KEY_H;
        const b = brightness[i];
        const color = KEY_COLORS[i];

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.roundRect(kx + 2, ky + 2, kw, KEY_H - 4, [8, 8, 12, 12]);
        ctx.fill();

        const pressed = b > 0.5;
        const yOffset = pressed ? 3 : 0;
        ctx.beginPath();
        ctx.roundRect(kx, ky + yOffset, kw, KEY_H - 4 - yOffset, [8, 8, 12, 12]);

        const grad = ctx.createLinearGradient(kx, ky, kx, ky + KEY_H);
        const baseAlpha = 0.15 + b * 0.6;
        grad.addColorStop(0, color + Math.floor(baseAlpha * 255).toString(16).padStart(2, '0'));
        grad.addColorStop(1, color + Math.floor((baseAlpha * 0.5) * 255).toString(16).padStart(2, '0'));
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = color + Math.floor((0.3 + b * 0.7) * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 2;
        ctx.stroke();

        if (b > 0.1) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 20 * b;
          ctx.beginPath();
          ctx.roundRect(kx, ky + yOffset, kw, KEY_H - 4 - yOffset, [8, 8, 12, 12]);
          ctx.strokeStyle = color + Math.floor(b * 150).toString(16).padStart(2, '0');
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = `rgba(255,255,255,${0.4 + b * 0.6})`;
        ctx.font = `${pressed ? 'bold ' : ''}18px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(NOTE_NAMES[i], kx + kw / 2, ky + KEY_H - 24);
      }

      if (hand?.isPinching && hoveredKey >= 0) {
        ctx.fillStyle = '#FF6B6B';
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('SUSTAIN', W / 2, H - KEY_H - 20);
      }

      if (hand) {
        ctx.beginPath();
        ctx.arc(hand.indexTip.x, hand.indexTip.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = hand.isPinching ? '#FF6B6B' : '#4ECDC4';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Hover over keys to play — Pinch to sustain', W / 2, 40);

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      stopNote();
    };
  }, [ready, getHandData]);

  if (error) return <div style={{ color: '#FF6B6B', padding: 40 }}>Error: {error}</div>;
  if (!ready) return <div style={{ color: 'white', padding: 40 }}>Loading hand tracking model...</div>;

  return <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', margin: '0 auto', borderRadius: 12 }} />;
}
