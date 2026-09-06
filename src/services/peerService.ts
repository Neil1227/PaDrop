import { Peer, type DataConnection } from 'peerjs';
import type { ConnectionState, PeerMessage, TransferFile, ActiveTransfer, ChatMessage, IncomingTransferRequest } from '../types';

const CHUNK_SIZE = 64 * 1024; // 64 KB
const MAX_BUFFERED_AMOUNT = 512 * 1024; // 512 KB backpressure threshold

export interface PeerServiceCallbacks {
  onConnectionChange: (state: ConnectionState, errorMsg?: string) => void;
  onTextSync: (text: string) => void;
  onChatMessage: (msg: ChatMessage) => void;
  onTransferProgress: (transfer: ActiveTransfer | null) => void;
  onTransferRequest?: (request: IncomingTransferRequest) => void;
  onFileComplete: (file: TransferFile) => void;
  onError: (msg: string) => void;
}

export class PeerService {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private callbacks: PeerServiceCallbacks;
  
  public roomId: string = '';
  public isHost: boolean = false;
  public connectionState: ConnectionState = 'disconnected';

  // Transfer confirmation state
  private pendingConfirmations: Map<string, { resolve: (accepted: boolean) => void }> = new Map();

  // Receiving state
  private incomingFiles: Map<string, {
    meta: { id: string; name: string; size: number; mimeType: string; totalChunks: number };
    chunks: ArrayBuffer[];
    receivedChunks: number;
    receivedBytes: number;
    startTime: number;
    lastCalcTime: number;
    lastCalcBytes: number;
    speed: number;
  }> = new Map();

  // Outgoing transfer state
  private isSending: boolean = false;
  private sendQueue: File[] = [];

  // Connection retry state for guests
  private connectRetryCount: number = 0;
  private connectRetryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(callbacks: PeerServiceCallbacks) {
    this.callbacks = callbacks;
  }

