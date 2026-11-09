import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/translate")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleTranslation } = await import("@/lib/translation.server");
    return handleTranslation(request);
  } } },
});