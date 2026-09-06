// Cloudflare Pages Function: POST /api/discovery/announce

export async function onRequestPost(context: { request: Request }): Promise<Response> {
  try {
    const data = (await context.request.json()) as any;
    if (!data || !data.roomId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing roomId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
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
