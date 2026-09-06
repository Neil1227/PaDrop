export type ConnectionState = 'disconnected' | 'waiting' | 'connecting' | 'connected' | 'error';

export interface TextSyncMessage {
  type: 'text-sync';
  text: string;
  timestamp: number;
}

export interface FileStartMessage {
  type: 'file-start';
  id: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
}

export interface FileChunkMessage {
  type: 'file-chunk';
  id: string;
  index: number;
  total: number;
  // ArrayBuffer or base64 or ArrayBufferView
  data: ArrayBuffer | Uint8Array | string;
}

export interface FileEndMessage {
  type: 'file-end';
  id: string;
}

export interface FileAckMessage {
  type: 'file-ack';
  id: string;
}

export interface FileRequestMessage {
  type: 'file-request';
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface FileResponseMessage {
  type: 'file-response';
  id: string;
  accepted: boolean;
}

export interface ConnectionRequestMessage {
  type: 'connection-request';
  senderId: string;
  senderName: string;
  senderDeviceType: DeviceType;
  timestamp: number;
}

export interface ConnectionResponseMessage {
  type: 'connection-response';
  accepted: boolean;
  reason?: string;
}

export interface PingMessage {
  type: 'ping';
}

export interface PongMessage {
  type: 'pong';
}

export interface ChatMessage {
  id: string;
  sender: 'host' | 'guest';
  senderRole: string;
  text: string;
  timestamp: number;
}

export interface ChatSyncMessage {
  type: 'chat-message';
  message: ChatMessage;
}

export type PeerMessage =
  | TextSyncMessage
  | FileStartMessage
  | FileChunkMessage
  | FileEndMessage
  | FileAckMessage
  | FileRequestMessage
  | FileResponseMessage
  | ConnectionRequestMessage
  | ConnectionResponseMessage
  | PingMessage
  | PongMessage
  | ChatSyncMessage;

export interface IncomingConnectionRequest {
  senderId: string;
  senderName: string;
  senderDeviceType: DeviceType;
  roomId: string;
  timestamp: number;
}

export interface IncomingTransferRequest {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  timestamp: number;
}

export interface TransferFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  progress: number; // 0 to 100
  bytesTransferred: number;
  speed: number; // bytes per second
  direction: 'send' | 'receive';
  status: 'transferring' | 'completed' | 'error';
  blob?: Blob;
  blobUrl?: string;
  timestamp: number;
  errorMessage?: string;
}

export interface ActiveTransfer {
  fileId: string;
  fileName: string;
  fileSize: number;
  bytesTransferred: number;
  progress: number;
  speed: number; // bytes/sec
  direction: 'send' | 'receive';
  startTime: number;
  isPendingConfirmation?: boolean;
}

export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export type RoomStatus = 'available' | 'busy' | 'connected';

export interface DiscoveredRoom {
  roomId: string;
  displayName: string;
  deviceType: DeviceType;
  status: RoomStatus;
  timestamp: number;
  isDiscoverable: boolean;
  lanIp?: string;
  userCount?: number;
}

export type DiscoveryScanState = 'idle' | 'scanning' | 'discovered' | 'empty' | 'error';

export interface DiscoveryAnnouncement {
  type: 'discovery-announce';
  roomId: string;
  displayName: string;
  deviceType: DeviceType;
  status: RoomStatus;
  timestamp: number;
  isDiscoverable: boolean;
  lanIp?: string;
}

export interface DiscoveryQuery {
  type: 'discovery-query';
  scannerId: string;
  timestamp: number;
}

export interface DiscoveryTombstone {
  type: 'discovery-tombstone';
  roomId: string;
  timestamp: number;
}

export type DiscoveryMessage = DiscoveryAnnouncement | DiscoveryQuery | DiscoveryTombstone;

declare global {
  const __LOCAL_LAN_IP__: string;
}

