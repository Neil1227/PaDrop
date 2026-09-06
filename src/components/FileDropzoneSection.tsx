import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import {
  UploadCloud,
  File as FileIcon,
  Download,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  ArrowUpRight,
  ArrowDownLeft,
  HardDrive
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { TransferFile, ActiveTransfer, ConnectionState } from '../types';

interface FileDropzoneSectionProps {
  files: TransferFile[];
  activeTransfer: ActiveTransfer | null;
  connectionState: ConnectionState;
  onSendFile: (file: File) => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

function getFileIcon(mimeType: string, name: string) {
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) {
    return <ImageIcon className="w-5 h-5 text-purple-400" />;
  }
  if (mimeType.startsWith('video/') || /\.(mp4|webm|mkv|mov)$/i.test(name)) {
    return <Film className="w-5 h-5 text-sky-400" />;
  }
  if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(name)) {
    return <Music className="w-5 h-5 text-amber-400" />;
  }
  if (mimeType.includes('zip') || mimeType.includes('tar') || /\.(zip|rar|7z|tar|gz)$/i.test(name)) {
    return <Archive className="w-5 h-5 text-emerald-400" />;
  }
  if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('pdf') || /\.(txt|md|json|pdf)$/i.test(name)) {
    return <FileText className="w-5 h-5 text-cobaltLight" />;
  }
  return <FileIcon className="w-5 h-5 text-slate-300" />;
}

export const FileDropzoneSection: React.FC<FileDropzoneSectionProps> = ({
  files,
  activeTransfer,
  connectionState,
  onSendFile,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isConnected = connectionState === 'connected';

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isConnected) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!isConnected) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        onSendFile(e.dataTransfer.files[i]);
      }
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (let i = 0; i < e.target.files.length; i++) {
        onSendFile(e.target.files[i]);
      }
      e.target.value = '';
    }
  };

  const triggerDownload = (file: TransferFile) => {
    if (!file.blobUrl && !file.blob) return;

    const isTemporaryUrl = !file.blobUrl;
    const url = file.blobUrl || URL.createObjectURL(file.blob!);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (isTemporaryUrl) {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    // Optional flair
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#FF6B35', '#FF1840', '#0047AB'],
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-surfaceBorder rounded-2xl p-5 shadow-surface-elevated">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-surfaceBorder">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-canvas border border-surfaceBorder text-slate-300">
            <HardDrive className="w-5 h-5 text-signalStart" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Chunked File Dropzone
            </h3>
            <p className="text-xs text-slate-400">
              High-speed 64 KB chunk streaming over encrypted WebRTC
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          <span>{files.length} file{files.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div
        id="file-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => isConnected && fileInputRef.current?.click()}
        className={`relative mt-4 border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center gap-3 transition-all duration-300 ${
          !isConnected
            ? 'border-surfaceBorder bg-canvas/40 opacity-60 cursor-not-allowed'
            : isDragOver
            ? 'border-signalEnd bg-signalEnd/10 scale-[1.01] shadow-[0_0_20px_rgba(255,24,64,0.3)] cursor-pointer'
            : 'border-surfaceBorder hover:border-cobalt bg-canvas/60 hover:bg-canvas cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          disabled={!isConnected}
        />

        <div className="p-3.5 rounded-2xl bg-surface border border-surfaceBorder text-slate-300 shadow-inner group">
          <UploadCloud
            className={`w-8 h-8 transition-transform duration-300 ${
              isDragOver ? 'scale-125 text-signalEnd' : 'text-cobaltLight group-hover:scale-110'
            }`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-white">
            {isConnected ? (
              <span>
                Drop files here or{' '}
                <span className="text-signal-gradient underline decoration-signalEnd/50">
                  browse to send
                </span>
              </span>
            ) : (
              <span>Connect to peer to start streaming files</span>
            )}
          </p>
          <p className="text-xs text-slate-400">
            Supports any file size • 64 KB WebRTC data-chunking engine with backpressure control
          </p>
        </div>
      </div>

      {/* Active Transfer Bar (10% Kinetic Accent) */}
      {activeTransfer && (
        <div className="mt-4 p-4 rounded-xl bg-canvas border border-surfaceBorder flex flex-col gap-2.5 shadow-sm animate-pulse-glow">
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 truncate">
              {activeTransfer.direction === 'send' ? (
                <span className="flex items-center gap-1 text-signalStart font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Sending:
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Receiving:
                </span>
              )}
              <span className="font-medium text-white truncate max-w-[180px] sm:max-w-xs">
                {activeTransfer.fileName}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-slate-300 shrink-0">
              <span>{formatSpeed(activeTransfer.speed)}</span>
              <span>•</span>
              <span className="font-bold text-signalEnd">{activeTransfer.progress}%</span>
            </div>
          </div>

          {/* Kinetic Progress Bar Fill */}
          <div className="w-full h-2.5 rounded-full bg-surfaceBorder overflow-hidden relative">
            <div
              className="h-full bg-signal-gradient transition-all duration-150 rounded-full shadow-[0_0_10px_#FF1840]"
              style={{ width: `${Math.max(3, activeTransfer.progress)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>
              {formatBytes(activeTransfer.bytesTransferred)} / {formatBytes(activeTransfer.fileSize)}
            </span>
            <span>64 KB Chunks Streaming</span>
          </div>
        </div>
      )}

      {/* Transfer Tray / File List */}
      <div className="mt-4 flex-1 flex flex-col min-h-[160px]">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Transfer Tray
        </h4>

        {files.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 rounded-xl bg-canvas/40 border border-surfaceBorder/40 text-center text-slate-500 text-xs">
            <FileIcon className="w-8 h-8 stroke-1 mb-2 text-slate-600" />
            <p>No files transferred yet</p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Dropped files will appear here with immediate download options
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-canvas border border-surfaceBorder hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-surface border border-surfaceBorder shrink-0">
                    {getFileIcon(file.mimeType, file.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate" title={file.name}>
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{formatBytes(file.size)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {file.direction === 'send' ? (
                          <span className="text-blue-300">Sent</span>
                        ) : (
                          <span className="text-emerald-400">Received</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Explicit Download Action Button (10% Kinetic Accent) */}
                <button
                  onClick={() => triggerDownload(file)}
                  title={`Download ${file.name}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-signal-gradient hover:opacity-95 active:scale-95 transition-all shadow-[0_0_12px_rgba(255,24,64,0.35)] shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
