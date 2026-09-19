"use client";

import { DICTATION_ERROR_COPY, useDictation } from "@/hooks/use-dictation";

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}

/**
 * Dictation, as a circle at the end of the field it fills.
 *
 * Renders nothing where the Web Speech API is absent (Firefox has no
 * implementation at all). A greyed-out button with a "your browser doesn't
 * support this" tooltip is noise on a form that is already asking a lot, and
 * typing is the whole experience anyway.
 *
 * The hook lives here, but the mic and its status line belong in two different
 * places in the layout — inside the field's box, and under it — so the caller
 * is handed both and decides where each goes.
 */
export function Dictation({
  onTranscript, busy, standalone, render,
}: {
  onTranscript: (text: string) => void;
  busy?: boolean;
  /** No single field to sit in: the circle stands on its own instead. */
  standalone?: boolean;
  render: (mic: React.ReactNode, status: React.ReactNode) => React.ReactNode;
}) {
  const { supported, listening, interim, error, start, stop } = useDictation({ onFinal: onTranscript });

  const mic = !supported ? null : (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={busy}
      aria-pressed={listening}
      aria-label={listening ? "Stop dictating" : "Dictate this answer"}
      title={listening ? "Stop dictating" : busy ? "Sorting that out" : "Dictate this answer"}
      className={standalone ? "tb-mic tb-mic--standalone" : "tb-mic"}
    >
      <MicIcon />
    </button>
  );

  const message = error ? DICTATION_ERROR_COPY[error] : interim ? `“${interim}”` : null;
  const status = !supported || !message ? null : (
    <p
      className="mono-micro"
      style={{
        margin: "var(--space-8) 0 0",
        color: error ? "var(--alert)" : "var(--ink-faint)",
        textTransform: "none",
      }}
    >
      {message}
    </p>
  );

  return <>{render(mic, status)}</>;
}

/** The common case: one field, mic inside it, status underneath. */
export function MicField({
  onTranscript, busy, children,
}: { onTranscript: (text: string) => void; busy?: boolean; children: React.ReactNode }) {
  return (
    <Dictation
      onTranscript={onTranscript}
      busy={busy}
      render={(mic, status) => (
        <>
          <span className="tb-dictate__box">
            {children}
            {mic}
          </span>
          {status}
        </>
      )}
    />
  );
}
