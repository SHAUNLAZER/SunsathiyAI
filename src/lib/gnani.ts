// Shared helpers for the Gnani (Vachana) voice API proxy. Server-only.
export const LANG: Record<string, string> = { hi: "hi-IN", en: "en-IN", bn: "bn-IN", te: "te-IN" };

export function gnaniConfig() {
  return {
    key: process.env["GNANI_API_KEY"],
    base: process.env["GNANI_BASE_URL"] || "https://api.vachana.ai",
    model: process.env["GNANI_TTS_MODEL"] || "timbre-v3.0",
    voice: process.env["GNANI_TTS_VOICE"] || "Shivani",
  };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function upstreamError(up: Response) {
  let msg = `Gnani API error (${up.status})`;
  try {
    const j = (await up.json()) as { error?: { message?: string }; message?: string };
    msg = j?.error?.message || j?.message || msg;
  } catch {
    /* ignore */
  }
  return json({ error: msg }, up.status >= 400 && up.status < 600 ? up.status : 502);
}

export const missingKey = () =>
  json({ error: "GNANI_API_KEY is not configured", keyMissing: true }, 503);
