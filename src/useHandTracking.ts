import { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { Point2DFilter } from './oneEuroFilter';

export interface HandData {
  indexTip: { x: number; y: number };
  thumbTip: { x: number; y: number };
  isPinching: boolean;
  pinchDistance: number;
  isOpenPalm: boolean;
  landmarks: NormalizedLandmark[];
}

const PINCH_THRESHOLD = 0.07;
const MAX_HANDS = 2;

function processHand(
  lm: NormalizedLandmark[],
  canvasWidth: number,
  canvasHeight: number,
  indexFilter: Point2DFilter,
  thumbFilter: Point2DFilter,
  now: number
): HandData {
  const rawIndex = { x: lm[8].x * canvasWidth, y: lm[8].y * canvasHeight };
  const rawThumb = { x: lm[4].x * canvasWidth, y: lm[4].y * canvasHeight };
  const indexTip = indexFilter.filter(rawIndex.x, rawIndex.y, now);
  const thumbTip = thumbFilter.filter(rawThumb.x, rawThumb.y, now);

  // Mirror X for natural interaction
  indexTip.x = canvasWidth - indexTip.x;
  thumbTip.x = canvasWidth - thumbTip.x;

  const dx = lm[8].x - lm[4].x;
  const dy = lm[8].y - lm[4].y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const isPinching = dist < PINCH_THRESHOLD;

  const tips = [8, 12, 16, 20];
  const mcps = [5, 9, 13, 17];
  const isOpenPalm = tips.every((t, i) => lm[t].y < lm[mcps[i]].y);

  return { indexTip, thumbTip, isPinching, pinchDistance: dist, isOpenPalm, landmarks: lm };
}

// Single-hand hook (used by shape tracer, cube, particles)
export function useHandTracking(canvasWidth: number, canvasHeight: number) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);
  const handDataRef = useRef<HandData | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const indexFilter = useRef(new Point2DFilter(30, 1.5, 0.01));
  const thumbFilter = useRef(new Point2DFilter(30, 1.5, 0.01));

  const getHandData = useCallback(() => handDataRef.current, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        if (cancelled) return;
        handLandmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });
        if (cancelled) return;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', '');
        video.muted = true;
        await video.play();
        videoRef.current = video;

        setReady(true);

        function detect() {
          if (cancelled) return;
          const v = videoRef.current!;
          const hl = handLandmarkerRef.current!;
          if (v.readyState >= 2) {
            const result = hl.detectForVideo(v, performance.now());
            if (result.landmarks && result.landmarks.length > 0) {
              const now = performance.now() / 1000;
              handDataRef.current = processHand(
                result.landmarks[0], canvasWidth, canvasHeight,
                indexFilter.current, thumbFilter.current, now
              );
            } else {
              handDataRef.current = null;
            }
          }
          animFrameRef.current = requestAnimationFrame(detect);
        }
        detect();
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message);
      }
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      handLandmarkerRef.current?.close();
    };
  }, [canvasWidth, canvasHeight]);

  return { ready, error, getHandData, videoRef };
}

// Multi-hand hook (used by piano)
export function useMultiHandTracking(canvasWidth: number, canvasHeight: number) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);
  const handsDataRef = useRef<HandData[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filters = useRef(
    Array.from({ length: MAX_HANDS }, () => ({
      index: new Point2DFilter(30, 1.5, 0.01),
      thumb: new Point2DFilter(30, 1.5, 0.01),
    }))
  );

  const getHandsData = useCallback(() => handsDataRef.current, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: MAX_HANDS,
        });
        if (cancelled) return;
        handLandmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });
        if (cancelled) return;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', '');
        video.muted = true;
        await video.play();
        videoRef.current = video;

        setReady(true);

        function detect() {
          if (cancelled) return;
          const v = videoRef.current!;
          const hl = handLandmarkerRef.current!;
          if (v.readyState >= 2) {
            const result = hl.detectForVideo(v, performance.now());
            if (result.landmarks && result.landmarks.length > 0) {
              const now = performance.now() / 1000;
              handsDataRef.current = result.landmarks.map((lm, i) =>
                processHand(
                  lm, canvasWidth, canvasHeight,
                  filters.current[i].index, filters.current[i].thumb, now
                )
              );
            } else {
              handsDataRef.current = [];
            }
          }
          animFrameRef.current = requestAnimationFrame(detect);
        }
        detect();
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message);
      }
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      handLandmarkerRef.current?.close();
    };
  }, [canvasWidth, canvasHeight]);

  return { ready, error, getHandsData, videoRef };
}
