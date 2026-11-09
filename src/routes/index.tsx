import { createFileRoute } from "@tanstack/react-router";
import { FloatingTranslator } from "@/components/FloatingTranslator";

const TITLE = "SunSathiyAI — Sovereign Multilingual Voice Tutor";
const DESC =
  "Pick your comfort language, pick a target language, and practise speaking with a real-time AI voice tutor.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// The original tutor is a self-contained page (its own styles + audio recorder),
// served unchanged from /tutor.html so its behaviour is preserved exactly.
function Index() {
  return (
    <>
    <iframe
      src="/tutor.html"
      title="SunSathiyAI voice tutor"
      allow="microphone; autoplay"
      className="fixed inset-0 h-full w-full border-0"
    />
    <FloatingTranslator />
    </>
  );
}
