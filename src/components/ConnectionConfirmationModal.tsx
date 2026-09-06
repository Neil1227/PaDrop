import React from 'react';
import { Smartphone, Monitor, Tablet, Radio, Check, X, ShieldCheck } from 'lucide-react';
import type { IncomingConnectionRequest } from '../types';

interface ConnectionConfirmationModalProps {
  request: IncomingConnectionRequest | null;
  onAccept: () => void;
  onDecline: () => void;
}

export const ConnectionConfirmationModal: React.FC<ConnectionConfirmationModalProps> = ({
  request,
  onAccept,
  onDecline,
}) => {
  if (!request) return null;

  const renderDeviceIcon = () => {
    switch (request.senderDeviceType) {
      case 'mobile':
        return <Smartphone className="w-8 h-8 text-signalStart animate-pulse" />;
      case 'tablet':
        return <Tablet className="w-8 h-8 text-signalStart animate-pulse" />;
      case 'desktop':
      default:
        return <Monitor className="w-8 h-8 text-signalStart animate-pulse" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="connection-request-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-md bg-surface border border-signalStart/50 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(255,24,64,0.25)] flex flex-col gap-6 text-center transform transition-all animate-scaleUp">
        {/* Animated Glow Halo & Icon */}
        <div className="relative mx-auto flex items-center justify-center">
          <div className="absolute -inset-2 rounded-full bg-signal-gradient opacity-30 blur-lg animate-pulse" />
          <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-canvas border border-surfaceBorder flex items-center justify-center shadow-inner">
            {renderDeviceIcon()}
          </div>
        </div>

        {/* Modal Header */}
        <div className="flex flex-col gap-1.5">
          <div className="inline-flex items-center justify-center gap-1.5 mx-auto px-2.5 py-0.5 rounded-full bg-cobalt/20 border border-cobalt/40 text-cobaltLight text-[11px] font-semibold tracking-wide uppercase">
            <Radio className="w-3 h-3 animate-ping" />
            <span>Pairing Request</span>
          </div>
          <h2
            id="connection-request-title"
            className="text-lg sm:text-xl font-extrabold text-white tracking-tight mt-1"
          >
            Incoming Connection
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xs mx-auto">
            A sender device wants to connect to your PaDrop room.
          </p>
        </div>

        {/* Device Information Card */}
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-canvas/80 border border-surfaceBorder text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-400">Device Name</span>
            <span className="text-xs font-semibold text-white truncate max-w-[200px]">
              {request.senderName || 'Nearby PaDrop Device'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-400">Target Room</span>
            <span className="text-xs font-mono font-bold text-cobaltLight uppercase">
              {request.roomId}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-400">Security</span>
            <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Direct WebRTC P2P</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            type="button"
            id="decline-connection-btn"
            onClick={onDecline}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-canvas hover:bg-surface border border-surfaceBorder hover:border-slate-500 active:scale-95 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Decline</span>
          </button>

          <button
            type="button"
            id="accept-connection-btn"
            onClick={onAccept}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-signal-gradient hover:opacity-95 active:scale-95 text-xs sm:text-sm font-bold text-white transition-all shadow-[0_0_20px_rgba(255,24,64,0.4)] flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4 text-white" />
            <span>Accept & Pair</span>
          </button>
        </div>
      </div>
    </div>
  );
};
