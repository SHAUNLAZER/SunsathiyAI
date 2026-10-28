// SunSathiyAI local server: serves the page and proxies /api/stt + /api/tts to Gnani (Vachana).
// The API key stays here (server side) and is never sent to the browser.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
try {
  for (const l of fs.readFileSync(path.join(dir, ".env"), "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const KEY = process.env.GNANI_API_KEY;
const BASE = process.env.GNANI_BASE_URL || "https://api.vachana.ai";
const MODEL = process.env.GNANI_TTS_MODEL || "timbre-v3.0";
const VOICE = process.env.GNANI_TTS_VOICE || "Shivani";
const PORT = Number(process.env.PORT) || 3000;
const LANG = { hi: "hi-IN", en: "en-IN", bn: "bn-IN", te: "te-IN" };

const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};
const fail = async (res, up) => {
  let msg = `Gnani API error (${up.status})`;
  try { const j = await up.json(); msg = j?.error?.message || j?.message || msg; } catch {}
  send(res, up.status >= 400 && up.status < 600 ? up.status : 502, { error: msg });
};
const readBody = (req) => new Promise((ok, no) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); req.on("error", no); });

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html"))
      return send(res, 200, fs.readFileSync(path.join(dir, "sunsathiyai.html")), "text/html; charset=utf-8");
    if (req.method !== "POST" || !url.pathname.startsWith("/api/")) return send(res, 404, { error: "Not found" });
    if (!KEY) return send(res, 500, { error: "GNANI_API_KEY is not set (see .env)" });

    if (url.pathname === "/api/stt") {
      const form = await new Response(await readBody(req), { headers: { "content-type": req.headers["content-type"] || "" } }).formData();
      const file = form.get("file"), lang = LANG[String(form.get("language"))];
      if (!(file instanceof Blob) || !file.size || !lang) return send(res, 400, { error: "Missing audio or language" });
      const fd = new FormData();
      fd.append("audio_file", file, "recording.wav");
      fd.append("language_code", lang);
      fd.append("format", "verbatim");
      const up = await fetch(`${BASE}/stt/v3`, { method: "POST", headers: { "X-API-Key-ID": KEY }, body: fd });
      if (!up.ok) return fail(res, up);
      return send(res, 200, { transcript: (await up.json()).transcript ?? "" });
    }

    if (url.pathname === "/api/tts") {
      const { text, language } = JSON.parse((await readBody(req)).toString() || "{}");
      const t = String(text ?? "").trim();
      if (!t || t.length > 400 || !LANG[language]) return send(res, 400, { error: "Invalid text or language" });
      const up = await fetch(`${BASE}/api/v1/tts/inference`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key-ID": KEY },
        body: JSON.stringify({
          text: t, voice: VOICE, model: MODEL, language: LANG[language], speed: 0.9,
          audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "wav" },
        }),
      });
      if (!up.ok) return fail(res, up);
      return send(res, 200, Buffer.from(await up.arrayBuffer()), "audio/wav");
    }
    send(res, 404, { error: "Not found" });
  } catch (e) {
    send(res, 500, { error: e instanceof Error ? e.message : "Server error" });
  }
}).listen(PORT, () => console.log(`SunSathiyAI running → http://localhost:${PORT}  (key ${KEY ? "loaded" : "MISSING"})`));
