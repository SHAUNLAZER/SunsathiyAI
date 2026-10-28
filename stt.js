export const config = {
  api: {
    bodyParser: false,
  },
};

const LANG = { hi: "hi-IN", en: "en-IN", bn: "bn-IN", te: "te-IN" };
const BASE = process.env.GNANI_BASE_URL || "https://api.vachana.ai";

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

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
    const raw = await readBody(req);
    const form = await new Response(raw, {
      headers: { "content-type": req.headers["content-type"] || "" },
    }).formData();

    const file = form.get("file");
    const lang = LANG[String(form.get("language"))];
    if (!(file instanceof Blob) || !file.size || !lang) {
      return res.status(400).json({ error: "Missing audio or language" });
    }

    const fd = new FormData();
    fd.append("audio_file", file, "recording.wav");
    fd.append("language_code", lang);
    fd.append("format", "verbatim");

    const up = await fetch(`${BASE}/stt/v3`, {
      method: "POST",
      headers: { "X-API-Key-ID": KEY },
      body: fd,
    });

    if (!up.ok) {
      let msg = `Gnani API error (${up.status})`;
      try { const j = await up.json(); msg = j?.error?.message || j?.message || msg; } catch {}
      return res.status(up.status >= 400 && up.status < 600 ? up.status : 502).json({ error: msg });
    }

    const j = await up.json();
    return res.status(200).json({ transcript: j.transcript ?? "" });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
}
