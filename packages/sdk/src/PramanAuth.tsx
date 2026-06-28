import React, { useState, useRef, useEffect, useCallback } from 'react';
import { initPraman } from './client';
import { AuthResult, PramanErrors } from './types';
import { useLivenessGuard } from './liveness';
import { DeviceGuard } from './device';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

interface PramanAuthProps {
  apiKey: string;
  network: string;
  mode: 'register' | 'login';
  signer: any; // Ethers Signer instance
  faceapiInstance: any; // Face-api.js instance (loaded on window or imported)
  pii?: { name: string; email: string; mobile: string }; // Needed for register
  onSuccess: (result: AuthResult) => void;
  onError: (error: string) => void;
  webhookUrl?: string;
  buttonText?: string;
  className?: string;
  liveness?: boolean | 'strict' | 'standard' | 'off';
  onLog?: (message: string) => void;
}

export const PramanAuth: React.FC<PramanAuthProps> = ({
  apiKey,
  network,
  mode,
  signer,
  faceapiInstance,
  pii,
  onSuccess,
  onError,
  webhookUrl,
  buttonText,
  className,
  liveness = 'standard',
  onLog,
}) => {
  // Normalize liveness setting (enforce 'strict' for register mode, ignore bypass configs)
  const livenessLevel =
    mode === 'register'
      ? 'strict'
      : liveness === true
      ? 'standard'
      : liveness === false || liveness === 'off'
      ? 'off'
      : liveness;

  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessageState] = useState('');

  // Status Logger wrapper
  const setStatusMessage = useCallback((msg: string) => {
    setStatusMessageState(msg);
    if (onLog) {
      onLog(msg);
    }
  }, [onLog]);


  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const alignmentStateRef = useRef<'unaligned' | 'detecting' | 'ready'>('unaligned');
  const [alignmentState, setAlignmentState] = useState<'unaligned' | 'detecting' | 'ready'>('unaligned');

  const updateAlignmentState = useCallback((state: 'unaligned' | 'detecting' | 'ready') => {
    alignmentStateRef.current = state;
    setAlignmentState(state);
  }, []);

  const lastStepRef = useRef<number>(0);
  const lastStepTimeRef = useRef<number>(Date.now());

  const [landmarker, setLandmarker] = useState<FaceLandmarker | null>(null);
  const [isLandmarkerLoading, setIsLandmarkerLoading] = useState(false);

  // Load MediaPipe FaceLandmarker once on mount
  useEffect(() => {
    let active = true;
    const initMediaPipe = async () => {
      try {
        setIsLandmarkerLoading(true);
        setStatusMessage('Loading FaceLandmarker models...');
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const fl = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        if (active) {
          setLandmarker(fl);
          setStatusMessage('FaceLandmarker models loaded.');
        }
      } catch (err: any) {
        console.error('Failed to load FaceLandmarker:', err);
        setStatusMessage('Failed to load FaceLandmarker models.');
      } finally {
        if (active) {
          setIsLandmarkerLoading(false);
        }
      }
    };
    initMediaPipe();
    return () => {
      active = false;
    };
  }, []);

  const drawCanvasOverlay = useCallback((
    state: 'unaligned' | 'detecting' | 'ready',
    box?: { x: number; y: number; width: number; height: number }
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // 1. Draw circular crop mask (darken outside area)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, (width / 2) * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // 2. Draw border ring
    let ringColor = '#ef4444'; // Red
    if (state === 'detecting') ringColor = '#eab308'; // Yellow
    if (state === 'ready') ringColor = '#10b981'; // Green

    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, (width / 2) * 0.8, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Draw face bounding box guide if face is detected (subtle guide)
    if (box) {
      const scale = width / 480;
      const offsetX = (640 * scale - width) / 2;
      const canvasX = box.x * scale - offsetX;
      const canvasY = box.y * scale;
      const canvasWidth = box.width * scale;
      const canvasHeight = box.height * scale;

      ctx.strokeStyle = `${ringColor}66`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);
      ctx.setLineDash([]);
    }
  }, []);

  // Handover state
  const [isHandoverActive, setIsHandoverActive] = useState(false);
  const [handoverSessionId, setHandoverSessionId] = useState<string | null>(null);
  const [handoverToken, setHandoverToken] = useState<string | null>(null);

  // Handover client role state (when opened on mobile via QR code link)
  const [handoverUrlToken, setHandoverUrlToken] = useState<string | null>(null);
  const [handoverSessionData, setHandoverSessionData] = useState<{
    sessionId: string;
    address: string;
    mode: 'register' | 'login';
  } | null>(null);

  // Hook for active spoofing liveness checks
  const {
    status: livenessStatus,
    evaluateFrame,
    failAttempt,
    resetAll,
    resetLockout,
  } = useLivenessGuard(livenessLevel);

  // Detect handover URL parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('handoverToken');
      if (token) {
        setHandoverUrlToken(token);
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            setHandoverSessionData({
              sessionId: payload.sessionId,
              address: payload.sub,
              mode: payload.mode,
            });
            setStatusMessage('Initialized mobile camera handover scan...');
          }
        } catch (e) {
          console.error('[PramanSDK] Failed parsing handover token:', e);
        }
      }
    }
  }, []);

  const stopScanning = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  // Initiate Cross-Device Handover Modal
  const startHandoverFlow = async () => {
    try {
      setIsHandoverActive(true);
      setStatusMessage('Initializing mobile handover session...');
      const serverUrl = 'http://localhost:4000';

      const userAddress = signer ? await signer.getAddress() : '';
      const response = await fetch(`${serverUrl}/api/handover/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: userAddress,
          mode,
        }),
      });
      const data = await response.json();

      if (data.success) {
        setHandoverSessionId(data.sessionId);
        setHandoverToken(data.handoverToken);
        
        // Save to local storage for local tab sync
        const handoverUrl = `${window.location.origin}${window.location.pathname}?handoverToken=${data.handoverToken}`;
        localStorage.setItem(`handover_url_${data.sessionId}`, handoverUrl);
      } else {
        throw new Error(data.error || 'Backend failed initialization');
      }
    } catch (err) {
      console.warn('[PramanSDK] Server handover initialization failed, fallback to local cross-tab mode.');
      const localSessionId = 'sess_local_' + Math.random().toString(36).substring(2, 15);
      const localToken = generateLocalHandoverToken(localSessionId, signer ? await signer.getAddress() : '', mode);
      setHandoverSessionId(localSessionId);
      setHandoverToken(localToken);
      const handoverUrl = `${window.location.origin}${window.location.pathname}?handoverToken=${localToken}`;
      localStorage.setItem(`handover_url_${localSessionId}`, handoverUrl);
    }
  };

  const generateLocalHandoverToken = (sessionId: string, address: string, modeStr: string) => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: address?.toLowerCase() || 'unknown',
      sessionId,
      mode: modeStr,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    return `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.local_mock_sig`;
  };

  // Poll server or listen to localStorage for handover session status
  useEffect(() => {
    if (!handoverSessionId || !isHandoverActive) return;

    const serverUrl = 'http://localhost:4000';
    let pollInterval: any;

    pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${serverUrl}/api/handover/status/${handoverSessionId}`);
        const data = await response.json();
        if (data.success && data.status === 'completed') {
          clearInterval(pollInterval);
          setIsHandoverActive(false);
          setHandoverSessionId(null);
          setHandoverToken(null);
          
          if (data.result.success) {
            onSuccess(data.result);
          } else {
            onError(data.result.error || 'Handover authentication failed');
          }
        }
      } catch (err) {
        // Continue polling / non-blocking
      }
    }, 2000);

    // Cross-tab Local Storage Listener (instant sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `handover_result_${handoverSessionId}` && e.newValue) {
        try {
          const result = JSON.parse(e.newValue);
          clearInterval(pollInterval);
          setIsHandoverActive(false);
          setHandoverSessionId(null);
          setHandoverToken(null);
          localStorage.removeItem(`handover_result_${handoverSessionId}`);

          if (result.success) {
            onSuccess(result);
          } else {
            onError(result.error || 'Handover authentication failed');
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Handover Timeout safety (5 minutes)
    const timeoutId = setTimeout(() => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
      setIsHandoverActive(false);
      setHandoverSessionId(null);
      setHandoverToken(null);
      onError(`${PramanErrors.HANDOVER_TIMEOUT}: Cross-device handover session timed out.`);
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
      clearTimeout(timeoutId);
    };
  }, [handoverSessionId, isHandoverActive, onError, onSuccess]);

  const startScanning = async () => {
    try {
      if (mode === 'register' && (!pii || !pii.name || !pii.email)) {
        throw new Error('Registration mode requires valid PII fields (name, email)');
      }
      if (!signer) {
        throw new Error('Web3 provider wallet signer is required');
      }
      if (!faceapiInstance) {
        throw new Error('face-api.js instance is required');
      }
      if (livenessLevel !== 'off' && !landmarker) {
        throw new Error('FaceLandmarker model is not loaded yet');
      }

      // Check lockout status
      if (livenessStatus.isLocked) {
        onError(`${PramanErrors.LIVELINESS_FAILED}: Spoofing lockout active.`);
        return;
      }

      setIsScanning(true);
      setStatusMessage('Requesting camera authorization...');

      // 1. Initial Device scan: 0 cameras check
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        if (videoDevices.length === 0) {
          stopScanning();
          await startHandoverFlow();
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 2. Post-permission Device scan: Virtual camera check
      const guardResult = await DeviceGuard.scanDevices();
      if (guardResult.isVirtual) {
        // Stop stream
        stream.getTracks().forEach((track) => track.stop());
        throw new Error(
          `${PramanErrors.VIRTUAL_CAMERA_DETECTED}: Virtual camera "${guardResult.virtualCameraLabel}" flagged. Please connect a physical camera.`
        );
      }

      resetAll();
      setStatusMessage('Aligning face and starting active liveness check...');
    } catch (err: any) {
      stopScanning();
      if (
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.includes('Permission denied') ||
        err.message === 'NO_CAMERAS'
      ) {
        // User denied camera or has no cameras -> Handover
        await startHandoverFlow();
      } else {
        onError(err.message || 'Failed to start camera access');
      }
    }
  };

  // Perform client-side verification logic once liveness challenges are met
  const captureAndAuthenticateAuto = async (score: number) => {
    if (!videoRef.current) return;

    try {
      if (livenessLevel !== 'off' && score < 0.85) {
        throw new Error('Liveness check score too low (below 85%). Authentication blocked.');
      }
      setIsProcessing(true);
      setStatusMessage('Capturing face vector profile...');

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas context');

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const webcamScreenshot = canvas.toDataURL('image/jpeg');

      // Stop camera feed
      stopScanning();

      const praman = initPraman({ apiKey, network, webhookUrl });
      let res: AuthResult;

      if (mode === 'register') {
        setStatusMessage('Signing up face identity structure...');
        res = await praman.register(
          webcamScreenshot,
          pii!,
          signer,
          faceapiInstance,
          (progress) => setStatusMessage(progress.message)
        );
      } else {
        setStatusMessage('Generating Zero-Knowledge similarity verification...');
        res = await praman.login(
          webcamScreenshot,
          signer,
          faceapiInstance,
          (progress) => setStatusMessage(progress.message)
        );
      }

      if (res.success) {
        res.livenessScore = score;
        onSuccess(res);
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      onError(err.message || 'Authentication process failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto trigger capture when challenges complete successfully
  useEffect(() => {
    if (livenessStatus.completed && isScanning) {
      const minScore = livenessLevel === 'strict' ? 0.95 : 0.85;
      if (livenessStatus.score >= minScore) {
        captureAndAuthenticateAuto(livenessStatus.score);
      } else {
        failAttempt();
        setStatusMessage(
          `Liveness score too low (${livenessStatus.score}). Attempt ${livenessStatus.attempts + 1} failed.`
        );
      }
    }
  }, [livenessStatus.completed, livenessStatus.score, isScanning]);

  // Reset challenge timer whenever scanning starts, challenge changes, or a new attempt begins
  useEffect(() => {
    if (isScanning) {
      lastStepTimeRef.current = Date.now();
      lastStepRef.current = livenessStatus.challengeIndex;
    }
  }, [isScanning, livenessStatus.challengeIndex, livenessStatus.attempts]);

  // Handle timeouts (15 seconds per challenge)
  useEffect(() => {
    if (isScanning && livenessLevel !== 'off' && !livenessStatus.completed && !livenessStatus.isLocked) {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - lastStepTimeRef.current) / 1000;
        if (elapsed > 15) {
          failAttempt();
          setStatusMessage(`Challenge timed out. Attempt ${livenessStatus.attempts + 1} failed.`);
          lastStepTimeRef.current = Date.now();
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [
    isScanning,
    livenessStatus.completed,
    livenessStatus.isLocked,
    livenessLevel,
    failAttempt,
  ]);

  // Landmark scan loop
  useEffect(() => {
    if (!isScanning || !landmarker) return;

    let isSubscribed = true;
    let frameId: number;
    let lastBox: any = null;

    const detectLoop = async () => {
      if (!isSubscribed) return;

      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        try {
          const timestamp = performance.now();
          const results = landmarker.detectForVideo(videoRef.current, timestamp);

          if (isSubscribed) {
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
              const landmarks = results.faceLandmarks[0];

              // Calculate bounding box in 640x480 video scale
              let minX = 1, maxX = 0, minY = 1, maxY = 0;
              for (const pt of landmarks) {
                if (pt.x < minX) minX = pt.x;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.y > maxY) maxY = pt.y;
              }

              const box = {
                x: minX * 640,
                y: minY * 480,
                width: (maxX - minX) * 640,
                height: (maxY - minY) * 480,
              };
              lastBox = box;

              // Calculate face center offset from standard 640x480 frame center (320, 240)
              const faceCenterX = box.x + box.width / 2;
              const faceCenterY = box.y + box.height / 2;
              const offsetX = Math.abs(faceCenterX - 320);
              const offsetY = Math.abs(faceCenterY - 240);

              // centering checks (offset within 70px, width between 110px and 280px)
              if (offsetX <= 70 && offsetY <= 70 && box.width >= 110 && box.width <= 280) {
                updateAlignmentState('ready');
                // Only evaluate challenges if the face is properly aligned (ready / green) and liveness checks are active
                if (livenessLevel !== 'off') {
                  evaluateFrame(landmarks);
                }
              } else if (offsetX <= 110 && offsetY <= 110 && box.width >= 90 && box.width <= 310) {
                updateAlignmentState('detecting');
              } else {
                updateAlignmentState('unaligned');
              }
            } else {
              lastBox = null;
              updateAlignmentState('unaligned');
            }
          }
        } catch (e) {
          // Silence landmarker detection errors
        }

        // Draw canvas overlay on every frame using last known box for smooth rendering
        if (isSubscribed) {
          drawCanvasOverlay(alignmentStateRef.current, lastBox);
        }
      }

      if (isSubscribed) {
        frameId = requestAnimationFrame(detectLoop);
      }
    };

    frameId = requestAnimationFrame(detectLoop);

    return () => {
      isSubscribed = false;
      cancelAnimationFrame(frameId);
    };
  }, [isScanning, livenessLevel, landmarker, evaluateFrame, drawCanvasOverlay, updateAlignmentState]);

  // Handle capture action for legacy non-liveness scan
  const captureAndAuthenticateManual = async () => {
    if (!videoRef.current) return;
    try {
      setIsProcessing(true);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas context');

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const webcamScreenshot = canvas.toDataURL('image/jpeg');

      stopScanning();

      const praman = initPraman({ apiKey, network, webhookUrl });
      let res: AuthResult;

      if (mode === 'register') {
        res = await praman.register(
          webcamScreenshot,
          pii!,
          signer,
          faceapiInstance,
          (progress) => setStatusMessage(progress.message)
        );
      } else {
        res = await praman.login(
          webcamScreenshot,
          signer,
          faceapiInstance,
          (progress) => setStatusMessage(progress.message)
        );
      }

      if (res.success) {
        onSuccess(res);
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      onError(err.message || 'Authentication process failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Mobile Handover Submission Handler (Executes on mobile tab)
  const submitHandoverFromMobile = async () => {
    if (!handoverSessionData) return;
    try {
      setIsProcessing(true);
      setStatusMessage('Capturing face image frame...');

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current?.videoWidth || 640;
      canvas.height = videoRef.current?.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas context');
      if (videoRef.current) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      }
      const webcamScreenshot = canvas.toDataURL('image/jpeg');

      stopScanning();

      setStatusMessage('Verifying biometrics on mobile...');
      const praman = initPraman({ apiKey, network, webhookUrl });
      let res: AuthResult;

      if (handoverSessionData.mode === 'register') {
        res = await praman.register(
          webcamScreenshot,
          pii || { name: 'Handover User', email: 'handover@praman.auth', mobile: '+1234567890' },
          signer,
          faceapiInstance,
          (progress) => setStatusMessage(progress.message)
        );
      } else {
        res = await praman.login(
          webcamScreenshot,
          signer,
          faceapiInstance,
          (progress) => setStatusMessage(progress.message)
        );
      }

      if (res.success) {
        res.livenessScore = livenessStatus.score;
        res.handoverSessionId = handoverSessionData.sessionId;

        // Save result locally for cross-tab sync
        localStorage.setItem(`handover_result_${handoverSessionData.sessionId}`, JSON.stringify(res));

        // Submit to backend server
        const serverUrl = 'http://localhost:4000';
        await fetch(`${serverUrl}/api/handover/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: handoverSessionData.sessionId,
            result: res,
          }),
        });

        setStatusMessage('Success! Handover verified. You can return to your desktop browser.');
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      const failResult = { success: false, error: err.message };
      if (handoverSessionData) {
        localStorage.setItem(`handover_result_${handoverSessionData.sessionId}`, JSON.stringify(failResult));
        const serverUrl = 'http://localhost:4000';
        await fetch(`${serverUrl}/api/handover/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: handoverSessionData.sessionId,
            result: failResult,
          }),
        }).catch(() => {});
      }
      onError(err.message || 'Mobile verification process failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentChallengeMap: Record<string, string> = {
    blink: 'Blink your eyes 3 times',
    turn_left: 'Turn your head to the left',
    smile: 'Smile warmly at the camera',
  };

  // 1. RENDER ROLE: Handover URL Scan active on Mobile phone
  if (handoverUrlToken && handoverSessionData) {
    return (
      <div style={{ fontFamily: 'sans-serif', color: '#fff', textAlign: 'center', padding: '24px' }}>
        <h2 style={{ color: '#a855f7', fontWeight: 750 }}>Mobile Verification Client</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8' }}>
          Session: <code style={{ color: '#fbbf24' }}>{handoverSessionData.sessionId.slice(0, 12)}...</code>
        </p>

        {!isScanning ? (
          <button
            onClick={startScanning}
            disabled={isProcessing}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: '16px',
            }}
          >
            Start Handover Face Scan
          </button>
        ) : (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '280px',
                height: '280px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: `4px solid ${
                  livenessStatus.completed
                    ? '#10b981'
                    : alignmentState === 'ready'
                    ? '#10b981'
                    : alignmentState === 'detecting'
                    ? '#eab308'
                    : '#ef4444'
                }`,
                boxShadow: `0 0 25px ${
                  livenessStatus.completed
                    ? 'rgba(16, 185, 129, 0.5)'
                    : alignmentState === 'ready'
                    ? 'rgba(16, 185, 129, 0.5)'
                    : alignmentState === 'detecting'
                    ? 'rgba(234, 179, 8, 0.5)'
                    : 'rgba(239, 68, 68, 0.5)'
                }`,
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                }}
              />
              <canvas
                ref={canvasRef}
                width={280}
                height={280}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  transform: 'scaleX(-1)',
                  zIndex: 10,
                }}
              />
              {livenessLevel !== 'off' && livenessStatus.currentChallenge && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(15, 23, 42, 0.8)',
                    padding: '8px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: alignmentState === 'unaligned' ? '#ef4444' : alignmentState === 'detecting' ? '#eab308' : '#10b981',
                  }}
                >
                  {alignmentState === 'unaligned'
                    ? 'Center your face in circle'
                    : alignmentState === 'detecting'
                    ? 'Stay still...'
                    : currentChallengeMap[livenessStatus.currentChallenge]}
                </div>
              )}
            </div>

            <p style={{ color: '#e2e8f0', marginTop: '16px', fontSize: '14px', fontWeight: 500 }}>
              {statusMessage}
            </p>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                onClick={submitHandoverFromMobile}
                disabled={isProcessing}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Scan & Submit
              </button>
              <button
                onClick={stopScanning}
                disabled={isProcessing}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. RENDER ROLE: Handover Active Modal (QR Code render)
  if (isHandoverActive && handoverToken) {
    const handoverUrl = `${window.location.origin}${window.location.pathname}?handoverToken=${handoverToken}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
      handoverUrl
    )}`;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(9, 11, 16, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '24px',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            padding: '28px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f1f5f9' }}>
            📷 Use Mobile Camera Handover
          </h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px', marginBottom: '20px' }}>
            No desktop camera detected. Scan this QR code with your mobile device to verify.
          </p>

          <div
            style={{
              backgroundColor: '#fff',
              padding: '12px',
              borderRadius: '12px',
              display: 'inline-block',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <img src={qrImageUrl} alt="Verification QR Code" style={{ display: 'block' }} />
          </div>

          <div style={{ marginTop: '18px', fontSize: '12px', color: '#a78bfa', fontWeight: 500 }}>
            ⚡ Listening for mobile verification response...
          </div>

          <div
            style={{
              marginTop: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {/* Developer Helper Simulating Scan */}
            <button
              onClick={() => {
                window.open(handoverUrl, '_blank');
              }}
              style={{
                background: '#334155',
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Simulate Mobile Scanning (Open in New Tab)
            </button>

            <button
              onClick={() => {
                setIsHandoverActive(false);
                setHandoverSessionId(null);
                setHandoverToken(null);
              }}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel Handover
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. RENDER ROLE: Liveness lockout screen (after 3 failed attempts)
  if (livenessStatus.isLocked) {
    return (
      <div
        style={{
          fontFamily: 'sans-serif',
          color: '#fff',
          backgroundColor: '#0f172a',
          border: '2px solid #ef4444',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          maxWidth: '360px',
          margin: '0 auto',
          boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.2)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛡️</div>
        <h3 style={{ margin: 0, color: '#ef4444', fontWeight: 700 }}>Security Lockout</h3>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px', lineHeight: '1.5' }}>
          Too many failed spoofing detection attempts. Your account registry has been locked to prevent fraud.
        </p>

        <button
          onClick={() => {
            window.open('https://support.pramanauth.com/ticket', '_blank');
          }}
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '16px',
            width: '100%',
          }}
        >
          Submit Manual Support Ticket
        </button>

        {/* Support Unlock Helper for developer verification */}
        <button
          onClick={() => {
            resetLockout();
          }}
          style={{
            background: 'transparent',
            color: '#64748b',
            border: 'none',
            fontSize: '11px',
            marginTop: '14px',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Unlock Developer Sandbox
        </button>
      </div>
    );
  }

  // 4. RENDER ROLE: Standard desktop client layout
  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      {!isScanning ? (
        <button
          onClick={startScanning}
          disabled={isProcessing}
          className={className}
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)',
            transition: 'all 0.2s',
            ...(!className && {}),
          }}
        >
          {isProcessing
            ? 'Processing Biometrics...'
            : buttonText || (mode === 'register' ? 'Register Face Identity' : 'Verify Face Login')}
        </button>
      ) : (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '320px',
              height: '320px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: `4px solid ${
                livenessStatus.completed
                  ? '#10b981'
                  : alignmentState === 'ready'
                  ? '#10b981'
                  : alignmentState === 'detecting'
                  ? '#eab308'
                  : '#ef4444'
              }`,
              boxShadow: `0 0 25px ${
                livenessStatus.completed
                  ? 'rgba(16, 185, 129, 0.5)'
                  : alignmentState === 'ready'
                  ? 'rgba(16, 185, 129, 0.5)'
                  : alignmentState === 'detecting'
                  ? 'rgba(234, 179, 8, 0.5)'
                  : 'rgba(239, 68, 68, 0.5)'
              }`,
            }}
          >
            {/* Native Video Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
              }}
            />

            <canvas
              ref={canvasRef}
              width={320}
              height={320}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                transform: 'scaleX(-1)',
                zIndex: 10,
              }}
            />

            {/* Visual overlay scanning line */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: '#10b981',
                boxShadow: '0 0 10px #10b981',
                animation: 'scanAnimation 2.5s infinite ease-in-out',
              }}
            />

            {/* Challenges Overlay Instructions */}
            {livenessLevel !== 'off' && livenessStatus.currentChallenge && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  background: 'linear-gradient(to top, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0) 60%)',
                  paddingBottom: '24px',
                }}
              >
                <div style={{ 
                  color: alignmentState === 'unaligned' ? '#ef4444' : alignmentState === 'detecting' ? '#eab308' : '#a855f7', 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  letterSpacing: '0.05em' 
                }}>
                  {alignmentState === 'unaligned' 
                    ? 'ALIGNMENT' 
                    : alignmentState === 'detecting' 
                    ? 'DETECTING' 
                    : `CHALLENGE ${livenessStatus.challengeIndex + 1}/3`}
                </div>
                <div
                  style={{
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 700,
                    marginTop: '4px',
                    textAlign: 'center',
                    padding: '0 16px',
                  }}
                >
                  {alignmentState === 'unaligned'
                    ? 'Align your face in the center of the circle'
                    : alignmentState === 'detecting'
                    ? 'Hold still, detecting face...'
                    : currentChallengeMap[livenessStatus.currentChallenge]}
                </div>

                {/* Progress bar / count tracker (Only shown when aligned) */}
                {alignmentState === 'ready' && (
                  livenessStatus.currentChallenge === 'blink' ? (
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        marginTop: '10px',
                      }}
                    >
                      {[1, 2, 3].map((step) => (
                        <div
                          key={step}
                          style={{
                            width: '18px',
                            height: '6px',
                            borderRadius: '3px',
                            backgroundColor: step <= livenessStatus.progress ? '#10b981' : '#475569',
                            transition: 'all 0.3s',
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '100px',
                        height: '6px',
                        borderRadius: '3px',
                        backgroundColor: '#475569',
                        marginTop: '10px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${livenessStatus.progress}%`,
                          height: '100%',
                          backgroundColor: '#10b981',
                          transition: 'width 0.2s ease-out',
                        }}
                      />
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <p style={{ color: '#94a3b8', marginTop: '16px', fontSize: '14px' }}>{statusMessage}</p>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            {livenessLevel === 'off' && (
              <button
                onClick={captureAndAuthenticateManual}
                disabled={isProcessing || alignmentState !== 'ready'}
                style={{
                  background: alignmentState === 'ready' ? '#10b981' : '#4b5563',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: alignmentState === 'ready' ? 'pointer' : 'not-allowed',
                  opacity: alignmentState === 'ready' ? 1 : 0.6,
                }}
              >
                Scan & Verify
              </button>
            )}
            <button
              onClick={stopScanning}
              disabled={isProcessing}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>

          {/* Inline keyframe animation */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
            @keyframes scanAnimation {
              0% { top: 0%; }
              50% { top: 100%; }
              100% { top: 0%; }
            }
          `,
            }}
          />
        </div>
      )}
    </div>
  );
};
