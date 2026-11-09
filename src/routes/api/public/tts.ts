import { createFileRoute } from "@tanstack/react-router";
import { LANG, gnaniConfig, json, missingKey, upstreamError } from "@/lib/gnani";

export const Route = createFileRoute("/api/public/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfg = gnaniConfig();
        const { key, base } = cfg;
        let { model, voice } = cfg;
        if (!key) return missingKey();
        try {
          const raw = await request.text();
          if (raw.length > 100 * 1024) return json({ error: "Request too large" }, 413);
          const body = JSON.parse(raw || "{}");
          const { text, language, speed } = body;
          const safe = /^[A-Za-z0-9._-]{1,40}$/;
          if (typeof body.model === "string" && safe.test(body.model)) model = body.model;
          if (typeof body.voice === "string" && safe.test(body.voice)) voice = body.voice;
          const t = String(text ?? "").trim();
          if (!t || t.length > 400 || !LANG[language]) {
            return json({ error: "Invalid text or language" }, 400);
          }
          const ttsSpeed = typeof speed === "number" && speed >= 0.5 && speed <= 1.5 ? speed : 0.9;
          const up = await fetch(`${base}/api/v1/tts/inference`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key-ID": key },
            body: JSON.stringify({
              text: t,
              voice,
              model,
              language: LANG[language],
              speed: ttsSpeed,
              audio_config: {
                sample_rate: 24000,
                num_channels: 1,
                sample_width: 2,
                encoding: "linear_pcm",
                container: "wav",
              },
            }),
          });
          if (!up.ok) return upstreamError(up);
          return new Response(await up.arrayBuffer(), {
            headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
          });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
        }
      },
    },
  },
});
