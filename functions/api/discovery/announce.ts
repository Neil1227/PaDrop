// Cloudflare Pages Function: POST /api/discovery/announce
import { edgeRegistry, cleanStaleRooms } from './_store';

export async function onRequestPost(context: { request: Request }): Promise<Response> {
  try {
    const data = (await context.request.json()) as any;
    if (!data || !data.roomId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing roomId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    cleanStaleRooms();

    const rId = String(data.roomId).trim().toLowerCase();
    if (data.isDiscoverable !== false) {
      edgeRegistry.set(rId, {
        roomId: rId,
        displayName: data.displayName || `Host ${rId}`,
        deviceType: data.deviceType || 'desktop',
        status: data.status || 'available',
        timestamp: Date.now(),
        isDiscoverable: true,
        lanIp: data.lanIp,
      });
    } else {
      edgeRegistry.delete(rId);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
