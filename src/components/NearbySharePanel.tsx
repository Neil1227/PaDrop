import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Radio, 
  RefreshCw, 
  Laptop, 
  Smartphone, 
  Tablet, 
  ArrowRight, 
  AlertCircle, 
  Wifi, 
  CheckCircle2,
  Sparkles,
  Zap
} from 'lucide-react';
import { discoveryService } from '../services/discoveryService';
import type { DiscoveredRoom, DiscoveryScanState } from '../types';

interface NearbySharePanelProps {
  currentRoomId: string;
  onJoinRoom: (targetRoomId: string) => void;
}

export const NearbySharePanel: React.FC<NearbySharePanelProps> = ({
  currentRoomId,
  onJoinRoom,
}) => {
  const [scanState, setScanState] = useState<DiscoveryScanState>('scanning');
  const [discoveredRooms, setDiscoveredRooms] = useState<DiscoveredRoom[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isScanningRef = useRef(false);

  // Trigger an active discovery scan
  const performScan = useCallback(async () => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;

    setScanState('scanning');
    setErrorMessage(null);

    try {
      const results = await discoveryService.scanForNearbyRooms(currentRoomId, 1800);
      setDiscoveredRooms(results);
      setScanState(results.length > 0 ? 'discovered' : 'empty');
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Failed to scan for nearby rooms';
      setErrorMessage(errText);
      setScanState('error');
    } finally {
      isScanningRef.current = false;
    }
  }, [currentRoomId]);

  // Auto-Discovery Lifecycle: Mount immediately triggers scan and continuous background presence listening
  useEffect(() => {
    let isCancelled = false;

    // 1. Initial live scan
    discoveryService.scanForNearbyRooms(currentRoomId, 1800).then((results) => {
      if (!isCancelled) {
        setDiscoveredRooms(results);
        setScanState(results.length > 0 ? 'discovered' : 'empty');
      }
    }).catch((err) => {
      if (!isCancelled) {
        const errText = err instanceof Error ? err.message : 'Failed to scan for nearby rooms';
        setErrorMessage(errText);
        setScanState('error');
      }
    });

    // 2. Real-time subscriber to receive live incoming announcements
    const unsubscribe = discoveryService.subscribe((rooms) => {
      const filtered = rooms.filter(
        (r) => r.roomId.toLowerCase() !== currentRoomId.toLowerCase() && r.isDiscoverable
      );
      setDiscoveredRooms(filtered);
      setScanState(filtered.length > 0 ? 'discovered' : 'empty');
    });

    // 3. Continuous background presence query heartbeat every 3.5 seconds
    const heartbeatTimer = setInterval(() => {
      discoveryService.queryPeers();
    }, 3500);

    return () => {
      isCancelled = true;
      unsubscribe();
      clearInterval(heartbeatTimer);
    };
  }, [currentRoomId]);

  const handleManualScanClick = () => {
    performScan();
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-signalStart" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-amber-400" />;
      case 'desktop':
      default:
        return <Laptop className="w-5 h-5 text-cobaltLight" />;
    }
  };

  return (
    <div className="flex flex-col h-full justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-canvas/90 border border-surfaceBorder shadow-inner relative overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-surface border border-surfaceBorder text-signalStart shadow-sm shrink-0">
            <Wifi className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Nearby Share Radar
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Auto-Discovery
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Discovers online PaDrop senders automatically
            </p>
          </div>
        </div>

        {/* Manual Re-scan Button */}
        <button
          id="nearby-scan-button"
          type="button"
          onClick={handleManualScanClick}
          disabled={scanState === 'scanning'}
          aria-label={scanState === 'scanning' ? 'Scanning for nearby rooms' : 'Scan for nearby rooms'}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 ${
            scanState === 'scanning'
              ? 'bg-surface border border-surfaceBorder text-slate-400 cursor-not-allowed opacity-80'
              : 'bg-signal-gradient hover:opacity-95 active:scale-95 text-white shadow-[0_0_14px_rgba(255,24,64,0.35)]'
          }`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 shrink-0 ${scanState === 'scanning' ? 'animate-spin text-signalStart' : ''}`}
          />
          <span className="hidden sm:inline">
            {scanState === 'scanning' ? 'Scanning…' : 'Scan Now'}
          </span>
          <span className="sm:hidden">
            {scanState === 'scanning' ? '…' : 'Scan'}
          </span>
        </button>
      </div>

      {/* Results Container / Explicit State Views */}
      <div className="flex-1 min-h-[170px] flex flex-col justify-center relative z-10">
        {/* State 1: Active Radar Searching HUD (When 0 rooms found or while actively scanning) */}
        {(scanState === 'scanning' || (scanState === 'empty' && discoveredRooms.length === 0)) && (
          <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-dashed border-surfaceBorder/80 bg-surface/30 relative overflow-hidden">
            {/* Animated Radar Sonar Visualizer */}
            <div className="relative w-28 h-28 my-1 flex items-center justify-center">
              {/* Concentric rings */}
              <div className="absolute inset-0 rounded-full border border-surfaceBorder/70"></div>
              <div className="absolute inset-3 rounded-full border border-surfaceBorder/50"></div>
              <div className="absolute inset-7 rounded-full border border-surfaceBorder/40"></div>
              
              {/* Sonar Ping Wave */}
              <div className="absolute w-12 h-12 rounded-full bg-signalStart/15 animate-sonar-ping pointer-events-none"></div>

              {/* Rotating Radar Sweep Line */}
              <div className="absolute inset-0 rounded-full animate-radar-sweep pointer-events-none opacity-40">
                <div className="w-1/2 h-1/2 bg-gradient-to-br from-signalStart/60 to-transparent rounded-tl-full origin-bottom-right transform translate-x-0 translate-y-0"></div>
              </div>

              {/* Center Beacon Icon */}
              <div className="relative z-10 w-10 h-10 rounded-full bg-surface border border-signalStart/40 flex items-center justify-center text-signalStart shadow-lg glow-signal-sm">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
            </div>

            <div className="flex flex-col gap-1 mt-1">
              <p className="text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-signalStart" />
                <span>Scanning for nearby PaDrop hosts…</span>
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                Open PaDrop in <strong className="text-slate-300">Send Mode</strong> on your other device to connect instantly.
              </p>
            </div>
          </div>
        )}

        {/* State 2: Populated Results List (Discovered active rooms) */}
        {discoveredRooms.length > 0 && (
          <div className="flex flex-col gap-2 w-full animate-fadeIn">
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 mb-0.5">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Found {discoveredRooms.length} Active {discoveredRooms.length === 1 ? 'Device' : 'Devices'} Nearby</span>
              </span>
              <span className="text-slate-400">Tap to connect</span>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
              {discoveredRooms.map((room) => (
                <div
                  key={room.roomId}
                  onClick={() => onJoinRoom(room.roomId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onJoinRoom(room.roomId);
                    }
                  }}
                  className="group flex items-center justify-between p-3.5 rounded-2xl bg-surface hover:bg-surfaceHover border border-surfaceBorder hover:border-signalStart/60 transition-all cursor-pointer shadow-sm min-h-[56px] hover:shadow-[0_0_18px_rgba(255,24,64,0.15)]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-canvas border border-surfaceBorder group-hover:border-signalStart/50 text-white shrink-0 transition-colors shadow-inner">
                      {getDeviceIcon(room.deviceType)}
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                    </div>

                    <div className="flex flex-col min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-signalStart transition-colors">
                          {room.displayName}
                        </span>
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-canvas border border-surfaceBorder text-slate-300">
                          {room.roomId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Ready to Connect
                        </span>
                        {room.lanIp && (
                          <span className="hidden sm:inline text-slate-500 font-mono text-[10px]">
                            • {room.lanIp}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Explicit Accessible Join Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJoinRoom(room.roomId);
                    }}
                    aria-label={`Connect to ${room.displayName} room ${room.roomId}`}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-signal-gradient hover:opacity-95 active:scale-95 text-white text-xs font-bold transition-all shadow-[0_0_14px_rgba(255,24,64,0.35)] flex items-center justify-center gap-1.5 shrink-0 ml-2"
                  >
                    <span>Connect</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* State 3: Error State */}
        {scanState === 'error' && discoveredRooms.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center p-5 rounded-xl border border-rose-800/60 bg-rose-950/30 gap-2">
            <AlertCircle className="w-7 h-7 text-rose-400" />
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-rose-200">
                Discovery Scan Interrupted
              </p>
              <p className="text-[11px] text-rose-300 max-w-xs">
                {errorMessage || 'Network error encountered during discovery.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleManualScanClick}
              className="mt-1 min-h-[44px] px-4 py-1.5 rounded-xl bg-rose-900/60 hover:bg-rose-800 border border-rose-700/60 text-xs text-white font-semibold transition-all"
            >
              Retry Discovery
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
