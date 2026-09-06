// Cloudflare Pages Function: POST /api/discovery/tombstone
import { edgeRegistry } from './_store';

export async function onRequestPost(context: { request: Request }): Promise<Response> {
  try {
    const data = (await context.request.json()) as any;
    if (data && data.roomId) {
      edgeRegistry.delete(String(data.roomId).trim().toLowerCase());
    }
  } catch {
    // ignore
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
