import { X, QrCode, Clipboard, UploadCloud, ShieldCheck, AlertTriangle } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-safe pb-safe px-safe bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal Card */}
      <div 
        className="relative w-full max-w-lg bg-surface border border-surfaceBorder rounded-2xl shadow-2xl p-5 sm:p-6 flex flex-col gap-4 text-left max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-canvas border border-surfaceBorder p-1.5 shadow-inner shrink-0 flex items-center justify-center">
              <img
                src="/PaDrop-no-bg.png"
                alt="PaDrop Logo"
                className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(255,24,64,0.25)]"
              />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                About PaDrop
              </h3>
              <p className="text-xs text-slate-400">
                Simple, direct peer-to-peer sharing between your devices
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-canvas transition-colors"
            title="Close"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Quick Guide */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            How It Works (The Basics)
          </span>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Step 1 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-canvas border border-surfaceBorder/80">
              <div className="p-2 rounded-lg bg-surface border border-surfaceBorder text-cobaltLight shrink-0 mt-0.5">
                <QrCode className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">1. Pair Your Devices</p>
                <p className="text-slate-300 mt-0.5 leading-relaxed">
                  Scan the QR code with your phone camera, or copy and send the pair link to any device.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-canvas border border-surfaceBorder/80">
              <div className="p-2 rounded-lg bg-surface border border-surfaceBorder text-emerald-400 shrink-0 mt-0.5">
                <Clipboard className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">2. Live Shared Clipboard</p>
                <p className="text-slate-300 mt-0.5 leading-relaxed">
                  Type or paste notes, URLs, or text snippets. Text updates in real time across both connected screens.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-canvas border border-surfaceBorder/80">
              <div className="p-2 rounded-lg bg-surface border border-surfaceBorder text-signalStart shrink-0 mt-0.5">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">3. Direct File Drop</p>
                <p className="text-slate-300 mt-0.5 leading-relaxed">
                  Drag and drop photos, videos, or documents to stream them directly between devices with instant download buttons.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Highlights */}
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-canvas/60 border border-surfaceBorder text-xs text-slate-300">
          <div className="flex items-center gap-2 font-semibold text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Key Advantages:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1 text-[11px] sm:text-xs">
            <li>
              <strong className="text-white">Zero Cloud Storage:</strong> Files & text travel directly between devices. No servers ever save your data.
            </li>
            <li>
              <strong className="text-white">No Accounts or Setup:</strong> No sign-ups, passwords, or emails. Close the tab and your session vanishes.
            </li>
          </ul>
        </div>

        {/* App Limitations Note */}
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>App Limitations (Good to Know):</span>
          </div>
          <ul className="list-disc list-inside space-y-1.5 text-slate-300 pl-1 text-[11px] sm:text-xs">
            <li>
              <strong className="text-white">Keep Screen & Tab Active:</strong> Because transfers are direct, both devices must keep their browser open and phone unlocked while files are transferring.
            </li>
            <li>
              <strong className="text-white">No Offline / Stored Transfers:</strong> Both devices must be online at the same time (you cannot leave a file for someone to pick up hours later).
            </li>
            <li>
              <strong className="text-white">Large Files on Mobile:</strong> Handles photos, documents, and standard videos easily. Very huge files (2 GB+) may run out of phone browser memory.
            </li>
            <li>
              <strong className="text-white">1-on-1 Sessions:</strong> Designed for direct private pairing between two devices at a time.
            </li>
          </ul>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-signal-gradient hover:opacity-95 active:scale-95 transition-all shadow-[0_0_16px_rgba(255,24,64,0.4)]"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};
