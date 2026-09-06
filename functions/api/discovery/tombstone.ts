// Cloudflare Pages Function: POST /api/discovery/tombstone

export async function onRequestPost(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
