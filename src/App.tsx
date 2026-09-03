import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ShieldCheck, Zap, Lock, AlertTriangle } from 'lucide-react';
import { TopBar } from './components/TopBar';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { PairingSection } from './components/PairingSection';
import { ClipboardSection } from './components/ClipboardSection';
import { FileDropzoneSection } from './components/FileDropzoneSection';
import { InfoModal } from './components/InfoModal';
import { PeerService } from './services/peerService';
import type { ConnectionState, TransferFile, ActiveTransfer, ChatMessage } from './types';

// Helper to generate 6-character clean room ID
function generateRoomId(): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz'; // readable characters without ambiguity
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function App() {
  const [roomId, setRoomId] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync states
  const [clipboardText, setClipboardText] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [transferFiles, setTransferFiles] = useState<TransferFile[]>([]);
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer | null>(null);

  // PWA install state
  const [installPrompt, setInstallPrompt] = useState<any | null>(null);

  // Info Modal state
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);

  // Peer service ref
  const peerServiceRef = useRef<PeerService | null>(null);

  // Handle beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const startPeerSession = (rId: string, mode: 'host' | 'receive') => {
    if (peerServiceRef.current) {
      peerServiceRef.current.cleanup();
    }

    const service = new PeerService({
      onConnectionChange: (state, errorMsg) => {
        setConnectionState(state);
        if (errorMsg) setErrorMessage(errorMsg);
        else setErrorMessage(null);

        if (state === 'connected') {
          // Trigger delightful celebratory confetti!
          try {
            confetti({
              particleCount: 50,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#FF6B35', '#FF1840', '#0047AB', '#FFFFFF'],
            });
          } catch {
            // ignore
          }
        }
      },
      onTextSync: (incomingText) => {
        setClipboardText(incomingText);
        setLastSyncTime(Date.now());
      },
      onChatMessage: (incomingMsg) => {
        setChatMessages((prev) => [...prev, incomingMsg]);
      },
      onTransferProgress: (transfer) => {
        setActiveTransfer(transfer);
      },
      onFileComplete: (completedFile) => {
        setTransferFiles((prev) => [completedFile, ...prev]);
      },
      onError: (msg) => {
        setErrorMessage(msg);
      },
    });

    peerServiceRef.current = service;
    service.init(rId, mode);
  };

  // Initialize Room & View detection
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlRoom = searchParams.get('room');
    const urlMode = searchParams.get('mode');

    let initialRoom = '';
    let hostMode = true;

    if (urlRoom && urlRoom.trim().length > 0) {
      initialRoom = urlRoom.trim().toLowerCase();
      hostMode = urlMode !== 'receive'; // If mode=receive, join as guest; otherwise host
    } else {
      initialRoom = generateRoomId();
      hostMode = true;
      // Update URL silently without full reload
      const newUrl = `${window.location.pathname}?room=${initialRoom}`;
      window.history.replaceState({}, '', newUrl);
    }

    setRoomId(initialRoom);
    setIsHost(hostMode);

    startPeerSession(initialRoom, hostMode ? 'host' : 'receive');

    return () => {
      peerServiceRef.current?.cleanup();
    };
  }, []);

  const handleManualJoin = (targetRoomId: string) => {
    const cleaned = targetRoomId.trim().toLowerCase();
    if (!cleaned) return;
    setRoomId(cleaned);
    setIsHost(false);
    const newUrl = `${window.location.pathname}?room=${cleaned}&mode=receive`;
    window.history.replaceState({}, '', newUrl);
    startPeerSession(cleaned, 'receive');
  };

  const handleNewRoom = () => {
    const newRoom = generateRoomId();
    setRoomId(newRoom);
    setIsHost(true);
    setClipboardText('');
    setChatMessages([]);
    setTransferFiles([]);
    setActiveTransfer(null);
    const newUrl = `${window.location.pathname}?room=${newRoom}`;
    window.history.replaceState({}, '', newUrl);
    startPeerSession(newRoom, 'host');
  };

  const handleClipboardChange = (newText: string) => {
    setClipboardText(newText);
    if (peerServiceRef.current && connectionState === 'connected') {
      peerServiceRef.current.sendText(newText);
    }
  };

  const handleSendChatMessage = (text: string) => {
    if (peerServiceRef.current && connectionState === 'connected') {
      const sentMsg = peerServiceRef.current.sendChatMessage(text);
      if (sentMsg) {
        setChatMessages((prev) => [...prev, sentMsg]);
      }
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
  };

  const handleSendFile = (file: File) => {
    if (peerServiceRef.current && connectionState === 'connected') {
      peerServiceRef.current.sendFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-canvas bg-canvas-gradient flex flex-col selection:bg-signalEnd selection:text-white">
      {/* Top Bar */}
      <TopBar
        roomId={roomId}
        connectionState={connectionState}
        isHost={isHost}
        canInstall={!!installPrompt}
        onInstallClick={() => {
          if (installPrompt) {
            installPrompt.prompt();
          }
        }}
        onNewRoom={handleNewRoom}
        onOpenInfo={() => setIsInfoOpen(true)}
      />

      {/* Info / Readme Modal */}
      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />

      {/* PWA Install Banner */}
      <PwaInstallBanner
        promptEvent={installPrompt}
        onInstalled={() => setInstallPrompt(null)}
      />

      {/* Main Container: Strict Single-Page Centered Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 justify-start">
        {/* Error Alert if any */}
        {errorMessage && (
          <div className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 text-[11px] text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Pairing / Host Section */}
        <PairingSection
          roomId={roomId}
          connectionState={connectionState}
          isHost={isHost}
          onJoinRoom={handleManualJoin}
        />

        {/* 2-Column Responsive Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch flex-1">
          {/* Left Column: Synchronized Clipboard & P2P Chat */}
          <div className="h-full">
            <ClipboardSection
              text={clipboardText}
              onTextChange={handleClipboardChange}
              connectionState={connectionState}
              lastSyncTime={lastSyncTime}
              chatMessages={chatMessages}
              onSendChatMessage={handleSendChatMessage}
              onClearChat={handleClearChat}
              isHost={isHost}
            />
          </div>

          {/* Right Column: Chunked File Dropzone & Transfer Tray */}
          <div className="h-full">
            <FileDropzoneSection
              files={transferFiles}
              activeTransfer={activeTransfer}
              connectionState={connectionState}
              onSendFile={handleSendFile}
            />
          </div>
        </div>

        {/* Bottom Feature Badges & Status Strip */}
        <footer className="w-full pt-2 pb-4 border-t border-surfaceBorder/60 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Lock className="w-3.5 h-3.5 text-cobaltLight" />
              <span>End-to-End Encrypted (DTLS/SRTP)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Zap className="w-3.5 h-3.5 text-signalStart" />
              <span>64 KB Chunk Streaming Engine</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Cloud Storage • Direct P2P</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2.5 text-slate-500 font-mono text-[11px]">
            <span>Developed by <strong className="text-slate-300 font-semibold">Neil Patrick Acierto</strong></span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span>PaDrop v1.0 • Modern Web PWA</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
