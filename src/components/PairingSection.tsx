import { useState, useEffect, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  QrCode,
  Link2,
  ShieldCheck,
  ArrowRight,
  Radio,
  Eye,
  EyeOff,
  Camera,
  Send,
  DownloadCloud,
} from 'lucide-react';
import { NearbySharePanel } from './NearbySharePanel';
import { QrCameraScannerModal } from './QrCameraScannerModal';
import { discoveryService } from '../services/discoveryService';
import type { ConnectionState } from '../types';

interface PairingSectionProps {
  roomId: string;
  connectionState: ConnectionState;
  isHost: boolean;
  onJoinRoom: (targetRoomId: string) => void;
  onSwitchRole?: (targetMode: 'host' | 'receive') => void;
}

export const PairingSection: React.FC<PairingSectionProps> = ({
  roomId,
  connectionState,
  isHost,
  onJoinRoom,
  onSwitchRole,
}) => {
  const [activeTab, setActiveTab] = useState<'send' | 'receive'>(isHost ? 'send' : 'receive');
  const [copiedLink, setCopiedLink] = useState(false);
  const [manualRoomInput, setManualRoomInput] = useState('');
  const [isQrExpanded, setIsQrExpanded] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  // Sync activeTab when isHost prop changes
  useEffect(() => {
    setActiveTab(isHost ? 'send' : 'receive');
  }, [isHost]);

  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const defaultLanIp = (isLocalhost && typeof __LOCAL_LAN_IP__ !== 'undefined' && __LOCAL_LAN_IP__) ? __LOCAL_LAN_IP__ : '';

  const [lanIp, setLanIp] = useState(() => {
    if (typeof window !== 'undefined' && isLocalhost) {
      const saved = localStorage.getItem('padrop_lan_ip') || localStorage.getItem('peerdrop_lan_ip');
      if (saved) return saved;
      return defaultLanIp;
    }
    return '';
  });
  const [showLanConfig, setShowLanConfig] = useState(false);
  const [tempLanInput, setTempLanInput] = useState(lanIp || defaultLanIp);

  // In production (!isLocalhost), effectiveOrigin ALWAYS uses window.location.origin (e.g. https://padrop.pages.dev)
  // In localhost development, if lanIp is provided, use it so mobile devices on the same Wi-Fi can reach the dev server
  const devPort = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : ':5173';
  const effectiveOrigin = (isLocalhost && lanIp.trim())
    ? (lanIp.startsWith('http') ? lanIp.trim() : `http://${lanIp.trim()}${lanIp.includes(':') ? '' : devPort}`)
    : (typeof window !== 'undefined' ? window.location.origin : '');

  const pairUrl = `${effectiveOrigin}/?room=${roomId}&mode=receive`;

  // Synchronize discoverability toggle with discoveryService
  useEffect(() => {
    discoveryService.updateHostDiscoverable(isDiscoverable);
  }, [isDiscoverable]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(pairUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleManualJoin = (e: FormEvent) => {
    e.preventDefault();
    if (manualRoomInput.trim()) {
      onJoinRoom(manualRoomInput.trim());
    }
  };

  const handleTabSwitch = (tab: 'send' | 'receive') => {
    setActiveTab(tab);
    if (onSwitchRole) {
      onSwitchRole(tab === 'send' ? 'host' : 'receive');
    }
  };

  const handleCameraScanSuccess = (targetRoomId: string) => {
    onJoinRoom(targetRoomId);
  };

  const isConnected = connectionState === 'connected';

  // Compact Linked status chip when connected
  if (isConnected && !isQrExpanded) {
    return (
      <section className="w-full bg-surface border border-surfaceBorder rounded-2xl p-3 sm:p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3 transition-all duration-300">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-canvas border border-emerald-500/30 text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2 sm:h-2.5 sm:w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signalEnd opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-signal-gradient"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-white">
                Direct WebRTC Channel Active
              </span>
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wider uppercase text-white shadow-xs ${
                isHost ? 'bg-signal-gradient' : 'bg-cobalt'
              }`}>
                {isHost ? 'HOST' : 'GUEST'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Room <span className="font-mono text-slate-200 font-semibold">{roomId}</span> • Real-time clipboard & 64KB chunked file streaming
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsQrExpanded(true)}
            className="min-h-[38px] sm:min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-canvas hover:bg-surfaceBorder border border-surfaceBorder text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            <QrCode className="w-3.5 h-3.5 text-cobaltLight" />
            <span>Show QR</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="min-h-[38px] sm:min-h-[44px] flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl bg-canvas hover:bg-surfaceBorder border border-surfaceBorder text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Pair Link</span>
              </>
            )}
          </button>
        </div>
      </section>
    );
  }

  // Expanded / Role Selection Pairing Section
  return (
    <section className="w-full flex flex-col gap-4 transition-all">
      {/* Role Selection Tabs */}
      <div className="w-full flex items-center justify-between p-1 sm:p-1.5 rounded-2xl bg-surface border border-surfaceBorder shadow-inner gap-1">
        <button
          type="button"
          onClick={() => handleTabSwitch('send')}
          className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'send'
              ? 'bg-signal-gradient text-white shadow-[0_0_16px_rgba(255,24,64,0.4)] scale-[1.01]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-canvas/50'
          }`}
        >
          <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span>
            <span className="inline sm:hidden">Send Mode</span>
            <span className="hidden sm:inline">Send from this Device</span>
          </span>
          <span className="hidden md:inline-block text-[10px] font-normal opacity-80">(Display QR)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('receive')}
          className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'receive'
              ? 'bg-cobalt hover:bg-cobaltLight text-white shadow-[0_0_16px_rgba(0,71,171,0.5)] scale-[1.01]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-canvas/50'
          }`}
        >
          <DownloadCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span>
            <span className="inline sm:hidden">Receive Mode</span>
            <span className="hidden sm:inline">Receive on this Device</span>
          </span>
          <span className="hidden md:inline-block text-[10px] font-normal opacity-80">(Camera & Radar)</span>
        </button>
      </div>

      {/* VIEW 1: SENDER VIEW (Host QR Code & Sharing Link) */}
      {activeTab === 'send' && (
        <div className="w-full bg-surface border border-surfaceBorder rounded-2xl p-5 shadow-surface-elevated animate-fadeIn">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left Side: QR Code Display */}
            <div className="flex flex-col sm:flex-row items-center gap-5 w-full md:w-auto">
              <div className="relative p-3.5 rounded-2xl bg-white shadow-xl flex items-center justify-center shrink-0 group">
                <QRCodeSVG
                  value={pairUrl}
                  size={136}
                  level="M"
                  includeMargin={false}
                  className="transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-signalEnd/40 transition-colors pointer-events-none" />
              </div>

              <div className="flex flex-col gap-2 text-center sm:text-left max-w-md">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signalEnd opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal-gradient"></span>
                  </span>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Scan with Receiving Device
                  </h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-signal-gradient text-white">
                    Sender Mode
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Point your phone, tablet, or another laptop at this QR code to start receiving files and live clipboard text.
                </p>

                {/* Direct Pair Link Trigger & Proximity Visibility */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-1">
                  <button
                    id="copy-pair-link-btn"
                    type="button"
                    onClick={handleCopyLink}
                    className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-signal-gradient hover:opacity-95 active:scale-95 transition-all shadow-[0_0_16px_rgba(255,24,64,0.45)]"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4" />
                        <span>Copy Pair Link</span>
                      </>
                    )}
                  </button>

                  {/* Proximity / Discoverable Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsDiscoverable(!isDiscoverable)}
                    title={isDiscoverable ? 'Device is discoverable to nearby peers' : 'Device is hidden from nearby discovery'}
                    className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${isDiscoverable
                        ? 'bg-canvas border-emerald-500/40 text-emerald-300 hover:bg-surfaceBorder'
                        : 'bg-canvas border-surfaceBorder text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    {isDiscoverable ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Radar: Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                        <span>Radar: Hidden</span>
                      </>
                    )}
                  </button>

                  {isConnected && (
                    <button
                      type="button"
                      onClick={() => setIsQrExpanded(false)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-canvas border border-surfaceBorder text-slate-400 hover:text-white text-xs font-medium transition-colors"
                    >
                      Minimize
                    </button>
                  )}
                </div>

                {/* LAN Wi-Fi helper if host is viewed on localhost */}
                {isLocalhost && !isConnected && (
                  <div className="mt-1.5 text-left">
                    {!showLanConfig ? (
                      <button
                        type="button"
                        onClick={() => setShowLanConfig(true)}
                        className="text-[11px] text-slate-400 hover:text-signalStart underline decoration-dotted decoration-slate-500 transition-colors flex items-center gap-1"
                      >
                        <span>📱</span>
                        <span>
                          {lanIp
                            ? `QR linked to Wi-Fi IP: ${lanIp} (click to change)`
                            : 'Scanning from phone on localhost? Set Wi-Fi IP'}
                        </span>
                      </button>
                    ) : (
                      <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-canvas border border-surfaceBorder mt-1 max-w-sm">
                        <span className="text-[11px] text-slate-300 font-medium">
                          Enter your PC's Wi-Fi IP so your phone camera can reach localhost:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={tempLanInput}
                            onChange={(e) => setTempLanInput(e.target.value)}
                            placeholder="e.g. 192.168.1.50"
                            className="min-h-[38px] px-2.5 py-1 rounded-lg bg-surface border border-surfaceBorder text-white text-xs font-mono flex-1 focus:outline-none focus:border-signalEnd"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = tempLanInput.trim();
                              setLanIp(val);
                              if (val) localStorage.setItem('padrop_lan_ip', val);
                              setShowLanConfig(false);
                            }}
                            className="min-h-[38px] px-3 py-1 rounded-lg bg-signal-gradient text-white text-xs font-semibold shadow-sm hover:opacity-90"
                          >
                            Save
                          </button>
                          {lanIp && (
                            <button
                              type="button"
                              onClick={() => {
                                setLanIp('');
                                setTempLanInput('');
                                localStorage.removeItem('padrop_lan_ip');
                                localStorage.removeItem('peerdrop_lan_ip');
                                setShowLanConfig(false);
                              }}
                              className="min-h-[38px] px-2 py-1 rounded-lg bg-surface border border-surfaceBorder text-slate-400 hover:text-white text-xs"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: RECEIVER VIEW (Camera Scanner, Radar & Manual Room Entry) */}
      {activeTab === 'receive' && (
        <div className="w-full flex flex-col gap-5 animate-fadeIn">
          {/* Hero In-App Camera Scanner Action Card */}
          <div className="w-full bg-surface border border-cobalt/40 rounded-2xl p-5 shadow-surface-elevated flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cobalt/20 border border-cobalt/40 text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                <Camera className="w-6 h-6" />
              </div>
              <div className="flex flex-col text-center sm:text-left">
                <h3 className="text-base font-bold text-white tracking-tight">
                  In-App Camera QR Scanner
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Scan the QR code displayed on your PC or sender device without leaving the web app.
                </p>
              </div>
            </div>

            <button
              id="open-camera-scanner-btn"
              type="button"
              onClick={() => setIsCameraScannerOpen(true)}
              className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-xl bg-signal-gradient hover:opacity-95 active:scale-95 text-xs sm:text-sm font-bold text-white transition-all shadow-[0_0_20px_rgba(255,24,64,0.45)] flex items-center justify-center gap-2 shrink-0"
            >
              <Camera className="w-4 h-4" />
              <span>Scan QR Code with Camera</span>
            </button>
          </div>

          {/* Two Sub-Panels: LEFT = Nearby Share Radar | RIGHT = Manual Room Code Entry */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch w-full">
            {/* LEFT PANEL: Nearby Share (Fast Discovery Path) */}
            <div className="w-full h-full bg-surface border border-surfaceBorder rounded-2xl p-4 sm:p-5 shadow-surface-elevated">
              <NearbySharePanel
                currentRoomId={roomId}
                onJoinRoom={onJoinRoom}
              />
            </div>

            {/* RIGHT PANEL: Connect to Existing Room (Manual Fallback Path) */}
            <div className="w-full h-full bg-surface border border-surfaceBorder rounded-2xl p-4 sm:p-5 shadow-surface-elevated flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-canvas border border-surfaceBorder text-cobaltLight shadow-sm">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Connect to Existing Room Code
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Join manually using the 6-character room code from the Sender
                    </p>
                  </div>
                </div>

                <form onSubmit={handleManualJoin} className="flex flex-col gap-3 mt-1">
                  <div className="relative">
                    <input
                      id="manual-room-input"
                      type="text"
                      value={manualRoomInput}
                      onChange={(e) => setManualRoomInput(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      placeholder="Enter 6-char Room Code (e.g. ab3k9x)"
                      maxLength={8}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-canvas border border-surfaceBorder focus:border-signalEnd focus:outline-none text-sm font-mono text-white placeholder:text-slate-500 tracking-wider uppercase transition-colors"
                    />
                  </div>
                  <button
                    id="manual-join-button"
                    type="submit"
                    disabled={!manualRoomInput.trim()}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cobalt hover:bg-cobaltLight disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white transition-all shadow-sm active:scale-95"
                  >
                    <span>Join Session</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>

              <div className="p-3 rounded-xl bg-canvas/60 border border-surfaceBorder text-center">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Both devices must be online to complete the direct WebRTC peer handshake.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Camera QR Code Scanner Viewfinder Modal */}
      <QrCameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScanSuccess={handleCameraScanSuccess}
      />
    </section>
  );
};
