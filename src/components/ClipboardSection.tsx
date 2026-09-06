import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  Clipboard,
  Copy,
  Check,
  Trash2,
  ClipboardPaste,
  MessageSquare,
  Send,
} from 'lucide-react';
import type { ConnectionState, ChatMessage } from '../types';

interface ClipboardSectionProps {
  text: string;
  onTextChange: (newText: string) => void;
  connectionState: ConnectionState;
  lastSyncTime: number | null;
  chatMessages: ChatMessage[];
  onSendChatMessage: (text: string) => void;
  onClearChat: () => void;
  isHost: boolean;
}

export const ClipboardSection: React.FC<ClipboardSectionProps> = ({
  text,
  onTextChange,
  connectionState,
  lastSyncTime,
  chatMessages,
  onSendChatMessage,
  onClearChat,
  isHost,
}) => {
  const [activeTab, setActiveTab] = useState<'scratchpad' | 'chat'>('scratchpad');
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Scratchpad state
  const [copied, setCopied] = useState(false);
  const [localText, setLocalText] = useState(text);
  const [prevIncomingText, setPrevIncomingText] = useState(text);
  const [isTyping, setIsTyping] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat input state
  const [chatInput, setChatInput] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Synchronize localText with incoming text during render
  if (text !== prevIncomingText) {
    setPrevIncomingText(text);
    if (!isTyping) {
      setLocalText(text);
    }
  }

  // Track unread messages when in scratchpad tab
  const prevMessagesLengthRef = useRef(chatMessages.length);
  useEffect(() => {
    if (chatMessages.length > prevMessagesLengthRef.current) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      const isFromPeer = lastMsg.sender !== (isHost ? 'host' : 'guest');
      if (activeTab !== 'chat' && isFromPeer) {
        setUnreadCount((prev) => prev + 1);
      }
    }
    prevMessagesLengthRef.current = chatMessages.length;
  }, [chatMessages, activeTab, isHost]);

  // Auto-scroll chat inside its own container without scrolling the mobile window!
  useEffect(() => {
    if (activeTab === 'chat' && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatMessages, activeTab]);

  const handleTabSwitch = (tab: 'scratchpad' | 'chat') => {
    setActiveTab(tab);
    if (tab === 'chat') {
      setUnreadCount(0);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalText(val);
    setIsTyping(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onTextChange(val);
      setIsTyping(false);
    }, 150);
  };

  const handleCopyToClipboard = async () => {
    if (!localText) return;
    try {
      await navigator.clipboard.writeText(localText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const pasted = await navigator.clipboard.readText();
      if (pasted) {
        setLocalText(pasted);
        onTextChange(pasted);
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  const handleClearScratchpad = () => {
    setLocalText('');
    onTextChange('');
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || connectionState !== 'connected') return;
    onSendChatMessage(chatInput.trim());
    setChatInput('');
  };

  const handleChatKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const handleCopyMessage = async (msgId: string, msgText: string) => {
    try {
      await navigator.clipboard.writeText(msgText);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {
      // ignore
    }
  };

  const formatMessageTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const charCount = localText.length;
  const wordCount = localText.trim() ? localText.trim().split(/\s+/).length : 0;
  const isConnected = connectionState === 'connected';

  return (
    <div className="flex flex-col h-full bg-surface border border-surfaceBorder rounded-2xl p-4 sm:p-5 shadow-surface-elevated">
      {/* Header with Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-surfaceBorder">
        {/* Left: Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-canvas border border-surfaceBorder">
          <button
            onClick={() => handleTabSwitch('scratchpad')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'scratchpad'
                ? 'bg-surface text-white shadow-sm border border-surfaceBorder'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5 text-cobaltLight" />
            <span>Scratchpad</span>
          </button>

          <button
            onClick={() => handleTabSwitch('chat')}
            className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'chat'
                ? 'bg-surface text-white shadow-sm border border-surfaceBorder'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-signalStart" />
            <span>P2P Chat</span>
            {unreadCount > 0 && activeTab !== 'chat' && (
              <span className="flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-signal-gradient text-white animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Right: Live Status Badge */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-canvas border border-surfaceBorder text-[11px] font-medium text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>
                {activeTab === 'scratchpad' && isTyping
                  ? 'Syncing...'
                  : activeTab === 'scratchpad' && lastSyncTime
                  ? 'Synced just now'
                  : 'Live P2P Sync'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-canvas border border-surfaceBorder text-[11px] font-medium text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              <span>Disconnected</span>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: Synchronized Scratchpad */}
      {activeTab === 'scratchpad' && (
        <>
          <div className="relative flex-1 mt-4 flex flex-col min-h-[260px] sm:min-h-[300px]">
            <textarea
              id="shared-clipboard-textarea"
              value={localText}
              onChange={handleChange}
              placeholder={
                isConnected
                  ? 'Type or paste any text, notes, URLs, code, or tokens here... changes sync instantaneously to connected peer!'
                  : 'Pair with another device above to sync clipboard in real-time, or paste content now to prepare.'
              }
              className="w-full flex-1 p-4 rounded-xl bg-canvas border border-surfaceBorder focus:border-signalEnd focus:ring-1 focus:ring-signalEnd/50 focus:outline-none text-slate-100 placeholder:text-slate-500 font-mono text-sm leading-relaxed resize-none transition-all"
            />

            {/* Quick Actions Row */}
            <div className="flex items-center justify-between mt-2 pt-1 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span>
                  <strong className="text-slate-200">{charCount}</strong> chars
                </span>
                <span>•</span>
                <span>
                  <strong className="text-slate-200">{wordCount}</strong> words
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePasteFromClipboard}
                  title="Paste from device clipboard"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-canvas hover:bg-surfaceBorder border border-surfaceBorder text-slate-300 hover:text-white transition-colors text-xs"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-cobaltLight" />
                  <span className="hidden sm:inline">Paste</span>
                </button>
                <button
                  onClick={handleClearScratchpad}
                  title="Clear scratchpad"
                  disabled={!localText}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-canvas hover:bg-surfaceBorder border border-surfaceBorder text-slate-400 hover:text-rose-400 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="mt-4 pt-3 border-t border-surfaceBorder flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400 text-center sm:text-left">
              {isConnected
                ? 'Updates on either device sync instantaneously over WebRTC.'
                : 'Pair device to enable instant remote clipboard synchronization.'}
            </p>

            <button
              id="copy-to-clipboard-btn"
              onClick={handleCopyToClipboard}
              disabled={!localText}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-signal-gradient hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-[0_0_18px_rgba(255,24,64,0.4)] shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Copied to Device Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy to Device Clipboard</span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* TAB 2: Live P2P Chat (Zero-Database) */}
      {activeTab === 'chat' && (
        <div className="flex-1 mt-4 flex flex-col min-h-[320px] justify-between">
          {/* Chat Messages List */}
          <div
            ref={chatContainerRef}
            className="flex-1 max-h-[300px] overflow-y-auto pr-1 flex flex-col gap-2.5"
          >
            {chatMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-xl bg-canvas/40 border border-surfaceBorder/40 text-center text-slate-500 text-xs my-auto">
                <MessageSquare className="w-8 h-8 stroke-1 mb-2 text-slate-600" />
                <p className="font-semibold text-slate-400">Direct P2P Chat</p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
                  {isConnected
                    ? 'Messages stream directly between devices in RAM. No database or cloud logs.'
                    : 'Connect a peer to start chatting in real-time!'}
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.sender === (isHost ? 'host' : 'guest');
                const isCopied = copiedMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-medium">
                      <span>{isMe ? 'You' : msg.senderRole}</span>
                      <span>•</span>
                      <span>{formatMessageTime(msg.timestamp)}</span>
                    </div>

                    <div className="relative flex items-center gap-1.5 max-w-[85%] sm:max-w-[75%]">
                      {/* Copy button on Left for My Messages */}
                      {isMe && (
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          title="Copy message"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-canvas text-slate-400 hover:text-white"
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed break-words select-text ${
                          isMe
                            ? 'bg-signal-gradient text-white rounded-tr-none shadow-md shadow-signalEnd/20'
                            : 'bg-canvas border border-surfaceBorder text-slate-100 rounded-tl-none shadow-sm'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {/* Copy button on Right for Peer Messages */}
                      {!isMe && (
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          title="Copy message"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-canvas text-slate-400 hover:text-white"
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input & Actions Bar */}
          <div className="mt-3 pt-3 border-t border-surfaceBorder flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                disabled={!isConnected}
                placeholder={
                  isConnected
                    ? 'Type a message... (Press Enter to send)'
                    : 'Pair devices to enable real-time chat'
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-canvas border border-surfaceBorder focus:border-signalEnd focus:outline-none text-xs sm:text-sm text-white placeholder:text-slate-500 transition-all disabled:opacity-50"
              />

              <button
                onClick={handleSendChat}
                disabled={!isConnected || !chatInput.trim()}
                title="Send message"
                aria-label="Send chat message"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-xl bg-signal-gradient hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-sm shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>

              {chatMessages.length > 0 && (
                <button
                  onClick={onClearChat}
                  title="Clear chat history"
                  aria-label="Clear chat history"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-xl bg-canvas border border-surfaceBorder hover:border-slate-500 text-slate-400 hover:text-rose-400 active:scale-95 transition-all shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>Zero cloud storage • 100% in-memory WebRTC chat</span>
              <span className="hidden sm:inline">Press Enter ↵ to send</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
