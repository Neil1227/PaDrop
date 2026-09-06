import { useState } from 'react';
import { Copy, Check, DownloadCloud, RefreshCw, Info } from 'lucide-react';
import type { ConnectionState } from '../types';

interface TopBarProps {
  roomId: string;
  connectionState: ConnectionState;
  isHost: boolean;
  canInstall: boolean;
  onInstallClick: () => void;
  onNewRoom: () => void;
  onOpenInfo: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  roomId,
  connectionState,
  isHost,
  canInstall,
  onInstallClick,
  onNewRoom,
  onOpenInfo,
}) => {
  const [copied, setCopied] = useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="w-full border-b border-surfaceBorder bg-surface/90 backdrop-blur-md sticky top-0 z-40 pt-safe px-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-canvas border border-surfaceBorder shadow-inner group shrink-0 p-1 hover:border-signalStart/50 transition-colors">
            <img
              src="/PaDrop-no-bg.png"
              alt="PaDrop Logo"
              className="w-full h-full object-contain transform transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_0_8px_rgba(255,24,64,0.25)]"
            />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-base sm:text-xl font-extrabold tracking-tight text-white flex items-center">
                Pa<span className="text-signal-gradient">Drop</span>
              </span>
              <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cobalt/30 text-blue-300 border border-cobalt/50">
                {isHost ? 'HOST' : 'RECEIVER'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium hidden lg:block">
              Instant, zero-cloud peer-to-peer clipboard & file drop
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {/* Live Connection Pill */}
          <div
            id="connection-status-pill"
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border shadow-sm transition-all duration-300 shrink-0"
            style={{
              backgroundColor:
                connectionState === 'connected'
                  ? '#24243E'
                  : '#1A1A2E',
              borderColor:
                connectionState === 'connected'
                  ? 'rgba(0, 71, 171, 0.6)'
                  : connectionState === 'waiting'
                  ? 'rgba(245, 158, 11, 0.4)'
                  : '#2E2E50',
              boxShadow:
                connectionState === 'connected'
                  ? '0 0 14px rgba(0, 71, 171, 0.3)'
                  : 'none',
            }}
          >
            {connectionState === 'connected' ? (
              <>
                <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-400 shadow-[0_0_8px_#10B981]"></span>
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-100 tracking-wide">
                  <span className="inline sm:hidden">Connected</span>
                  <span className="hidden sm:inline">Peer Connected</span>
                </span>
              </>
            ) : connectionState === 'waiting' ? (
              <>
                <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-amber-400 shadow-[0_0_8px_#F59E0B]"></span>
                </span>
                <span className="text-[11px] sm:text-xs font-medium text-amber-300 tracking-wide">
                  <span className="inline sm:hidden">Waiting...</span>
                  <span className="hidden sm:inline">Waiting for peer...</span>
                </span>
              </>
            ) : connectionState === 'connecting' ? (
              <>
                <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-cobalt animate-pulse shrink-0"></span>
                <span className="text-[11px] sm:text-xs font-medium text-blue-300">
                  Connecting...
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-slate-500 shrink-0"></span>
                <span className="text-[11px] sm:text-xs font-medium text-slate-400">
                  Offline
                </span>
              </>
            )}
          </div>

          {/* Room ID quick-copy chip */}
          {roomId && (
            <button
              onClick={copyRoomCode}
              title="Click to copy Room Code"
              className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-surface border border-surfaceBorder hover:border-cobalt/60 active:scale-95 transition-all text-xs font-mono text-slate-300 hover:text-white shrink-0"
            >
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider hidden sm:inline">
                ROOM:
              </span>
              <span className="font-semibold text-white tracking-wider text-[11px] sm:text-xs">
                {roomId}
              </span>
              {copied ? (
                <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
              )}
            </button>
          )}

          {/* Install button trigger */}
          {canInstall && (
            <button
              onClick={onInstallClick}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-signal-gradient hover:opacity-95 active:scale-95 transition-all shadow-[0_0_12px_rgba(255,24,64,0.35)] shrink-0"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          )}

          {/* New Room button */}
          <button
            onClick={onNewRoom}
            title="Create fresh room"
            aria-label="Create fresh room"
            className="flex items-center justify-center p-1.5 sm:p-2 rounded-lg bg-surface border border-surfaceBorder hover:border-slate-500 text-slate-400 hover:text-white active:scale-95 transition-all text-xs shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xl:inline ml-1">New Room</span>
          </button>

          {/* Info / Readme Guide button */}
          <button
            onClick={onOpenInfo}
            title="How PaDrop Works"
            aria-label="How PaDrop Works"
            className="flex items-center justify-center p-1.5 sm:p-2 rounded-lg bg-surface border border-surfaceBorder hover:border-slate-500 text-slate-400 hover:text-white active:scale-95 transition-all text-xs shrink-0"
          >
            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cobaltLight hover:text-white" />
          </button>
        </div>
      </div>
    </header>
  );
};
