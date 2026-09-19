"use client";

import { DICTATION_ERROR_COPY, useDictation } from "@/hooks/use-dictation";

/**
 * Renders nothing where the Web Speech API is absent (Firefox has no
 * implementation at all). A greyed-out button with a "your browser doesn't
 * support this" tooltip is noise on a form that is already asking a lot, and
 * typing is the whole experience anyway.
 */
export function MicButton({
  onTranscript, busy,
}: { onTranscript: (text: string) => void; busy?: boolean }) {
  const { supported, listening, interim, error, start, stop } = useDictation({ onFinal: onTranscript });

  if (!supported) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={busy}
        aria-pressed={listening}
        className={`focus-ring inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50 ${
          listening
            ? "border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
            : "hover:bg-[var(--color-raised)]"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${listening ? "animate-pulse bg-[var(--color-accent)]" : "bg-[var(--color-faint)]"}`}
        />
        {listening ? "Listening — tap to stop" : busy ? "Sorting that out…" : "Say it instead"}
      </button>

      {interim && (
        <span className="text-[13px] italic text-[var(--color-faint)]">&ldquo;{interim}&rdquo;</span>
      )}
      {error && <span className="text-[13px] text-[var(--color-accent)]">{DICTATION_ERROR_COPY[error]}</span>}
    </div>
  );
}
