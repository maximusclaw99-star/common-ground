"use client";

import { useActionState, useState } from "react";
import { ReadingProgress } from "@/components/intake/reading-progress";
import { uploadResume, type UploadState } from "../actions";

export function UploadForm({ reader }: { reader: string }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadResume, { error: null });
  const [name, setName] = useState<string | null>(null);

  return (
    <form action={action}>
      <label
        className="flex flex-col items-center justify-center text-center"
        style={{
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.5 : 1,
          border: "var(--border-2) dashed var(--rule-strong)",
          borderRadius: "var(--radius-none)",
          background: "var(--canvas-raised)",
          padding: "var(--space-48) var(--space-24)",
        }}
      >
        <input
          name="resume" type="file" accept="application/pdf" className="sr-only"
          disabled={pending}
          onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
        />
        <span className="mono-label">{name ?? "Choose your resume"}</span>
        <span className="mono-micro" style={{ marginTop: "var(--space-8)", color: "var(--ink-faint)" }}>
          PDF &middot; up to 15 MB
        </span>
      </label>

      {state.error && (
        <p className="body-sm" style={{
          margin: "var(--space-16) 0 0", padding: "var(--space-12)",
          border: "var(--border-1) solid var(--rule-strong)", background: "var(--canvas-raised)",
          color: "var(--ink-muted)",
        }}>
          <span className="mono-label" style={{ color: "var(--alert)" }}>Could not read it &mdash; </span>
          {state.error}
        </p>
      )}

      {pending ? (
        <ReadingProgress reader={reader} />
      ) : (
        <button type="submit" disabled={!name} aria-disabled={!name}
          className="tb-btn tb-btn--solid mono-label"
          style={{ marginTop: "var(--space-24)", width: "100%", justifyContent: "center" }}>
          Read my resume &#8599;
        </button>
      )}
    </form>
  );
}
