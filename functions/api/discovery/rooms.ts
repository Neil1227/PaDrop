// Cloudflare Pages Function: GET /api/discovery/rooms
import { edgeRegistry, cleanStaleRooms } from './_store';

export async function onRequestGet(): Promise<Response> {
  cleanStaleRooms();
  const list = Array.from(edgeRegistry.values()).filter((r) => r.isDiscoverable);

  return new Response(JSON.stringify({ ok: true, rooms: list }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