  public init(roomId: string, mode: 'host' | 'receive') {
    this.roomId = roomId.trim().toLowerCase();
    this.isHost = mode === 'host';
    this.connectRetryCount = 0;
    this.cleanup();

    this.setConnectionState(mode === 'host' ? 'waiting' : 'connecting');

    const peerId = this.isHost
      ? `padrop-${this.roomId}-host`
      : `padrop-${this.roomId}-guest-${Math.random().toString(36).substring(2, 7)}`;

    try {
      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        },
      });

      this.peer.on('open', () => {
        if (!this.isHost) {
          // Guest immediately attempts connection to host
          this.connectToHost();
        } else {
          this.setConnectionState('waiting');
        }
      });

      this.peer.on('connection', (conn) => {
        // Host accepts incoming connection
        if (this.connection) {
          try {
            this.connection.close();
          } catch {
            // ignore
          }
        }
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('PeerJS error:', err.type, err.message);
        if (err.type === 'peer-unavailable') {
          if (!this.isHost && this.connectRetryCount < 4) {
            this.connectRetryCount++;
            this.setConnectionState('connecting');
            if (this.connectRetryTimer) clearTimeout(this.connectRetryTimer);
            this.connectRetryTimer = setTimeout(() => {
              if (this.peer && !this.peer.destroyed && !this.connection?.open) {
                this.connectToHost();
              }
            }, this.connectRetryCount * 1000);
          } else {
            this.setConnectionState('waiting', 'Host not found. Ensure host has room open.');
          }
        } else if (err.type === 'unavailable-id') {
          this.setConnectionState('error', 'Room already in use or collision detected.');
        } else {
          this.setConnectionState('error', err.message);
        }
      });

      this.peer.on('disconnected', () => {
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.setConnectionState('error', errorMsg);
    }
  }

  private connectToHost() {
    if (!this.peer || this.peer.destroyed) return;
    const targetHostId = `padrop-${this.roomId}-host`;
    const conn = this.peer.connect(targetHostId, {
      reliable: true,
      serialization: 'binary',
    });
    this.setupConnection(conn);
  }

  private setupConnection(conn: DataConnection) {
    this.connection = conn;

    conn.on('open', () => {
      this.connectRetryCount = 0;
      if (this.connectRetryTimer) {
        clearTimeout(this.connectRetryTimer);
        this.connectRetryTimer = null;
      }
      this.setConnectionState('connected');
      // Send handshake ping
      this.sendRaw({ type: 'ping' });
    });

    conn.on('data', (data) => {
      this.handleIncomingData(data as PeerMessage);
    });

    conn.on('close', () => {
      this.connection = null;
      this.setConnectionState(this.isHost ? 'waiting' : 'disconnected');
    });

    conn.on('error', (err) => {
      console.error('DataConnection error:', err);
      this.callbacks.onError(err.message || 'Connection error');
    });
  }

  private setConnectionState(state: ConnectionState, errorMsg?: string) {
    this.connectionState = state;
    this.callbacks.onConnectionChange(state, errorMsg);
  }

  private sendRaw(msg: PeerMessage) {
    if (this.connection && this.connection.open) {
      try {
        this.connection.send(msg);
      } catch (err) {
        console.error('Error sending message:', err);
      }
    }
  }

  public sendText(text: string) {
    this.sendRaw({
      type: 'text-sync',
      text,
      timestamp: Date.now(),
    });
  }

  public sendChatMessage(text: string): ChatMessage | null {
    if (!this.connection || !this.connection.open || !text.trim()) return null;
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      sender: this.isHost ? 'host' : 'guest',
      senderRole: this.isHost ? 'Host' : 'Guest',
      text: text.trim(),
      timestamp: Date.now(),
    };
    this.sendRaw({
      type: 'chat-message',
      message: msg,
    });
    return msg;
  }

  public async sendFile(file: File) {
    this.sendQueue.push(file);
    if (!this.isSending) {
      this.processSendQueue();
    }
  }

  public acceptTransfer(fileId: string) {
    this.sendRaw({
      type: 'file-response',
      id: fileId,
      accepted: true,
    });
  }

  public declineTransfer(fileId: string) {
    this.sendRaw({
      type: 'file-response',
      id: fileId,
      accepted: false,
    });
  }

  private async processSendQueue() {
    if (this.sendQueue.length === 0 || !this.connection || !this.connection.open) {
      this.isSending = false;
      this.callbacks.onTransferProgress(null);
      return;
    }

    this.isSending = true;
    const file = this.sendQueue.shift()!;
    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 1. Send Transfer Request to Receiver for Confirmation
    this.sendRaw({
      type: 'file-request',
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    });

    const activeTransfer: ActiveTransfer = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      bytesTransferred: 0,
      progress: 0,
      speed: 0,
      direction: 'send',
      startTime: Date.now(),
      isPendingConfirmation: true,
    };

    this.callbacks.onTransferProgress(activeTransfer);

    // 2. Await Receiver's Acceptance or Decline
    const accepted = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingConfirmations.delete(fileId);
        resolve(false);
      }, 60000); // 60s timeout

      this.pendingConfirmations.set(fileId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
      });
    });

    if (!accepted) {
      this.callbacks.onError(`Transfer for "${file.name}" was declined by receiver.`);
      this.callbacks.onTransferProgress(null);
      this.isSending = false;
      await new Promise((r) => setTimeout(r, 100));
      this.processSendQueue();
      return;
    }

    // 3. Announce file start and begin streaming
    this.sendRaw({
      type: 'file-start',
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
    });

    const startTime = Date.now();
    let lastCalcTime = startTime;
    let lastCalcBytes = 0;
    let currentSpeed = 0;

    activeTransfer.isPendingConfirmation = false;
    activeTransfer.startTime = startTime;
    this.callbacks.onTransferProgress(activeTransfer);

    // Chunking stream
    const rawConn = this.connection as any;
    const rtcChannel: RTCDataChannel | undefined = rawConn?.dataChannel || rawConn?._dc || rawConn?._dataChannel;

    for (let i = 0; i < totalChunks; i++) {
      if (!this.connection || !this.connection.open) {
        this.callbacks.onError('Transfer aborted: connection closed');
        this.isSending = false;
        this.callbacks.onTransferProgress(null);
        return;
      }

      // Backpressure flow control
      if (rtcChannel && typeof rtcChannel.bufferedAmount === 'number' && rtcChannel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        await this.waitForBufferDrain(rtcChannel);
      }

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const slice = file.slice(start, end);
      const chunkBuffer = await slice.arrayBuffer();

      this.sendRaw({
        type: 'file-chunk',
        id: fileId,
        index: i,
        total: totalChunks,
        data: chunkBuffer,
      });

      const bytesTransferred = end;
      const now = Date.now();
      const elapsed = now - lastCalcTime;

      if (elapsed > 300 || i === totalChunks - 1) {
        const deltaBytes = bytesTransferred - lastCalcBytes;
        currentSpeed = elapsed > 0 ? (deltaBytes / elapsed) * 1000 : 0;
        lastCalcTime = now;
        lastCalcBytes = bytesTransferred;

        activeTransfer.bytesTransferred = bytesTransferred;
        activeTransfer.progress = Math.min(100, Math.round((bytesTransferred / file.size) * 100));
        activeTransfer.speed = currentSpeed;
        this.callbacks.onTransferProgress({ ...activeTransfer });
      }
    }

    // Announce file end
    this.sendRaw({
      type: 'file-end',
      id: fileId,
    });

    // Record completed file in sender list
    const completedFile: TransferFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      progress: 100,
      bytesTransferred: file.size,
      speed: currentSpeed,
      direction: 'send',
      status: 'completed',
      blob: file,
      blobUrl: URL.createObjectURL(file),
      timestamp: Date.now(),
    };

    this.callbacks.onFileComplete(completedFile);
    this.callbacks.onTransferProgress(null);

    // Process next queued file if any
    await new Promise((r) => setTimeout(r, 100));
    this.processSendQueue();
  }

  private waitForBufferDrain(dc: RTCDataChannel): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (dc.bufferedAmount <= MAX_BUFFERED_AMOUNT / 2) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 20);
    });
  }

  private handleIncomingData(msg: PeerMessage) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'ping':
        this.sendRaw({ type: 'pong' });
        break;

      case 'pong':
        break;

      case 'text-sync':
        this.callbacks.onTextSync(msg.text);
        break;

      case 'chat-message':
        this.callbacks.onChatMessage(msg.message);
        break;

      case 'file-start': {
        const fileState = {
          meta: {
            id: msg.id,
            name: msg.name,
            size: msg.size,
            mimeType: msg.mimeType,
            totalChunks: msg.totalChunks,
          },
          chunks: new Array<ArrayBuffer>(msg.totalChunks),
          receivedChunks: 0,
          receivedBytes: 0,
          startTime: Date.now(),
          lastCalcTime: Date.now(),
          lastCalcBytes: 0,
          speed: 0,
        };

        this.incomingFiles.set(msg.id, fileState);

        this.callbacks.onTransferProgress({
          fileId: msg.id,
          fileName: msg.name,
          fileSize: msg.size,
          bytesTransferred: 0,
          progress: 0,
          speed: 0,
          direction: 'receive',
          startTime: fileState.startTime,
        });
        break;
      }

      case 'file-chunk': {
        const fileState = this.incomingFiles.get(msg.id);
        if (!fileState) return;

        let bufferData: ArrayBuffer;
        if (msg.data instanceof ArrayBuffer) {
          bufferData = msg.data;
        } else if (msg.data && (msg.data as Uint8Array).buffer) {
          bufferData = (msg.data as Uint8Array).buffer as ArrayBuffer;
        } else {
          // fallback
          bufferData = new Uint8Array(msg.data as unknown as ArrayLike<number>).buffer;
        }

        fileState.chunks[msg.index] = bufferData;
        fileState.receivedChunks++;
        fileState.receivedBytes += bufferData.byteLength;

        const now = Date.now();
        const elapsed = now - fileState.lastCalcTime;

        if (elapsed > 300 || fileState.receivedChunks === fileState.meta.totalChunks) {
          const deltaBytes = fileState.receivedBytes - fileState.lastCalcBytes;
          fileState.speed = elapsed > 0 ? (deltaBytes / elapsed) * 1000 : 0;
          fileState.lastCalcTime = now;
          fileState.lastCalcBytes = fileState.receivedBytes;

          const progress = Math.min(
            100,
            Math.round((fileState.receivedBytes / fileState.meta.size) * 100)
          );

          this.callbacks.onTransferProgress({
            fileId: msg.id,
            fileName: fileState.meta.name,
            fileSize: fileState.meta.size,
            bytesTransferred: fileState.receivedBytes,
            progress,
            speed: fileState.speed,
            direction: 'receive',
            startTime: fileState.startTime,
          });
        }
        break;
      }

      case 'file-end': {
        const fileState = this.incomingFiles.get(msg.id);
        if (!fileState) return;

        const blob = new Blob(fileState.chunks, {
          type: fileState.meta.mimeType || 'application/octet-stream',
        });
        const blobUrl = URL.createObjectURL(blob);

        const completedFile: TransferFile = {
          id: fileState.meta.id,
          name: fileState.meta.name,
          size: fileState.meta.size,
          mimeType: fileState.meta.mimeType,
          progress: 100,
          bytesTransferred: fileState.meta.size,
          speed: fileState.speed,
          direction: 'receive',
          status: 'completed',
          blob,
          blobUrl,
          timestamp: Date.now(),
        };

        this.incomingFiles.delete(msg.id);
        this.callbacks.onFileComplete(completedFile);
        this.callbacks.onTransferProgress(null);

        // Send ACK
        this.sendRaw({ type: 'file-ack', id: msg.id });
        break;
      }

      case 'file-request':
        this.callbacks.onTransferRequest?.({
          id: msg.id,
          name: msg.name,
          size: msg.size,
          mimeType: msg.mimeType,
          timestamp: Date.now(),
        });
        break;

      case 'file-response': {
        const entry = this.pendingConfirmations.get(msg.id);
        if (entry) {
          this.pendingConfirmations.delete(msg.id);
          entry.resolve(msg.accepted);
        }
        break;
      }

      case 'file-ack':
        break;
    }
  }

  public disconnect() {
    if (this.connection) {
      try {
        this.connection.close();
      } catch {
        // ignore
      }
      this.connection = null;
    }
    this.setConnectionState(this.isHost ? 'waiting' : 'disconnected');
  }

  public cleanup() {
    if (this.connectRetryTimer) {
      clearTimeout(this.connectRetryTimer);
      this.connectRetryTimer = null;
    }
    this.connectRetryCount = 0;

    if (this.connection) {
      try {
        this.connection.close();
      } catch {
        // ignore
      }
      this.connection = null;
    }

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }

    this.incomingFiles.clear();
    this.sendQueue = [];
    this.isSending = false;
  }
}

