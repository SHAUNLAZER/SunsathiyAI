import { createFileRoute } from "@tanstack/react-router";
import { LANG, gnaniConfig, json } from "@/lib/gnani";

export const Route = createFileRoute("/api/public/status")({
  server: {
    handlers: {
      GET: async () => {
        const { key, model, voice } = gnaniConfig();
        return json({
          status: "ok",
          keyLoaded: Boolean(key),
          model,
          voice,
          languages: Object.keys(LANG),
          indicVoicesReady: Boolean(key),
        });
      },
    },
  },
});
