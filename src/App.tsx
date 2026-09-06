import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { AlertTriangle } from 'lucide-react';
import { TopBar } from './components/TopBar';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { PairingSection } from './components/PairingSection';
import { ClipboardSection } from './components/ClipboardSection';
import { FileDropzoneSection } from './components/FileDropzoneSection';
import { InfoModal } from './components/InfoModal';
import { TransferConfirmationModal } from './components/TransferConfirmationModal';
import { ConnectionConfirmationModal } from './components/ConnectionConfirmationModal';
import { PeerService } from './services/peerService';
import { discoveryService } from './services/discoveryService';
import type { ConnectionState, TransferFile, ActiveTransfer, ChatMessage, IncomingTransferRequest, IncomingConnectionRequest } from './types';

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
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [pendingTransferRequest, setPendingTransferRequest] = useState<IncomingTransferRequest | null>(null);
  const [pendingConnectionRequest, setPendingConnectionRequest] = useState<IncomingConnectionRequest | null>(null);
  
  // PWA install prompt event
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const peerServiceRef = useRef<PeerService | null>(null);

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

    if (mode === 'host') {
      discoveryService.startHostBroadcast({ roomId: rId, isDiscoverable: true });
    } else {
      discoveryService.stopHostBroadcast();
    }

    const service = new PeerService({
      onConnectionChange: (state, errorMsg) => {
        setConnectionState(state);
        if (errorMsg) setErrorMessage(errorMsg);
        else setErrorMessage(null);

        if (mode === 'host') {
          discoveryService.updateHostStatus(state === 'connected' ? 'connected' : 'available');
        }

        if (state === 'connected') {
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
      onTransferRequest: (request) => {
        setPendingTransferRequest(request);
      },
      onConnectionRequest: (request) => {
        setPendingConnectionRequest(request);
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

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlRoom = searchParams.get('room');
    const urlMode = searchParams.get('mode');

    let initialRoom = '';
    let hostMode = true;

    if (urlRoom && urlRoom.trim().length > 0) {
      initialRoom = urlRoom.trim().toLowerCase();
      hostMode = urlMode === 'receive';
    } else {
      initialRoom = generateRoomId();
      hostMode = true;
      const newUrl = `${window.location.pathname}?room=${initialRoom}`;
      window.history.replaceState({}, '', newUrl);
    }

    setRoomId(initialRoom);
    setIsHost(hostMode);

    startPeerSession(initialRoom, hostMode ? 'host' : 'receive');

    return () => {
      peerServiceRef.current?.cleanup();
      discoveryService.stopHostBroadcast();
    };
  }, []);

  const handleManualJoin = (targetRoomId: string) => {
    const cleaned = targetRoomId.trim().toLowerCase();
    if (!cleaned) return;
    setRoomId(cleaned);
    setIsHost(false);
    const newUrl = `${window.location.pathname}?room=${cleaned}&mode=send`;
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
    setPendingTransferRequest(null);
    setPendingConnectionRequest(null);
    const newUrl = `${window.location.pathname}?room=${newRoom}`;
    window.history.replaceState({}, '', newUrl);
    startPeerSession(newRoom, 'host');
  };

  const handleSwitchRole = (targetMode: 'host' | 'receive') => {
    if (targetMode === 'host') {
      handleNewRoom();
    } else {
      setIsHost(false);
      const newUrl = `${window.location.pathname}?room=${roomId}&mode=send`;
      window.history.replaceState({}, '', newUrl);
      startPeerSession(roomId, 'receive');
    }
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

  const handleAcceptConnection = () => {
    if (peerServiceRef.current) {
      peerServiceRef.current.acceptConnection();
    }
    setPendingConnectionRequest(null);
  };

  const handleDeclineConnection = () => {
    if (peerServiceRef.current) {
      peerServiceRef.current.declineConnection();
    }
    setPendingConnectionRequest(null);
  };

  const handleAcceptTransfer = (requestId: string) => {
    if (peerServiceRef.current) {
      peerServiceRef.current.acceptTransfer(requestId);
    }
    setPendingTransferRequest(null);
  };

  const handleDeclineTransfer = (requestId: string) => {
    if (peerServiceRef.current) {
      peerServiceRef.current.declineTransfer(requestId);
    }
    setPendingTransferRequest(null);
  };

  const handleDisconnect = () => {
    if (peerServiceRef.current) {
      peerServiceRef.current.disconnect();
    }
    setActiveTransfer(null);
    setPendingTransferRequest(null);
    setPendingConnectionRequest(null);
  };

  return (
    <div className="min-h-screen bg-canvas bg-canvas-gradient flex flex-col selection:bg-signalEnd selection:text-white">
      {/* Top Bar */}
      <TopBar
        roomId={roomId}
        connectionState={connectionState}
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

      {/* Connection Approval Modal (Pairing prompt for Receiver) */}
      <ConnectionConfirmationModal
        request={pendingConnectionRequest}
        onAccept={handleAcceptConnection}
        onDecline={handleDeclineConnection}
      />

      {/* Transfer Approval Modal (AirDrop style) */}
      <TransferConfirmationModal
        request={pendingTransferRequest}
        onAccept={handleAcceptTransfer}
        onDecline={handleDeclineTransfer}
      />

      {/* Pwa Install Banner */}
      <PwaInstallBanner
        promptEvent={installPrompt}
        onInstalled={() => setInstallPrompt(null)}
      />

      {/* Main Container: Strict Single-Page Centered Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-safe px-safe flex flex-col gap-6 justify-start">
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
          onSwitchRole={handleSwitchRole}
          onDisconnect={handleDisconnect}
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

        {/* Simplified Clean Footer */}
        <footer className="w-full pt-4 pb-8 sm:pb-6 border-t border-surfaceBorder/60 flex items-center justify-center text-center text-slate-500 font-mono text-[11px] sm:text-xs">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
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
