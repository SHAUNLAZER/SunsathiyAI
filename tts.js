const BASE = process.env.GNANI_BASE_URL || "https://api.vachana.ai";
const MODEL = process.env.GNANI_TTS_MODEL || "timbre-v3.0";
const VOICE = process.env.GNANI_TTS_VOICE || "Shivani";
const LANG = { hi: "hi-IN", en: "en-IN", bn: "bn-IN", te: "te-IN" };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const KEY = process.env.GNANI_API_KEY;
  if (!KEY) {
    return res.status(500).json({ error: "GNANI_API_KEY is not set in Vercel Environment Variables" });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    } else if (Buffer.isBuffer(body)) {
      try { body = JSON.parse(body.toString("utf8")); } catch {}
    }

    const { text, language } = body || {};
    const t = String(text ?? "").trim();
    if (!t || t.length > 400 || !LANG[language]) {
      return res.status(400).json({ error: "Invalid text or language" });
    }

    const up = await fetch(`${BASE}/api/v1/tts/inference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key-ID": KEY },
      body: JSON.stringify({
        text: t,
        voice: process.env.GNANI_TTS_VOICE || VOICE,
        model: process.env.GNANI_TTS_MODEL || MODEL,
        language: LANG[language],
        speed: 0.9,
        audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "wav" },
      }),
    });

    if (!up.ok) {
      let msg = `Gnani API error (${up.status})`;
      try { const j = await up.json(); msg = j?.error?.message || j?.message || msg; } catch {}
      return res.status(up.status >= 400 && up.status < 600 ? up.status : 502).json({ error: msg });
    }

    const audioBuf = Buffer.from(await up.arrayBuffer());
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audioBuf);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
}
