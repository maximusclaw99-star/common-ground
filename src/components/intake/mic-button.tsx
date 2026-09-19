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
    <div className="mt-[var(--space-12)] flex flex-wrap items-center gap-[var(--space-12)]">
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={busy}
        aria-pressed={listening}
        className="tb-btn tb-btn--sm mono-label"
      >
        <span
          className={listening ? "tb-led tb-led--live" : undefined}
          aria-hidden
          style={listening ? undefined : { width: 6, height: 6, background: "var(--ink-faint)" }}
        />
        {listening ? "Listening — tap to stop" : busy ? "Sorting that out" : "Say it instead"}
      </button>

      {interim && (
        <span className="mono-micro" style={{ color: "var(--ink-faint)", textTransform: "none" }}>
          &ldquo;{interim}&rdquo;
        </span>
      )}
      {error && (
        <span className="mono-micro" style={{ color: "var(--alert)", textTransform: "none" }}>
          {DICTATION_ERROR_COPY[error]}
        </span>
      )}
    </div>
  );
}
