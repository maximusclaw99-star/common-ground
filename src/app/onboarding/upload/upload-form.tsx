"use client";

import { useActionState, useState } from "react";
import { uploadResume, type UploadState } from "../actions";

export function UploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadResume, { error: null });
  const [name, setName] = useState<string | null>(null);

  return (
    <form action={action}>
      <label className="focus-ring flex cursor-pointer flex-col items-center justify-center rounded-[14px] border border-dashed px-6 py-12 text-center transition-colors hover:border-[var(--color-accent-line)] hover:bg-[var(--color-raised)]">
        <input
          name="resume" type="file" accept="application/pdf" className="sr-only"
          onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
        />
        <span className="text-[16px]">{name ?? "Choose your resume"}</span>
        <span className="mt-1 text-[13px] text-[var(--color-faint)]">PDF, up to 15 MB</span>
      </label>

      {state.error && (
        <p className="mt-4 rounded-lg border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] px-3 py-2 text-[14px] leading-relaxed text-[var(--color-muted)]">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending || !name}
        className="focus-ring mt-5 w-full rounded-xl bg-[var(--color-accent)] px-5 py-3 text-[15px] font-medium text-white disabled:opacity-45">
        {pending ? "Reading it…" : "Read my resume"}
      </button>
    </form>
  );
}
