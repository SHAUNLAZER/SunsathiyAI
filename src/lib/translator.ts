import { z } from "zod";

export const languages = [
  ["en", "English", "en-IN"], ["hi", "Hindi", "hi-IN"],
  ["bn", "Bengali", "bn-IN"], ["te", "Telugu", "te-IN"],
  ["ta", "Tamil", "ta-IN"], ["mr", "Marathi", "mr-IN"],
  ["gu", "Gujarati", "gu-IN"], ["kn", "Kannada", "kn-IN"],
  ["ml", "Malayalam", "ml-IN"], ["pa", "Punjabi", "pa-IN"],
  ["ur", "Urdu", "ur-IN"], ["ne", "Nepali", "ne-IN"],
] as const;

export function speechMatches(expected: string, spoken: string) {
  const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();
  const target = normalize(expected);
  return Boolean(target) && target === normalize(spoken);
}

export const translationInput = z.object({
  text: z.string().trim().min(1).max(4000),
  source: z.string().trim().min(1).max(60),
  target: z.string().trim().min(1).max(60),
});

export function encodeWav(chunks: Float32Array[], rate: number) {
  const count = chunks.reduce((n, chunk) => n + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const word = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  word(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); word(8, "WAVE");
  word(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, "data"); view.setUint32(40, count * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const sample of chunk) {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, value < 0 ? value * 32768 : value * 32767, true); offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}