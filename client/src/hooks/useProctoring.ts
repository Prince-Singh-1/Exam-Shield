import { useEffect, useRef, useState } from 'react';

type Report = (type: string, detail: string, capture?: Blob | null) => void;

/**
 * AI proctoring engine for the online exam.
 *
 * Loads TensorFlow.js + COCO-SSD from a CDN at runtime to detect:
 *  - mobile phones / suspicious objects (PHONE_DETECTED)
 *  - multiple people in frame (MULTIPLE_FACES)
 *  - no person in frame (NO_FACE / gaze away proxy)
 * and uses the Web Audio API to detect talking (VOICE_DETECTED).
 *
 * On each detection it grabs a timestamped snapshot from the webcam and passes
 * it to `report` so the client can upload it as violation evidence.
 */
export function useProctoring(active: boolean, report: Report) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'running' | 'error'>('idle');
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'running' | 'unavailable'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const lastFired = useRef<Record<string, number>>({});

  function throttle(key: string, ms = 6000) {
    const now = Date.now();
    if (now - (lastFired.current[key] ?? 0) < ms) return false;
    lastFired.current[key] = now;
    return true;
  }

  function snapshot(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c) return resolve(null);
      c.width = v.videoWidth || 320;
      c.height = v.videoHeight || 240;
      c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b), 'image/png');
    });
  }

  async function loadScript(src: string) {
    return new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  useEffect(() => {
    if (!active) {
      setStatus('idle');
      setAiStatus('idle');
      setErrorMessage('');
      return;
    }
    let loopTimer = 0;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let model: any = null;

    async function start() {
      try {
        setStatus('requesting');
        setErrorMessage('');
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera and microphone access is not supported in this browser.');
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        // Audio (voice) detection
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume().catch(() => undefined);
        }
        setStatus('running');

        setAiStatus('loading');
        Promise.resolve()
          .then(() => loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js'))
          .then(() =>
            loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js'),
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then(() => (window as any).cocoSsd.load())
          .then((loadedModel) => {
            if (cancelled) return;
            model = loadedModel;
            setAiStatus('running');
          })
          .catch((error) => {
            console.error(error);
            if (!cancelled) setAiStatus('unavailable');
          });

        const loop = async () => {
          if (cancelled) return;
          // Audio level
          analyser.getByteFrequencyData(buf);
          const level = buf.reduce((a, b) => a + b, 0) / buf.length;
          if (level > 35 && throttle('VOICE')) {
            report('VOICE_DETECTED', `Audio level ${level.toFixed(0)}`, await snapshot());
          }

          // Object/person detection
          if (model && videoRef.current && videoRef.current.readyState === 4) {
            const preds = await model.detect(videoRef.current);
            const people = preds.filter((p: any) => p.class === 'person');
            const phone = preds.find(
              (p: any) => p.class === 'cell phone' || p.class === 'laptop' || p.class === 'book',
            );
            if (phone && throttle('PHONE')) {
              report('PHONE_DETECTED', `Detected ${phone.class}`, await snapshot());
            }
            if (people.length > 1 && throttle('FACES')) {
              report('MULTIPLE_FACES', `${people.length} people in frame`, await snapshot());
            }
            if (people.length === 0 && throttle('NOFACE')) {
              report('NO_FACE', 'No person detected (looking away?)', await snapshot());
            }
          }
          loopTimer = window.setTimeout(loop, 1200);
        };
        loop();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        const message =
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Camera and microphone permission was denied. Allow both permissions, then restart the exam.'
            : e instanceof Error
              ? e.message
              : 'Could not start camera and microphone.';
        setErrorMessage(message);
        setStatus('error');
        setAiStatus('unavailable');
      }
    }

    start();
    return () => {
      cancelled = true;
      window.clearTimeout(loopTimer);
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close().catch(() => undefined);
    };
  }, [active, report]);

  return { videoRef, canvasRef, status, aiStatus, errorMessage };
}
