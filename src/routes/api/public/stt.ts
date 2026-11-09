import { createFileRoute } from "@tanstack/react-router";
import { LANG, gnaniConfig, json, missingKey, upstreamError } from "@/lib/gnani";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export const Route = createFileRoute("/api/public/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { key, base } = gnaniConfig();
        if (!key) return missingKey();
        try {
          const len = Number(request.headers.get("content-length") || 0);
          if (len > MAX_AUDIO_BYTES) return json({ error: "Request payload exceeds limit" }, 413);
          const form = await request.formData();
          const file = form.get("file");
          const lang = LANG[String(form.get("language"))];
          if (!(file instanceof Blob) || !file.size || file.size > MAX_AUDIO_BYTES || !lang) {
            return json({ error: "Missing audio file or language" }, 400);
          }
          const fd = new FormData();
          fd.append("audio_file", file, "recording.wav");
          fd.append("language_code", lang);
          fd.append("format", "verbatim");
          const up = await fetch(`${base}/stt/v3`, {
            method: "POST",
            headers: { "X-API-Key-ID": key },
            body: fd,
          });
          if (!up.ok) return upstreamError(up);
          const data = (await up.json()) as { transcript?: string };
          return json({ transcript: data.transcript ?? "" });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
        }
      },
    },
  },
});
