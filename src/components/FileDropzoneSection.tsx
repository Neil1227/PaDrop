import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
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
  HardDrive,
  X,
  Send,
  Plus,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { TransferFile, ActiveTransfer, ConnectionState } from '../types';

interface FileDropzoneSectionProps {
  files: TransferFile[];
  activeTransfer: ActiveTransfer | null;
  connectionState: ConnectionState;
  onSendFile: (file: File) => void;
}

interface StagedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  previewUrl?: string;
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
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isConnected = connectionState === 'connected';

  // Revoke preview object URLs when staged files change or on unmount
  useEffect(() => {
    return () => {
      stagedFiles.forEach((f) => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
    };
  }, []);

  const addFilesToStaging = (newFiles: FileList | File[]) => {
    const additions: StagedFile[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
      
      let previewUrl: string | undefined;
      if (isImage || isVideo) {
        try {
          previewUrl = URL.createObjectURL(file);
        } catch {
          // ignore
        }
      }

      additions.push({
        id: `staged-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${i}`,
        file,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        previewUrl,
      });
    }

    setStagedFiles((prev) => [...prev, ...additions]);
  };

  const handleRemoveStagedFile = (id: string) => {
    setStagedFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleClearStaged = () => {
    stagedFiles.forEach((f) => {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl);
      }
    });
    setStagedFiles([]);
  };

  const handleSendStagedFiles = () => {
    if (!isConnected || stagedFiles.length === 0) return;
    
    // Dispatch all staged files to transfer queue
    for (const staged of stagedFiles) {
      onSendFile(staged.file);
      if (staged.previewUrl) {
        URL.revokeObjectURL(staged.previewUrl);
      }
    }
    setStagedFiles([]);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToStaging(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToStaging(e.target.files);
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

    // Optional celebratory flair
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

  const totalStagedBytes = stagedFiles.reduce((acc, f) => acc + f.size, 0);

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
              Stage images, videos & files for high-speed WebRTC transfer
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          <span>{files.length} sent/received</span>
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div
        id="file-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative mt-4 border-2 border-dashed rounded-xl p-5 sm:p-6 text-center flex flex-col items-center justify-center gap-3 transition-all duration-300 cursor-pointer ${
          isDragOver
            ? 'border-signalEnd bg-signalEnd/10 scale-[1.01] shadow-[0_0_20px_rgba(255,24,64,0.3)]'
            : 'border-surfaceBorder hover:border-cobalt bg-canvas/60 hover:bg-canvas'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
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
            <span>
              Drop photos, videos or documents or{' '}
              <span className="text-signal-gradient underline decoration-signalEnd/50">
                browse files
              </span>
            </span>
          </p>
          <p className="text-xs text-slate-400">
            Preview images & videos before sending • 64 KB chunked streaming
          </p>
        </div>
      </div>

      {/* STAGED / PENDING FILES QUEUE */}
      {stagedFiles.length > 0 && (
        <div className="mt-4 p-4 rounded-xl bg-canvas border border-cobalt/40 flex flex-col gap-3 shadow-md animate-fadeIn">
          {/* Staged Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cobalt text-white">
                STAGED
              </span>
              <span className="text-xs font-bold text-white">
                {stagedFiles.length} file{stagedFiles.length === 1 ? '' : 's'} ready to send
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                ({formatBytes(totalStagedBytes)})
              </span>
            </div>

            <button
              type="button"
              onClick={handleClearStaged}
              className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          {/* Staged Previews Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {stagedFiles.map((item) => (
              <div
                key={item.id}
                className="relative group flex flex-col p-2 rounded-xl bg-surface border border-surfaceBorder hover:border-slate-500 transition-all overflow-hidden"
              >
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveStagedFile(item.id)}
                  title="Remove file"
                  aria-label={`Remove ${item.name}`}
                  className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center text-xs transition-colors shadow-sm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Media Preview Box */}
                <div className="w-full h-20 rounded-lg bg-canvas border border-surfaceBorder/80 flex items-center justify-center overflow-hidden mb-1.5 relative">
                  {item.previewUrl && item.mimeType.startsWith('image/') ? (
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : item.previewUrl && item.mimeType.startsWith('video/') ? (
                    <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
                      <video
                        src={item.previewUrl}
                        className="w-full h-full object-cover opacity-80"
                        muted
                        playsInline
                      />
                      <Film className="w-6 h-6 text-sky-400 absolute drop-shadow-md" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      {getFileIcon(item.mimeType, item.name)}
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatBytes(item.size)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2 pt-1 border-t border-surfaceBorder">
            <button
              type="button"
              onClick={handleSendStagedFiles}
              disabled={!isConnected}
              className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 ${
                isConnected
                  ? 'bg-signal-gradient hover:opacity-95 shadow-[0_0_16px_rgba(255,24,64,0.45)]'
                  : 'bg-surfaceBorder text-slate-400 cursor-not-allowed opacity-75'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {isConnected
                  ? `Send ${stagedFiles.length} File${stagedFiles.length === 1 ? '' : 's'} (${formatBytes(totalStagedBytes)})`
                  : `Waiting for Peer to Connect... (${stagedFiles.length} Staged)`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Add more files"
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-surface border border-surfaceBorder hover:border-slate-400 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add More</span>
            </button>
          </div>
        </div>
      )}

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
          Transfer History & Completed Files
        </h4>

        {files.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 rounded-xl bg-canvas/40 border border-surfaceBorder/40 text-center text-slate-500 text-xs">
            <FileIcon className="w-8 h-8 stroke-1 mb-2 text-slate-600" />
            <p>No files transferred yet</p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Completed and received files will appear here with immediate download buttons
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

                {/* Explicit Download Action Button */}
                <button
                  type="button"
                  onClick={() => triggerDownload(file)}
                  title={`Download ${file.name}`}
                  aria-label={`Download ${file.name}`}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-signal-gradient hover:opacity-95 active:scale-95 transition-all shadow-[0_0_12px_rgba(255,24,64,0.35)] shrink-0"
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

