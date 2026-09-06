// Cloudflare Pages Function: GET /api/discovery/rooms
export interface Env {
  // KV or in-memory fallback
}

// In-memory registry fallback for edge workers
interface DiscoveredRoomEdge {
  roomId: string;
  displayName: string;
  deviceType: string;
  status: string;
  timestamp: number;
  isDiscoverable: boolean;
  lanIp?: string;
}

const globalRegistry = new Map<string, DiscoveredRoomEdge>();
const TTL = 15000;

export async function onRequestGet(): Promise<Response> {
  const now = Date.now();
  for (const [k, v] of globalRegistry.entries()) {
    if (now - v.timestamp > TTL) {
      globalRegistry.delete(k);
    }
  }

  const list = Array.from(globalRegistry.values()).filter((r) => r.isDiscoverable);

  return new Response(JSON.stringify({ ok: true, rooms: list }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    },
  });
}
