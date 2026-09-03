import React, { useState, useEffect } from 'react';
import { DownloadCloud, X, Smartphone, Share, PlusSquare, ChevronDown, ChevronUp } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallBannerProps {
  promptEvent: BeforeInstallPromptEvent | null;
  onInstalled?: () => void;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({
  promptEvent,
  onInstalled,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
    if (dismissed === 'true') {
      setIsVisible(false);
      return;
    }

    if (promptEvent || isIosDevice) {
      setIsVisible(true);
    }
  }, [promptEvent]);

  const handleInstallClick = async () => {
    if (promptEvent) {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
        if (onInstalled) onInstalled();
      }
    } else if (isIos) {
      setShowIosInstructions((prev) => !prev);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="w-full bg-gradient-to-r from-surface via-[#1f1f38] to-surface border-b border-surfaceBorder px-4 py-2.5 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-8 h-8 rounded-lg bg-canvas border border-surfaceBorder p-1 shrink-0 flex items-center justify-center shadow-inner">
            <img src="/PaDrop-no-bg.png" alt="PaDrop" className="w-full h-full object-contain" />
          </div>
          <div className="text-left">
            <span className="font-semibold text-white">Install PaDrop App:</span>{' '}
            <span className="text-slate-300">
              Run standalone for fast zero-cloud transfers directly from your home screen.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {promptEvent ? (
            <button
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-signal-gradient hover:opacity-95 active:scale-95 transition-all shadow-[0_0_12px_rgba(255,24,64,0.4)]"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Install Now</span>
            </button>
          ) : isIos ? (
            <button
              onClick={() => setShowIosInstructions((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-signal-gradient hover:opacity-95 transition-all shadow-[0_0_12px_rgba(255,24,64,0.4)]"
            >
              <span>iOS Install Guide</span>
              {showIosInstructions ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          ) : null}

          <button
            onClick={handleDismiss}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-surfaceBorder transition-colors"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Step-by-Step Accordion Fallback */}
      {isIos && showIosInstructions && (
        <div className="max-w-7xl mx-auto mt-3 p-3.5 rounded-xl bg-canvas border border-surfaceBorder text-xs text-slate-300 flex flex-col gap-2 transition-all">
          <p className="font-semibold text-white">How to install on iOS Safari:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-surfaceBorder/60">
              <Share className="w-4 h-4 text-blue-400 shrink-0" />
              <span>1. Tap the <strong>Share</strong> icon in Safari toolbar</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-surfaceBorder/60">
              <PlusSquare className="w-4 h-4 text-signalStart shrink-0" />
              <span>2. Scroll down & tap <strong>Add to Home Screen</strong></span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-surfaceBorder/60">
              <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>3. Open <strong>PaDrop</strong> directly from your Home Screen</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
