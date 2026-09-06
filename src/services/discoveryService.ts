import mqtt, { type MqttClient } from 'mqtt';
import type { DiscoveredRoom, DeviceType, RoomStatus, DiscoveryMessage, DiscoveryAnnouncement } from '../types';

const DISCOVERY_CHANNEL_NAME = 'padrop_discovery_channel_v1';
const STORAGE_REGISTRY_KEY = 'padrop_active_hosts_registry';
const HEARTBEAT_INTERVAL_MS = 3000;
const ROOM_EXPIRY_THRESHOLD_MS = 12000;

// Public high-speed WebSocket MQTT brokers for cross-network WebRTC presence
const MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

let cachedNetworkHash: string | null = null;
let networkHashPromise: Promise<string> | null = null;

// FNV-1a fast 32-bit hash algorithm to produce clean 8-character hex string
function fnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Automatically discovers the local Wi-Fi / public network signature using native WebRTC STUN.
 * Devices connected to the same Wi-Fi router share the exact same public reflexive IP,
 * producing identical network hashes so Nearby Share Radar isolates discovery exclusively
 * to devices in the same home, office, or local area.
 */
export async function getNetworkHash(): Promise<string> {
  if (cachedNetworkHash) return cachedNetworkHash;
  if (networkHashPromise) return networkHashPromise;

  networkHashPromise = (async () => {
    if (typeof window === 'undefined') return 'local-default';

    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      cachedNetworkHash = 'local-dev';
      return cachedNetworkHash;
    }

    // 1. Native WebRTC STUN candidate harvesting (Zero 3rd-party API dependency)
    try {
      const stunIp = await new Promise<string | null>((resolve) => {
        let isResolved = false;
        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            resolve(null);
            try { pc.close(); } catch {}
          }
        }, 1200);

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        pc.onicecandidate = (event) => {
          if (!event || !event.candidate || isResolved) return;
          const candidateStr = event.candidate.candidate;
          // Match standard srflx candidate: typ srflx
          if (candidateStr.includes('srflx')) {
            const parts = candidateStr.split(' ');
            if (parts.length > 4 && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(parts[4])) {
              isResolved = true;
              clearTimeout(timeout);
              resolve(parts[4]);
              try { pc.close(); } catch {}
            }
          }
        };

        pc.createDataChannel('ping');
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .catch(() => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              resolve(null);
            }
          });
      });

      if (stunIp) {
        cachedNetworkHash = `net-${fnv1a(stunIp)}`;
        return cachedNetworkHash;
      }
    } catch {
      // STUN fallback
    }

    // 2. Fast Fallback: IP lookup API
    try {
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 1200);
      const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(fetchTimer);
      const data = await res.json();
      if (data && data.ip) {
        cachedNetworkHash = `net-${fnv1a(data.ip)}`;
        return cachedNetworkHash;
      }
    } catch {
      // Fallback
    }

    // 3. Fallback to origin hash
    cachedNetworkHash = `net-${fnv1a(window.location.origin)}`;
    return cachedNetworkHash;
  })();

  return networkHashPromise;
}

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
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private currentHostState: BroadcastHostOptions | null = null;
  private discoveredRooms: Map<string, DiscoveredRoom> = new Map();
  private subscribers: Set<(rooms: DiscoveredRoom[]) => void> = new Set();
  
  // MQTT Mesh State (Scoped by Local Wi-Fi Network Fingerprint)
  private mqttClient: MqttClient | null = null;
  private isMqttConnected: boolean = false;
  private currentBrokerIndex: number = 0;
  private isMqttConnecting: boolean = false;
  private currentNetworkHash: string = 'local-dev';
  private currentMqttTopic: string = 'padrop/v1/radar/local-dev';

  public getNetworkSignature(): string {
    return this.currentNetworkHash;
  }

  constructor() {
    this.initChannel();
    this.initMqtt();
    this.startAutoPruner();
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

    // Cross-tab storage fallback
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

  private async initMqtt() {
    if (typeof window === 'undefined' || this.isMqttConnecting || (this.mqttClient && this.isMqttConnected)) {
      return;
    }

    this.isMqttConnecting = true;

    // Dynamically resolve same Wi-Fi network hash
    const netHash = await getNetworkHash();
    this.currentNetworkHash = netHash;
    this.currentMqttTopic = `padrop/v1/radar/${netHash}`;

    const brokerUrl = MQTT_BROKERS[this.currentBrokerIndex % MQTT_BROKERS.length];
    const clientId = `padrop-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const mqttModule = mqtt as any;
      const connectFn = typeof mqttModule?.connect === 'function'
        ? mqttModule.connect
        : typeof mqttModule?.default?.connect === 'function'
        ? mqttModule.default.connect
        : typeof mqttModule?.default === 'function'
        ? mqttModule.default
        : null;

      if (!connectFn) {
        this.isMqttConnecting = false;
        return;
      }

      const client = connectFn(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 4000,
        keepalive: 30,
      });

      this.mqttClient = client;

      client.on('connect', () => {
        this.isMqttConnected = true;
        this.isMqttConnecting = false;

        client.subscribe(this.currentMqttTopic, { qos: 0 }, (err: Error | null) => {
          if (err) {
            console.warn('MQTT subscribe error:', err);
          } else {
            // If we are currently a discoverable host, announce right away
            if (this.currentHostState && this.currentHostState.isDiscoverable) {
              this.publishMqttAnnouncement();
            }
          }
        });
      });

      client.on('message', (_topic: string, message: Buffer | string) => {
        try {
          const parsed = JSON.parse(message.toString());
          this.handleIncomingMessage(parsed);
        } catch {
          // ignore corrupted payload
        }
      });

      client.on('error', (err: Error) => {
        console.warn('MQTT connection warning:', err?.message || err);
      });

      client.on('close', () => {
        this.isMqttConnected = false;
      });

      client.on('offline', () => {
        this.isMqttConnected = false;
        // Try fallback broker on subsequent reconnection if persistent
        this.currentBrokerIndex++;
      });
    } catch (err) {
      this.isMqttConnecting = false;
      console.warn('Failed to initialize MQTT presence mesh:', err);
    }
  }

  private startAutoPruner() {
    if (this.pruneTimer) return;
    this.pruneTimer = setInterval(() => {
      const now = Date.now();
      let hasChanges = false;
      for (const [rId, room] of this.discoveredRooms.entries()) {
        if (now - room.timestamp > ROOM_EXPIRY_THRESHOLD_MS) {
          this.discoveredRooms.delete(rId);
          hasChanges = true;
        }
      }
      if (hasChanges) {
        this.notifySubscribers();
      }
    }, 3000);
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
        const cleanedRoomId = msg.roomId?.toLowerCase()?.trim();
        if (!cleanedRoomId) return;

        if (!msg.isDiscoverable) {
          if (this.discoveredRooms.delete(cleanedRoomId)) {
            this.notifySubscribers();
          }
          return;
        }

        const room: DiscoveredRoom = {
          roomId: cleanedRoomId,
          displayName: msg.displayName || `Host ${cleanedRoomId}`,
          deviceType: msg.deviceType || 'desktop',
          status: msg.status || 'available',
          timestamp: msg.timestamp || Date.now(),
          isDiscoverable: true,
          lanIp: msg.lanIp,
        };

        this.discoveredRooms.set(cleanedRoomId, room);
        this.notifySubscribers();
        break;
      }

      case 'discovery-query': {
        // If we are currently a discoverable host, respond with an announcement
        if (this.currentHostState && this.currentHostState.isDiscoverable) {
          this.broadcastAnnouncement();
        }
        break;
      }

      case 'discovery-tombstone': {
        const cleanedRoomId = msg.roomId?.toLowerCase()?.trim();
        if (cleanedRoomId) {
          if (this.discoveredRooms.delete(cleanedRoomId)) {
            this.notifySubscribers();
          }
          this.removeFromStorageRegistry(cleanedRoomId);
        }
        break;
      }
    }
  }

  private publishMqttAnnouncement() {
    if (!this.mqttClient || !this.isMqttConnected || !this.currentHostState || !this.currentHostState.isDiscoverable) {
      return;
    }

    const payload: DiscoveryAnnouncement = {
      type: 'discovery-announce',
      roomId: this.currentHostState.roomId.toLowerCase(),
      displayName: this.currentHostState.displayName || getDeviceDisplayName(),
      deviceType: getDeviceType(),
      status: this.currentHostState.status || 'available',
      timestamp: Date.now(),
      isDiscoverable: true,
      lanIp: this.currentHostState.lanIp,
    };

    try {
      this.mqttClient.publish(this.currentMqttTopic, JSON.stringify(payload), { qos: 0 });
    } catch {
      // ignore
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
      isDiscoverable: true,
      lanIp: this.currentHostState.lanIp,
    };

    // 1. Send via Global Realtime MQTT WebSocket Mesh
    this.publishMqttAnnouncement();

    // 2. Send via local BroadcastChannel (cross-tab)
    try {
      this.broadcastChannel?.postMessage(announcement);
    } catch {
      // ignore
    }

    // 3. Persist to shared localStorage registry
    this.updateStorageRegistry({
      roomId: announcement.roomId,
      displayName: announcement.displayName,
      deviceType: announcement.deviceType,
      status: announcement.status,
      timestamp: announcement.timestamp,
      isDiscoverable: announcement.isDiscoverable,
      lanIp: announcement.lanIp,
    });

    // 4. Network Discovery Announce via HTTP endpoint (LAN / Dev Server / Cloudflare Functions)
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/discovery/announce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(announcement),
        });
      } catch {
        // Network offline or static host
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
      // ignore
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

    // Make sure MQTT is connected
    this.initMqtt();

    // Immediate announcement
    this.broadcastAnnouncement();

    // Periodic heartbeat to keep presence fresh across all channels
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
    const cleaned = roomId.toLowerCase().trim();
    if (!cleaned) return;

    // 1. MQTT Tombstone
    if (this.mqttClient && this.isMqttConnected) {
      try {
        this.mqttClient.publish(
          this.currentMqttTopic,
          JSON.stringify({ type: 'discovery-tombstone', roomId: cleaned, timestamp: Date.now() }),
          { qos: 0 }
        );
      } catch {
        // ignore
      }
    }

    // 2. BroadcastChannel Tombstone
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

    // 3. HTTP Tombstone
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

  public queryPeers() {
    const queryMsg: DiscoveryMessage = {
      type: 'discovery-query',
      scannerId: `scan-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
    };

    // Send query via MQTT mesh
    if (this.mqttClient && this.isMqttConnected) {
      try {
        this.mqttClient.publish(this.currentMqttTopic, JSON.stringify(queryMsg), { qos: 0 });
      } catch {
        // ignore
      }
    } else {
      this.initMqtt();
    }

    // Send query via BroadcastChannel
    try {
      this.broadcastChannel?.postMessage(queryMsg);
    } catch {
      // ignore
    }

    // Check storage registry
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
  }

  public async scanForNearbyRooms(
    excludeRoomId?: string,
    timeoutMs: number = 1500
  ): Promise<DiscoveredRoom[]> {
    const normalizedExclude = excludeRoomId?.toLowerCase()?.trim();

    // 1. Ensure MQTT presence mesh is active and query peers
    this.initMqtt();
    this.queryPeers();

    // 2. Fetch from LAN / Server Discovery API concurrently
    const fetchServerRooms = async () => {
      if (typeof window === 'undefined') return;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 1200));
        
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
        // Network endpoint fallback
      }
    };

    await fetchServerRooms();

    return new Promise((resolve) => {
      setTimeout(() => {
        const now = Date.now();
        const activeRooms: DiscoveredRoom[] = [];

        for (const [rId, room] of this.discoveredRooms.entries()) {
          const isFresh = now - room.timestamp < ROOM_EXPIRY_THRESHOLD_MS;
          const isNotSelf = !normalizedExclude || rId !== normalizedExclude;
          const isAvailable = room.isDiscoverable && room.status !== 'busy' && room.status !== 'connected';

          if (isFresh && isNotSelf && isAvailable) {
            activeRooms.push(room);
          } else if (!isFresh || !isAvailable) {
            this.discoveredRooms.delete(rId);
          }
        }

        resolve(activeRooms);
      }, timeoutMs);
    });
  }

  public getDiscoveredRooms(excludeRoomId?: string): DiscoveredRoom[] {
    const now = Date.now();
    const normalizedExclude = excludeRoomId?.toLowerCase()?.trim();
    const activeRooms: DiscoveredRoom[] = [];

    for (const [rId, room] of this.discoveredRooms.entries()) {
      const isFresh = now - room.timestamp < ROOM_EXPIRY_THRESHOLD_MS;
      const isNotSelf = !normalizedExclude || rId !== normalizedExclude;
      const isAvailable = room.isDiscoverable && room.status !== 'busy' && room.status !== 'connected';
      if (isFresh && isNotSelf && isAvailable) {
        activeRooms.push(room);
      }
    }
    return activeRooms;
  }

  public subscribe(callback: (rooms: DiscoveredRoom[]) => void): () => void {
    this.subscribers.add(callback);
    // Immediately emit current known active rooms
    try {
      callback(this.getDiscoveredRooms());
    } catch {
      // ignore
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers() {
    const list = this.getDiscoveredRooms();
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
