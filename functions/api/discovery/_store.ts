// Shared Edge Discovery Store for Cloudflare Pages Functions
export interface DiscoveredRoomEdge {
  roomId: string;
  displayName: string;
  deviceType: string;
  status: string;
  timestamp: number;
  isDiscoverable: boolean;
  lanIp?: string;
}

export const edgeRegistry = new Map<string, DiscoveredRoomEdge>();
export const DISCOVERY_TTL_MS = 15000;

export function cleanStaleRooms(): void {
  const now = Date.now();
  for (const [key, val] of edgeRegistry.entries()) {
    if (now - val.timestamp > DISCOVERY_TTL_MS) {
      edgeRegistry.delete(key);
    }
  }
}
