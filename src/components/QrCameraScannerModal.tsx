import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  X,
  RefreshCw,
  Zap,
  ZapOff,
  AlertCircle,
  QrCode,
  CheckCircle2,
} from 'lucide-react';

interface QrCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (roomId: string) => void;
}

export const QrCameraScannerModal: React.FC<QrCameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanned, setIsScanned] = useState(false);
  const [scannedRoomId, setScannedRoomId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Stop camera tracks cleanly
  const stopStream = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Parse QR content (URL or raw room code)
  const extractRoomIdFromQr = (content: string): string | null => {
    if (!content) return null;
    const cleanContent = content.trim();

    // Check if URL contains ?room=
    try {
      if (cleanContent.includes('room=')) {
        const urlObj = new URL(cleanContent.startsWith('http') ? cleanContent : `http://${cleanContent}`);
        const r = urlObj.searchParams.get('room');
        if (r && r.trim().length >= 4) {
          return r.trim().toLowerCase();
        }
      }
    } catch {
      // ignore URL parse errors
    }

    // Direct room code (4 to 8 alphanumeric characters)
    const sanitized = cleanContent.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (sanitized.length >= 4 && sanitized.length <= 8) {
      return sanitized;
    }

    return null;
  };

  // Start video stream
  const startCamera = useCallback(async () => {
    stopStream();
    setErrorMsg(null);
    setIsScanned(false);
    setScannedRoomId(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Camera access is not supported on this device/browser.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS Safari
        await videoRef.current.play();

        // Check if torch/flashlight is supported on the active track
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = (track.getCapabilities?.() as { torch?: boolean }) || {};
          setHasTorch(!!capabilities.torch);
        }

        // Start scanning loop
        startScanLoop();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setErrorMsg('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setErrorMsg('No camera device found on this system.');
      } else {
        setErrorMsg(`Camera error: ${msg}`);
      }
    }
  }, [facingMode, stopStream]);

  // Frame scanning loop via jsQR
  const startScanLoop = () => {
    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (code && code.data) {
              const matchedRoom = extractRoomIdFromQr(code.data);
              if (matchedRoom) {
                setIsScanned(true);
                setScannedRoomId(matchedRoom);

                // Give 600ms visual confirmation before completing join
                setTimeout(() => {
                  stopStream();
                  onScanSuccess(matchedRoom);
                  onClose();
                }, 600);
                return; // Stop loop on successful read
              }
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      } catch (err) {
        console.warn('Torch toggle failed:', err);
      }
    }
  };

  // Flip Camera Front/Back
  const toggleCameraFlip = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, stopStream]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-safe pb-safe px-safe bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-surface border border-surfaceBorder rounded-3xl shadow-2xl overflow-hidden flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Controls */}
        <div className="w-full flex items-center justify-between p-4 bg-surface/90 border-b border-surfaceBorder z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-canvas text-cobaltLight border border-surfaceBorder">
              <QrCode className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">
              Scan Sender's QR Code
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                title={isTorchOn ? 'Turn off flash' : 'Turn on flash'}
                aria-label="Toggle Flashlight"
                className={`p-2 rounded-xl border transition-all ${
                  isTorchOn
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-canvas border-surfaceBorder text-slate-400 hover:text-white'
                }`}
              >
                {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={toggleCameraFlip}
              title="Flip camera"
              aria-label="Flip Camera"
              className="p-2 rounded-xl bg-canvas border border-surfaceBorder text-slate-400 hover:text-white transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close scanner"
              aria-label="Close Scanner"
              className="p-2 rounded-xl bg-canvas border border-surfaceBorder text-slate-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Viewfinder Viewport */}
        <div className="relative w-full aspect-square bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Overlay HUD */}
          {!errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6">
              {/* Target Aim Frame */}
              <div
                className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border-2 transition-all duration-300 ${
                  isScanned
                    ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_24px_rgba(16,185,129,0.5)]'
                    : 'border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]'
                }`}
              >
                {/* 4 Corner Markers */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-signalStart rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-signalStart rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-signalEnd rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-signalEnd rounded-br-lg" />

                {/* Sweeping Laser Beam */}
                {!isScanned && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-signalEnd to-transparent animate-laser-sweep shadow-[0_0_12px_#FF1840]" />
                )}

                {/* Scanned Success Badge */}
                {isScanned && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-950/80 backdrop-blur-sm rounded-2xl animate-scaleIn">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                    <span className="text-sm font-bold text-white">QR Code Recognized!</span>
                    <span className="text-xs font-mono font-semibold text-emerald-300">
                      Room {scannedRoomId}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message Fallback */}
          {errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-surface/95 z-20 gap-3">
              <AlertCircle className="w-10 h-10 text-rose-400" />
              <p className="text-sm font-semibold text-white">Camera Access Problem</p>
              <p className="text-xs text-slate-300 max-w-xs leading-relaxed">{errorMsg}</p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-2 min-h-[44px] px-4 py-2 rounded-xl bg-signal-gradient text-white text-xs font-bold shadow-md hover:opacity-95"
              >
                Try Camera Again
              </button>
            </div>
          )}
        </div>

        {/* Bottom Help Instructions */}
        <div className="w-full p-4 bg-surface border-t border-surfaceBorder flex flex-col items-center text-center gap-1.5">
          <p className="text-xs font-medium text-slate-300">
            Point camera at the QR code displayed on the sender's screen.
          </p>
          <p className="text-[11px] text-slate-500">
            Connects seamlessly inside the app without opening browser tabs.
          </p>
        </div>
      </div>
    </div>
  );
};
