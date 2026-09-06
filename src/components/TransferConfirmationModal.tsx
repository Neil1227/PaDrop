import React from 'react';
import { 
  DownloadCloud, 
  X, 
  Check, 
  FileText, 
  FileArchive, 
  FileCode, 
  Music, 
  Video, 
  Image as ImageIcon,
  ShieldCheck,
  Zap
} from 'lucide-react';
import type { IncomingTransferRequest } from '../types';

interface TransferConfirmationModalProps {
  request: IncomingTransferRequest | null;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-signalStart" />;
  if (mimeType.startsWith('video/')) return <Video className="w-8 h-8 text-amber-400" />;
  if (mimeType.startsWith('audio/')) return <Music className="w-8 h-8 text-purple-400" />;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('7z')) {
    return <FileArchive className="w-8 h-8 text-emerald-400" />;
  }
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('html')) {
    return <FileCode className="w-8 h-8 text-cyan-400" />;
  }
  return <FileText className="w-8 h-8 text-cobaltLight" />;
}

export const TransferConfirmationModal: React.FC<TransferConfirmationModalProps> = ({
  request,
  onAccept,
  onDecline,
}) => {
  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-md bg-surface border border-cobalt/40 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-scaleIn relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-modal-title"
      >
        {/* Glow ambient background pill */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cobalt/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-signalStart/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cobalt/20 border border-cobalt/40 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
              <DownloadCloud className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <span className="px-2 py-0.5 w-fit rounded-full text-[10px] font-bold tracking-wider uppercase bg-cobalt/30 text-blue-300 border border-cobalt/40">
                Incoming File Transfer
              </span>
              <h3 id="transfer-modal-title" className="text-base font-bold text-white tracking-tight mt-1">
                Receive file from Sender?
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onDecline(request.id)}
            aria-label="Decline transfer"
            className="w-8 h-8 rounded-full bg-canvas/80 border border-surfaceBorder hover:border-slate-400 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File Preview Card */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-canvas border border-surfaceBorder relative z-10 shadow-inner">
          <div className="w-14 h-14 rounded-xl bg-surface border border-surfaceBorder flex items-center justify-center shrink-0 shadow-sm">
            {getFileIcon(request.mimeType)}
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-sm font-bold text-white truncate max-w-[240px]">
              {request.name}
            </span>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-mono">
              <span className="font-semibold text-slate-300">
                {formatBytes(request.size)}
              </span>
              <span>•</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Direct P2P
              </span>
            </div>
          </div>
        </div>

        {/* Security / Speed Badge */}
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 relative z-10">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Zap className="w-3.5 h-3.5 text-signalStart" />
            <span>High-speed 64 KB chunk stream</span>
          </span>
          <span className="text-slate-500 font-mono text-[10px]">DTLS Encrypted</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 relative z-10 pt-1">
          <button
            type="button"
            onClick={() => onDecline(request.id)}
            className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-surface hover:bg-surfaceHover active:scale-95 border border-surfaceBorder hover:border-rose-500/50 text-xs sm:text-sm font-semibold text-slate-300 hover:text-rose-200 transition-all shadow-sm flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Decline</span>
          </button>

          <button
            type="button"
            onClick={() => onAccept(request.id)}
            className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-xs sm:text-sm font-bold text-white transition-all shadow-[0_0_20px_rgba(16,185,129,0.45)] flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Accept & Receive</span>
          </button>
        </div>
      </div>
    </div>
  );
};
