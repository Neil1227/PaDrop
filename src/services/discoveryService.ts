import type { DiscoveredRoom, DeviceType, RoomStatus, DiscoveryMessage, DiscoveryAnnouncement } from '../types';

const DISCOVERY_CHANNEL_NAME = 'padrop_discovery_channel_v1';
const STORAGE_REGISTRY_KEY = 'padrop_active_hosts_registry';
const HEARTBEAT_INTERVAL_MS = 4000;
const ROOM_EXPIRY_THRESHOLD_MS = 15000;

export function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

export function getDeviceDisplayName(): string {
  if (typeof window === 'undefined') return 'PaDrop Device';
  
  const saved = localStorage.getItem('padrop_device_name');
  if (saved && saved.trim()) return saved.trim();

  const ua = navigator.userAgent;
  let os = 'Device';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android Device';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac';
  else if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/Linux/i.test(ua)) os = 'Linux PC';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  return `${os} (${browser})`;
}

export interface BroadcastHostOptions {
  roomId: string;
  displayName?: string;
  isDiscoverable?: boolean;
  lanIp?: string;
  status?: RoomStatus;
}

class DiscoveryService {
  private broadcastChannel: BroadcastChannel | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private currentHostState: BroadcastHostOptions | null = null;
  private discoveredRooms: Map<string, DiscoveredRoom> = new Map();
  private subscribers: Set<(rooms: DiscoveredRoom[]) => void> = new Set();

  constructor() {
    this.initChannel();
  }

  private initChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;

    try {
      this.broadcastChannel = new BroadcastChannel(DISCOVERY_CHANNEL_NAME);
      this.broadcastChannel.onmessage = (event: MessageEvent<DiscoveryMessage>) => {
        this.handleIncomingMessage(event.data);
      };
    } catch (err) {
      console.warn('DiscoveryService: BroadcastChannel not supported', err);
    }

