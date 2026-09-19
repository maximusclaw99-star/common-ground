"use client";

import { useActionState, useState } from "react";
import { uploadResume, type UploadState } from "../actions";

export function UploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadResume, { error: null });
  const [name, setName] = useState<string | null>(null);

  return (
    <form action={action}>
      <label
        className="flex cursor-pointer flex-col items-center justify-center text-center"
        style={{
          border: "var(--border-2) dashed var(--rule-strong)",
          borderRadius: "var(--radius-none)",
          background: "var(--canvas-raised)",
          padding: "var(--space-48) var(--space-24)",
        }}
      >
        <input
          name="resume" type="file" accept="application/pdf" className="sr-only"
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

      <button type="submit" disabled={pending || !name} aria-disabled={pending || !name}
        className="tb-btn tb-btn--solid mono-label"
        style={{ marginTop: "var(--space-24)", width: "100%", justifyContent: "center" }}>
        {pending ? "Reading it" : "Read my resume \u2197"}
      </button>
    </form>
  );
}
