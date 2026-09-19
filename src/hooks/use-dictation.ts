"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type DictationError = "not-allowed" | "network" | "no-speech" | "unknown";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** Support cannot change during a session, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};

const getCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export interface Dictation {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: DictationError | null;
  start: () => void;
  stop: () => void;
}

/**
 * Web Speech API dictation, with typing always available underneath it.
 *
 * Support is detected in an effect, never in the render body: evaluating
 * `window.SpeechRecognition` while rendering gives `false` on the server and
 * `true` on the client, which is a hydration mismatch on every field with a
 * microphone. Start from `supported: false` and let the effect turn it on.
 */
export function useDictation(opts: {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  lang?: string;
}): Dictation {
  const { onFinal, onInterim, lang = "en-US" } = opts;

  // useSyncExternalStore rather than an effect: it gives a constant `false` on
  // the server and the real answer on the client in one pass, which avoids
  // both the hydration mismatch and a cascading re-render on mount.
  const supported = useSyncExternalStore(subscribeNever, () => getCtor() !== null, () => false);

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<DictationError | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldRestartRef = useRef(false);
  const retriedRef = useRef(false);
  const givenUpRef = useRef(false);
  // Held in refs so the recognizer is not rebuilt on every parent render.
  // Assigned in an effect, never during render.
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);
  useEffect(() => {
    onFinalRef.current = onFinal;
    onInterimRef.current = onInterim;
  }, [onFinal, onInterim]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    setListening(false);
    setInterim("");
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || givenUpRef.current) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = "";
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else pending += result[0].transcript;
      }
      if (pending) {
        setInterim(pending);
        onInterimRef.current?.(pending);
      }
      if (finalText.trim()) {
        retriedRef.current = false;
        setInterim("");
        onFinalRef.current(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      const kind = (event.error ?? "unknown") as DictationError;
      if (kind === "no-speech" && !retriedRef.current) {
        // A pause is not a failure. Retry once, silently.
        retriedRef.current = true;
        return;
      }
      // iOS Safari routes recognition through Apple's servers, so this fails
      // offline. Give up for the session rather than retrying into a loop.
      if (kind === "network" || kind === "not-allowed") {
        givenUpRef.current = true;
        shouldRestartRef.current = false;
      }
      setError(kind);
      setListening(false);
    };

    recognition.onend = () => {
      // Chrome stops on its own after a silence gap. Restart unless the stop
      // was intentional — checking the ref is what stops an intentional stop
      // resurrecting the recognizer.
      if (shouldRestartRef.current && !givenUpRef.current) {
        try { recognition.start(); return; } catch { /* already starting */ }
      }
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    shouldRestartRef.current = true;
    retriedRef.current = false;
    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("unknown");
    }
  }, [lang]);

  useEffect(() => () => {
    shouldRestartRef.current = false;
    recognitionRef.current?.abort();
  }, []);

  return { supported, listening, interim, error, start, stop };
}

export const DICTATION_ERROR_COPY: Record<DictationError, string> = {
  "not-allowed": "Your microphone is blocked in your browser settings. Typing works just as well.",
  network: "Speech recognition needs a connection. Type your answer instead.",
  "no-speech": "We didn't catch that — try again, or type it.",
  unknown: "Dictation stopped unexpectedly. Typing works just as well.",
};