    // Also listen to storage events for cross-tab synchronization fallback
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_REGISTRY_KEY && e.newValue) {
          try {
            const registry: Record<string, DiscoveredRoom> = JSON.parse(e.newValue);
            this.syncFromRegistry(registry);
          } catch {
            // ignore
          }
        }
      });
    }
  }

  private syncFromRegistry(registry: Record<string, DiscoveredRoom>) {
    const now = Date.now();
    let updated = false;

    for (const [rId, room] of Object.entries(registry)) {
      if (now - room.timestamp < ROOM_EXPIRY_THRESHOLD_MS && room.isDiscoverable) {
        this.discoveredRooms.set(rId.toLowerCase(), room);
        updated = true;
      } else {
        if (this.discoveredRooms.delete(rId.toLowerCase())) {
          updated = true;
        }
      }
    }

    if (updated) {
      this.notifySubscribers();
    }
  }

  private handleIncomingMessage(msg: DiscoveryMessage) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'discovery-announce': {
        if (!msg.isDiscoverable) {
          if (this.discoveredRooms.delete(msg.roomId.toLowerCase())) {
            this.notifySubscribers();
          }
          return;
        }

        const room: DiscoveredRoom = {
          roomId: msg.roomId.toLowerCase(),
          displayName: msg.displayName || `Host ${msg.roomId}`,
          deviceType: msg.deviceType,
          status: msg.status,
          timestamp: msg.timestamp || Date.now(),
          isDiscoverable: msg.isDiscoverable,
          lanIp: msg.lanIp,
        };

        this.discoveredRooms.set(msg.roomId.toLowerCase(), room);
        this.notifySubscribers();
        break;
      }

      case 'discovery-query': {
        if (this.currentHostState && this.currentHostState.isDiscoverable) {
          this.broadcastAnnouncement();
        }
        break;
      }

      case 'discovery-tombstone': {
        if (this.discoveredRooms.delete(msg.roomId.toLowerCase())) {
          this.notifySubscribers();
        }
        this.removeFromStorageRegistry(msg.roomId);
        break;
      }
    }
  }

  private async broadcastAnnouncement() {
    if (!this.currentHostState || !this.currentHostState.isDiscoverable) return;

    const announcement: DiscoveryAnnouncement = {
      type: 'discovery-announce',
      roomId: this.currentHostState.roomId.toLowerCase(),
      displayName: this.currentHostState.displayName || getDeviceDisplayName(),
      deviceType: getDeviceType(),
      status: this.currentHostState.status || 'available',
      timestamp: Date.now(),
      isDiscoverable: !!this.currentHostState.isDiscoverable,
      lanIp: this.currentHostState.lanIp,
    };

    // 1. Send via local BroadcastChannel
    try {
      this.broadcastChannel?.postMessage(announcement);
    } catch {
      // ignore
    }

    // 2. Persist to shared localStorage registry
    this.updateStorageRegistry({
      roomId: announcement.roomId,
      displayName: announcement.displayName,
      deviceType: announcement.deviceType,
      status: announcement.status,
      timestamp: announcement.timestamp,
      isDiscoverable: announcement.isDiscoverable,
      lanIp: announcement.lanIp,
    });

    // 3. Network Discovery Announce via HTTP endpoint (LAN / Wi-Fi IP)
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/discovery/announce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(announcement),
        });
      } catch {
        // Network offline or static host without backend
      }
    }
  }

  private updateStorageRegistry(room: DiscoveredRoom) {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_REGISTRY_KEY);
      const registry: Record<string, DiscoveredRoom> = raw ? JSON.parse(raw) : {};
      
      const now = Date.now();
      for (const [key, val] of Object.entries(registry)) {
        if (now - val.timestamp > ROOM_EXPIRY_THRESHOLD_MS) {
          delete registry[key];
        }
      }

      registry[room.roomId.toLowerCase()] = room;
      localStorage.setItem(STORAGE_REGISTRY_KEY, JSON.stringify(registry));
    } catch {
      // Storage access may be restricted
    }
  }

  private removeFromStorageRegistry(roomId: string) {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_REGISTRY_KEY);
      if (!raw) return;
      const registry: Record<string, DiscoveredRoom> = JSON.parse(raw);
      if (registry[roomId.toLowerCase()]) {
        delete registry[roomId.toLowerCase()];
        localStorage.setItem(STORAGE_REGISTRY_KEY, JSON.stringify(registry));
      }
    } catch {
      // ignore
    }
  }

  public startHostBroadcast(options: BroadcastHostOptions): () => void {
    this.stopHostBroadcast();

    this.currentHostState = {
      displayName: getDeviceDisplayName(),
      isDiscoverable: true,
      status: 'available',
      ...options,
    };

    // Immediate announcement
    this.broadcastAnnouncement();

    // Periodic heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.broadcastAnnouncement();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      this.stopHostBroadcast();
    };
  }

  public updateHostDiscoverable(isDiscoverable: boolean) {
    if (!this.currentHostState) return;
    this.currentHostState.isDiscoverable = isDiscoverable;

    if (!isDiscoverable) {
      this.sendTombstone(this.currentHostState.roomId);
    } else {
      this.broadcastAnnouncement();
    }
  }

  public updateHostStatus(status: RoomStatus) {
    if (!this.currentHostState) return;
    this.currentHostState.status = status;
    this.broadcastAnnouncement();
  }

  private sendTombstone(roomId: string) {
    const cleaned = roomId.toLowerCase();
    try {
      this.broadcastChannel?.postMessage({
        type: 'discovery-tombstone',
        roomId: cleaned,
        timestamp: Date.now(),
      });
    } catch {
      // ignore
    }

    this.removeFromStorageRegistry(cleaned);

    if (typeof window !== 'undefined') {
      try {
        fetch('/api/discovery/tombstone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: cleaned }),
        }).catch(() => {});
      } catch {
        // ignore
      }
    }
  }

  public stopHostBroadcast() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.currentHostState) {
      this.sendTombstone(this.currentHostState.roomId);
      this.currentHostState = null;
    }
  }

  public async scanForNearbyRooms(
    excludeRoomId?: string,
    timeoutMs: number = 1800
  ): Promise<DiscoveredRoom[]> {
    const normalizedExclude = excludeRoomId?.toLowerCase();

    // 1. Fetch from LAN / Server Discovery API
    const fetchServerRooms = async () => {
      if (typeof window === 'undefined') return;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 1400));
        
        const res = await fetch('/api/discovery/rooms', {
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' },
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.rooms)) {
            for (const r of data.rooms) {
              if (r && r.roomId && r.isDiscoverable) {
                this.discoveredRooms.set(r.roomId.toLowerCase(), {
                  ...r,
                  roomId: r.roomId.toLowerCase(),
                });
              }
            }
          }
        }
      } catch {
        // Network endpoint not reachable or timed out (offline fallback)
      }
    };

    // 2. Query BroadcastChannel & Local Storage
    const queryLocalSources = () => {
      try {
        const queryMsg: DiscoveryMessage = {
          type: 'discovery-query',
          scannerId: `scan-${Math.random().toString(36).substring(2, 8)}`,
          timestamp: Date.now(),
        };
        this.broadcastChannel?.postMessage(queryMsg);
      } catch {
        // ignore
      }

      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(STORAGE_REGISTRY_KEY);
          if (raw) {
            const registry: Record<string, DiscoveredRoom> = JSON.parse(raw);
            this.syncFromRegistry(registry);
          }
        } catch {
          // ignore
        }
      }
    };

    // Execute server fetch and local queries concurrently
    queryLocalSources();
    await fetchServerRooms();

    return new Promise((resolve) => {
      setTimeout(() => {
        const now = Date.now();
        const activeRooms: DiscoveredRoom[] = [];

        for (const [rId, room] of this.discoveredRooms.entries()) {
          const isFresh = now - room.timestamp < ROOM_EXPIRY_THRESHOLD_MS;
          const isNotSelf = !normalizedExclude || rId !== normalizedExclude;
          const isDiscoverable = room.isDiscoverable;

          if (isFresh && isNotSelf && isDiscoverable) {
            activeRooms.push(room);
          } else if (!isFresh) {
            this.discoveredRooms.delete(rId);
          }
        }

        resolve(activeRooms);
      }, timeoutMs);
    });
  }

  public subscribe(callback: (rooms: DiscoveredRoom[]) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers() {
    const list = Array.from(this.discoveredRooms.values()).filter(
      (r) => Date.now() - r.timestamp < ROOM_EXPIRY_THRESHOLD_MS && r.isDiscoverable
    );
    this.subscribers.forEach((cb) => {
      try {
        cb(list);
      } catch (err) {
        console.error('Discovery subscriber error:', err);
      }
    });
  }
}

export const discoveryService = new DiscoveryService();
