import { describe, expect, it } from "vitest";
import { encodeWav, languages, speechMatches, translationInput } from "@/lib/translator";

describe("sentence translator", () => {
  it("only offers English and Indian languages", () => {
    expect(languages.map(language => language[1])).toEqual(["English", "Hindi", "Bengali", "Telugu", "Tamil", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Urdu", "Nepali"]);
  });
  it("compares spoken translation words without punctuation or case", () => {
    expect(speechMatches("Hello, friend!", "hello friend")).toBe(true);
    expect(speechMatches("आप कैसे हैं?", "आप कैसे हैं")).toBe(true);
    expect(speechMatches("आप कैसे हैं?", "आप कहाँ हैं")).toBe(false);
    expect(speechMatches("Hello", "")).toBe(false);
  });
  it("accepts a free-form typed sentence rather than restricting to tutor phrases", () => {
    const result = translationInput.parse({ text: "Could you show me the nearest railway station?", source: "Auto", target: "Hindi" });
    expect(result.text).toBe("Could you show me the nearest railway station?");
    expect(result.target).toBe("Hindi");
  });
  it("accepts spoken transcripts in their original script", () => {
    expect(translationInput.parse({ text: "आप कैसे हैं?", source: "Hindi", target: "English" }).text).toBe("आप कैसे हैं?");
  });
  it("encodes captured speech as mono PCM WAV", async () => {
    const wav = encodeWav([new Float32Array([0, 1, -1])], 16000);
    const buffer = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(wav);
    });
    const view = new DataView(buffer);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
  });
});