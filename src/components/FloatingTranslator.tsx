import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowRightLeft, Check, Copy, Languages, Loader2, Mic, Send, Square, Trash2, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { encodeWav, languages } from "@/lib/translator";
import { TranslationPractice } from "@/components/TranslationPractice";

type Message = { id: number; original: string; translated: string; target: string; error?: string };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: { length: number; [key: number]: { isFinal: boolean; [key: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function FloatingTranslator() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("en");
  const [target, setTarget] = useState("hi");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<number>();
  const [practiceId, setPracticeId] = useState<number>();
  const abort = useRef<AbortController | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const recorder = useRef<{ context: AudioContext; stream: MediaStream; node: ScriptProcessorNode; input: MediaStreamAudioSourceNode; chunks: Float32Array[] } | null>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const active = useRef(false);
  const sequence = useRef(0);

  useEffect(() => { conversation.current?.scrollTo({ top: conversation.current.scrollHeight }); }, [messages, busy]);
  useEffect(() => {
    if (open) input.current?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  useEffect(() => () => { abort.current?.abort(); recognition.current?.abort(); releaseRecording(); }, []);

  const name = (code: string) => code === "auto" ? "Auto" : languages.find(l => l[0] === code)?.[1] ?? code;
  function releaseRecording() {
    const current = recorder.current;
    if (current) { current.node.disconnect(); current.input.disconnect(); current.stream.getTracks().forEach(t => t.stop()); void current.context.close(); recorder.current = null; }
  }
  function stopSpeech() { recognition.current?.stop(); recognition.current = null; releaseRecording(); setListening(false); }
  function close() { setOpen(false); setPracticeId(undefined); recognition.current?.abort(); recognition.current = null; releaseRecording(); setListening(false); abort.current?.abort(); }

  async function translate(sentence: string) {
    const text = sentence.trim();
    if (!text || active.current || practiceId !== undefined) return;
    active.current = true; setBusy(true); setNotice(""); setDraft("");
    const id = ++sequence.current;
    const code = name(target);
    setMessages(previous => [...previous, { id, original: text, translated: "", target: code }]);
    const controller = new AbortController(); abort.current = controller;
    const update = (fn: (message: Message) => Message) => setMessages(previous => previous.map(message => message.id === id ? fn(message) : message));
    try {
      const response = await fetch("/api/public/translate", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ text, source: name(source), target: code }) });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error ?? "Translation unavailable."); }
      if (!response.body) throw new Error("Translation response was empty.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = "";
      while (true) {
        const chunk = await reader.read();
        pending += decoder.decode(chunk.value, { stream: !chunk.done });
        const lines = pending.split("\n"); pending = lines.pop() ?? "";
        for (const line of lines) if (line) {
          const event = JSON.parse(line);
          if (event.error) throw new Error(event.error);
          if (event.text) update(message => ({ ...message, translated: message.translated + event.text }));
        }
        if (chunk.done) break;
      }
    } catch (error) {
      update(message => ({ ...message, error: controller.signal.aborted ? "Translation stopped." : error instanceof Error ? error.message : "Translation failed." }));
    } finally { active.current = false; setBusy(false); abort.current = null; }
  }

  async function toggleMicrophone() {
    if (listening) {
      if (recognition.current) { recognition.current.stop(); return; }
      const recording = recorder.current;
      if (!recording) return;
      const audio = encodeWav(recording.chunks, recording.context.sampleRate);
      stopSpeech(); setNotice("Transcribing…");
      try {
        const form = new FormData(); form.append("file", audio, "sentence.wav"); form.append("language", source);
        const response = await fetch("/api/public/stt", { method: "POST", body: form });
        const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Speech could not be recognized.");
        if (!data.transcript?.trim()) throw new Error("No speech detected. Please try again.");
        setNotice(""); await translate(data.transcript);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Speech unavailable."); }
      return;
    }
    setNotice("");
    if (source === "auto") { setNotice("Choose your spoken language before using the microphone."); return; }
    const win = window as SpeechWindow; const Constructor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (Constructor) {
      const rec = new Constructor(); recognition.current = rec;
      rec.lang = languages.find(l => l[0] === source)?.[2] ?? "en-IN";
      rec.continuous = true; rec.interimResults = true;
      rec.onresult = event => {
        let interim = ""; let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]; const text = result?.[0]?.transcript ?? "";
          if (result?.isFinal) final += text; else interim += text;
        }
        if (interim) setDraft(interim);
        if (final.trim()) { rec.stop(); void translate(final); }
      };
      rec.onerror = event => { setListening(false); setNotice(event.error === "not-allowed" ? "Microphone permission was denied. Allow microphone access or type your sentence." : event.error === "no-speech" ? "No speech detected." : "Live speech is unavailable in this browser. You can still type your sentence."); };
      rec.onend = () => { recognition.current = null; setListening(false); };
      try { rec.start(); setListening(true); } catch { setNotice("Could not start the microphone."); }
      return;
    }
    if (!["en", "hi", "bn", "te"].includes(source)) { setNotice("Voice input for this language needs a browser with live speech support, such as Chrome. Typed translation is available."); return; }
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      context = new AudioContext({ sampleRate: 16000 }); await context.resume();
      const node = context.createScriptProcessor(4096, 1, 1); const audioInput = context.createMediaStreamSource(stream); const chunks: Float32Array[] = [];
      node.onaudioprocess = event => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      audioInput.connect(node); node.connect(context.destination);
      recorder.current = { context, stream, node, input: audioInput, chunks }; setListening(true);
    } catch { stream?.getTracks().forEach(t => t.stop()); void context?.close(); setNotice("Microphone unavailable. Allow access or type your sentence."); }
  }

  const player = useRef<HTMLAudioElement | null>(null);
  async function speak(message: Message) {
    setNotice("");
    player.current?.pause(); window.speechSynthesis?.cancel();
    // Gnani voices first: browsers often have no Indian-language voice and stay silent.
    const entry = languages.find(l => l[0] === message.target || l[1] === message.target);
    const code = entry?.[0] ?? message.target;
    if (["en", "hi", "bn", "te"].includes(code) && message.translated.length <= 400) {
      try {
        const res = await fetch("/api/public/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: message.translated, language: code }) });
        if (res.ok) {
          const url = URL.createObjectURL(await res.blob());
          const audio = new Audio(url); player.current = audio;
          audio.onended = () => URL.revokeObjectURL(url);
          await audio.play(); return;
        }
      } catch { /* fall back to the browser voice */ }
    }
    if (!("speechSynthesis" in window)) { setNotice("Audio playback is unavailable in this browser."); return; }
    const utterance = new SpeechSynthesisUtterance(message.translated);
    const lang = entry?.[2] ?? message.target;
    utterance.lang = lang;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.replace("_", "-").toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    if (voice) utterance.voice = voice;
    else if (window.speechSynthesis.getVoices().length) setNotice("This browser has no voice for this language, so playback may be silent.");
    utterance.onerror = () => setNotice("No playback voice is available for this language.");
    window.speechSynthesis.speak(utterance);
  }

  return <div className="translator-theme">
    {open && <section role="dialog" aria-label="Sentence translator" className="translator-panel flex flex-col overflow-hidden rounded-lg border-2 border-border bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3"><Languages className="size-5 text-primary" /><div><h2 className="font-bold">SunSathiy translator</h2><p className="text-xs text-muted-foreground">{listening ? "Listening…" : busy ? "Translating…" : "Live translation"}</p></div></div>
        <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Clear conversation" title="Clear conversation" disabled={busy || listening} onClick={() => { setPracticeId(undefined); setMessages([]); }}><Trash2 /></Button><Button variant="ghost" size="icon" aria-label="Close translator" title="Close translator" onClick={close}><X /></Button></div>
      </header>
      <div className="shrink-0 border-b border-border bg-muted/50 p-3">
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-xs text-muted-foreground">From<select aria-label="Source language" value={source} disabled={busy || listening} onChange={event => setSource(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground"><option value="auto">Auto-detect</option>{languages.map(l => <option key={l[0]} value={l[0]}>{l[1]}</option>)}</select></label>
          <Button variant="ghost" size="icon" aria-label="Swap languages" title="Swap languages" disabled={busy || listening || source === "auto"} onClick={() => { setSource(target); setTarget(source); }}><ArrowRightLeft /></Button>
          <label className="min-w-0 flex-1 text-xs text-muted-foreground">To<select aria-label="Target language" value={target} disabled={busy || listening} onChange={event => setTarget(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground">{languages.map(l => <option key={l[0]} value={l[0]}>{l[1]}</option>)}</select></label>
        </div>
      </div>
      <div ref={conversation} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 && <div className="flex h-full min-h-24 flex-col items-center justify-center gap-3 text-center"><Languages className="size-8 text-primary" /><p className="text-sm text-muted-foreground">नमस्ते · Hello · নমস্কার · హలో</p></div>}
        {messages.map(message => <div key={message.id} className="space-y-2">
          <p dir="auto" className="ml-7 whitespace-pre-wrap break-words rounded-md bg-secondary px-3 py-2 text-sm">{message.original}</p>
          <div className="mr-4 border-l-2 border-primary pl-3"><div className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary"><ArrowRight className="size-3" />{message.target}</div>
            {message.translated ? <p dir="auto" className="whitespace-pre-wrap break-words text-base leading-relaxed">{message.translated}</p> : !message.error && <Loader2 className="size-4 motion-safe:animate-spin text-muted-foreground" />}
            {message.error && <p role="alert" className="mt-2 text-sm text-destructive">{message.error}</p>}
            {message.translated && <div className="mt-1 flex flex-wrap items-center gap-1"><Button variant="ghost" size="icon" aria-label="Copy translation" title="Copy translation" onClick={async () => { try { await navigator.clipboard.writeText(message.translated); setCopied(message.id); } catch { setNotice("Unable to copy. Select the translation to copy it."); } }}>{copied === message.id ? <Check /> : <Copy />}</Button><Button variant="ghost" size="icon" aria-label="Hear translation" title="Hear translation" disabled={practiceId !== undefined} onClick={() => speak(message)}><Volume2 /></Button><Button variant="outline" size="sm" disabled={busy || listening || practiceId !== undefined} onClick={() => setPracticeId(message.id)}><Mic />Practise speaking</Button></div>}
            {practiceId === message.id && <TranslationPractice text={message.translated} language={message.target} onClose={() => setPracticeId(undefined)} />}
          </div>
        </div>)}
      </div>
      <form className="shrink-0 border-t border-border p-3" onSubmit={event => { event.preventDefault(); stopSpeech(); void translate(draft); }}>
        {notice && <p role="alert" className="mb-2 text-xs text-destructive">{notice}</p>}
        <textarea ref={input} aria-label="Sentence to translate" value={draft} disabled={practiceId !== undefined} maxLength={4000} rows={2} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy) { stopSpeech(); void translate(draft); } } }} placeholder={listening ? "Listening…" : "Your sentence…"} className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary" />
        <div className="mt-2 flex items-center justify-between"><Button type="button" variant={listening ? "destructive" : "outline"} size="icon" aria-label={listening ? "Stop microphone" : "Speak a sentence"} title={listening ? "Stop microphone" : "Speak a sentence"} disabled={busy || practiceId !== undefined} onClick={() => void toggleMicrophone()}>{listening ? <Square /> : <Mic />}</Button>
          {busy ? <Button type="button" variant="outline" onClick={() => abort.current?.abort()}><Square />Stop</Button> : <Button type="submit" disabled={!draft.trim() || practiceId !== undefined}><Send />Translate</Button>}
        </div>
      </form>
    </section>}
    {!open && <Button className="translator-launcher rounded-full" aria-label="Open translator" title="Open translator" onClick={() => setOpen(true)}><Languages /><span>Translate</span></Button>}
  </div>;
}