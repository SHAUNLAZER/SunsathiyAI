import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { encodeWav, languages, speechMatches } from "@/lib/translator";

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: { length: number; [key: number]: { isFinal: boolean; [key: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type Recording = { context: AudioContext; stream: MediaStream; node: ScriptProcessorNode; input: MediaStreamAudioSourceNode; chunks: Float32Array[] };

export function TranslationPractice({ text, language, onClose }: { text: string; language: string; onClose: () => void }) {
  const [listening, setListening] = useState(false);
  const [checking, setChecking] = useState(false);
  const [spoken, setSpoken] = useState("");
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const recording = useRef<Recording | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const feedback = useRef<HTMLDivElement>(null);
  const selected = languages.find(item => item[1] === language);
  useEffect(() => { if (complete || error) feedback.current?.scrollIntoView({ block: "nearest" }); }, [complete, error]);

  function release() {
    const current = recording.current;
    if (!current) return;
    current.node.disconnect(); current.input.disconnect();
    current.stream.getTracks().forEach(track => track.stop());
    void current.context.close(); recording.current = null;
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; recognition.current?.abort(); request.current?.abort(); release(); };
  }, []);

  async function toggle() {
    if (!selected) return;
    if (listening) {
      if (recognition.current) { recognition.current.stop(); return; }
      const current = recording.current;
      if (!current) return;
      const wav = encodeWav(current.chunks, current.context.sampleRate);
      release(); setListening(false); setChecking(true);
      const controller = new AbortController(); request.current = controller;
      try {
        const form = new FormData(); form.append("file", wav, "practice.wav"); form.append("language", selected[0]);
        const response = await fetch("/api/public/stt", { method: "POST", body: form, signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Speech recognition is unavailable.");
        if (!data.transcript?.trim()) throw new Error("No speech detected. Please try again.");
        if (mounted.current) { setSpoken(data.transcript); setComplete(true); }
      } catch (failure) {
        if (mounted.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not check speech.");
      } finally { if (mounted.current) setChecking(false); request.current = null; }
      return;
    }
    window.speechSynthesis?.cancel();
    setSpoken(""); setComplete(false); setError("");
    const win = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (Constructor) {
      const rec = new Constructor(); recognition.current = rec;
      rec.lang = selected[2]; rec.continuous = false; rec.interimResults = true;
      rec.onresult = event => {
        if (!mounted.current) return;
        let transcript = ""; let final = false;
        for (let index = 0; index < event.results.length; index++) {
          transcript += event.results[index]?.[0]?.transcript ?? "";
          final ||= event.results[index]?.isFinal ?? false;
        }
        setSpoken(transcript);
        if (final && transcript.trim()) { setComplete(true); rec.stop(); }
      };
      rec.onerror = event => {
        if (mounted.current) { setListening(false); setError(event.error === "not-allowed" ? "Allow microphone access to practise speaking." : event.error === "no-speech" ? "No speech detected. Please try again." : "Speech recognition is unavailable. Try again in a browser with live speech support."); }
      };
      rec.onend = () => { recognition.current = null; if (mounted.current) setListening(false); };
      try { rec.start(); setListening(true); } catch { recognition.current = null; setError("Could not start the microphone."); }
      return;
    }
    if (!["en", "hi", "bn", "te"].includes(selected[0])) { setError("Speaking practice for this language needs a browser with live speech support, such as Chrome."); return; }
    let stream: MediaStream | undefined; let context: AudioContext | undefined;
    setChecking(true);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
      context = new AudioContext({ sampleRate: 16000 }); await context.resume();
      if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); void context.close(); return; }
      const node = context.createScriptProcessor(4096, 1, 1); const input = context.createMediaStreamSource(stream); const chunks: Float32Array[] = [];
      node.onaudioprocess = event => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      input.connect(node); node.connect(context.destination);
      recording.current = { context, stream, node, input, chunks }; setListening(true);
    } catch { stream?.getTracks().forEach(track => track.stop()); void context?.close(); if (mounted.current) setError("Microphone unavailable. Allow access and try again."); }
    finally { if (mounted.current) setChecking(false); }
  }

  return <div className="mt-2 space-y-2 border-t border-border pt-3">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Speaking practice · {language}</h3><Button variant="ghost" size="icon" aria-label="Close speaking practice" title="Close speaking practice" onClick={onClose}><X /></Button></div>
    <Button variant={listening ? "destructive" : "outline"} disabled={checking} onClick={() => void toggle()}>{listening ? <Square /> : <Mic />}{checking ? "Checking…" : listening ? "Finish speaking" : complete ? "Try again" : "Speak translation"}</Button>
    <div ref={feedback} aria-live="polite" className="space-y-1 text-sm">
      {listening && <p className="text-primary">Listening…</p>}
      {spoken && <><p className="text-xs text-muted-foreground">You said</p><p dir="auto" className="whitespace-pre-wrap break-words">{spoken}</p></>}
      {complete && <p className="font-semibold text-primary">{speechMatches(text, spoken) ? "Your words match the translation." : "Not quite the same words yet. Try again."}</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  </div>;
}