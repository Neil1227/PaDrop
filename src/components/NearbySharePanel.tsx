import React, { useState, useEffect } from 'react';
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
  Search
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
  const [scanState, setScanState] = useState<DiscoveryScanState>('idle');
  const [discoveredRooms, setDiscoveredRooms] = useState<DiscoveredRoom[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subscribe to live background updates once initial scan is triggered
  useEffect(() => {
    const unsubscribe = discoveryService.subscribe((rooms) => {
      // Filter out self
      const filtered = rooms.filter(
        (r) => r.roomId.toLowerCase() !== currentRoomId.toLowerCase() && r.isDiscoverable
      );
      if (scanState === 'discovered' || scanState === 'empty') {
        setDiscoveredRooms(filtered);
        setScanState(filtered.length > 0 ? 'discovered' : 'empty');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentRoomId, scanState]);

  const handleStartScan = async () => {
    if (scanState === 'scanning') return; // Prevent duplicate concurrent scans

    setScanState('scanning');
    setErrorMessage(null);

    try {
      const results = await discoveryService.scanForNearbyRooms(currentRoomId, 2200);
      setDiscoveredRooms(results);
      setScanState(results.length > 0 ? 'discovered' : 'empty');
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Failed to scan for nearby rooms';
      setErrorMessage(errText);
      setScanState('error');
    }
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
    <div className="flex flex-col h-full justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-canvas/80 border border-surfaceBorder/80 shadow-inner">
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-surface border border-surfaceBorder text-signalStart shadow-sm">
            <Wifi className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Nearby Share
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-signalStart/20 text-orange-300 border border-signalStart/30">
                Auto-Discovery
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Discover active rooms in your local room or network
            </p>
          </div>
        </div>

        {/* Scan / Re-scan button */}
        <button
          id="nearby-scan-button"
          type="button"
          onClick={handleStartScan}
          disabled={scanState === 'scanning'}
          aria-label={scanState === 'scanning' ? 'Scanning for nearby rooms' : 'Scan for nearby rooms'}
          className={`min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm ${
            scanState === 'scanning'
              ? 'bg-surface border border-surfaceBorder text-slate-400 cursor-not-allowed opacity-80'
              : 'bg-signal-gradient hover:opacity-95 active:scale-95 text-white shadow-[0_0_14px_rgba(255,24,64,0.35)]'
          }`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 shrink-0 ${scanState === 'scanning' ? 'animate-spin text-signalStart' : ''}`}
          />
          <span className="hidden sm:inline">
            {scanState === 'scanning'
              ? 'Scanning…'
              : scanState === 'idle'
              ? 'Scan for nearby rooms'
              : 'Scan Again'}
          </span>
          <span className="sm:hidden">
            {scanState === 'scanning' ? 'Scanning…' : 'Scan'}
          </span>
        </button>
      </div>

      {/* Results Container / Explicit State Views */}
      <div className="flex-1 min-h-[160px] flex flex-col justify-center">
        {/* State 1: Idle (Before first scan) */}
        {scanState === 'idle' && (
          <div className="flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-surfaceBorder bg-surface/30 gap-2.5">
            <div className="w-10 h-10 rounded-full bg-surface border border-surfaceBorder flex items-center justify-center text-slate-400 shadow-inner">
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-slate-200">
                Tap Scan to find nearby hosts
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Devices with PaDrop open on the same local network or session will appear here automatically.
              </p>
            </div>
          </div>
        )}

        {/* State 2: Loading / Scanning Skeleton */}
        {scanState === 'scanning' && (
          <div className="flex flex-col gap-2.5 w-full">
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 animate-pulse">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-signalStart animate-spin" />
                Listening for presence broadcasts…
              </span>
              <span>Scanning network</span>
            </div>

            {/* Skeleton Rows */}
            {[1, 2].map((idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-xl bg-surface/60 border border-surfaceBorder animate-pulse gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-surfaceBorder/80 shrink-0" />
                  <div className="flex flex-col gap-1.5">
                    <div className="w-32 h-3.5 rounded bg-surfaceBorder/80" />
                    <div className="w-20 h-2.5 rounded bg-surfaceBorder/60" />
                  </div>
                </div>
                <div className="w-16 h-8 rounded-lg bg-surfaceBorder/70" />
              </div>
            ))}
          </div>
        )}

        {/* State 3: Populated Results List */}
        {scanState === 'discovered' && discoveredRooms.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 mb-0.5">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Found {discoveredRooms.length} Nearby {discoveredRooms.length === 1 ? 'Room' : 'Rooms'}
              </span>
              <span>Tap row or Join button</span>
            </div>

            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
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
                  className="group flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-surface hover:bg-surfaceHover border border-surfaceBorder hover:border-signalStart/50 transition-all cursor-pointer shadow-sm min-h-[48px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-canvas border border-surfaceBorder group-hover:border-signalStart/40 text-white shrink-0 transition-colors">
                      {getDeviceIcon(room.deviceType)}
                    </div>

                    <div className="flex flex-col min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-signalStart transition-colors">
                          {room.displayName}
                        </span>
                        <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-canvas border border-surfaceBorder text-slate-300">
                          {room.roomId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Ready to Connect
                        </span>
                        {room.lanIp && (
                          <span className="hidden sm:inline text-slate-500 font-mono">
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
                    aria-label={`Join ${room.displayName} room ${room.roomId}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-cobalt hover:bg-cobaltLight text-white text-xs font-semibold active:scale-95 transition-all shadow-sm shrink-0 ml-2"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* State 4: No Results After Scan */}
        {scanState === 'empty' && (
          <div className="flex flex-col items-center justify-center text-center p-5 rounded-xl border border-dashed border-surfaceBorder bg-surface/30 gap-2">
            <Radio className="w-8 h-8 text-slate-500 animate-pulse" />
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-slate-200">
                No nearby rooms found
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Make sure the host has PaDrop open on the same Wi-Fi network, or enter the 6-character code manually on the right.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartScan}
              className="mt-1 min-h-[44px] px-3.5 py-1.5 rounded-xl bg-surface border border-surfaceBorder hover:border-slate-400 text-xs text-slate-300 hover:text-white font-medium transition-all"
            >
              Try Scanning Again
            </button>
          </div>
        )}

        {/* State 5: Scan Failure / Error */}
        {scanState === 'error' && (
          <div className="flex flex-col items-center justify-center text-center p-5 rounded-xl border border-rose-800/60 bg-rose-950/30 gap-2">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-rose-200">
                Discovery Scan Failed
              </p>
              <p className="text-[11px] text-rose-300 max-w-xs">
                {errorMessage || 'Network error encountered during discovery.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartScan}
              className="mt-1 min-h-[44px] px-3.5 py-1.5 rounded-xl bg-rose-900/60 hover:bg-rose-800 border border-rose-700/60 text-xs text-white font-medium transition-all"
            >
              Retry Scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
