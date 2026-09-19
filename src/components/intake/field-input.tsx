"use client";

import { useState } from "react";
import { SCHOOL_ALIASES, ORG_ALIASES } from "@/lib/affinity/aliases";
import type { Field } from "@/lib/intake/types";
import { MicButton } from "./mic-button";
import { SpecificityMeter } from "./specificity-meter";

const inputClass =
  "focus-ring w-full rounded-lg border bg-[var(--color-surface)] px-3 py-2 text-[15px] placeholder:text-[var(--color-faint)]";

/** Suggestions come from the same alias tables the matcher uses, so what a
 *  student picks is guaranteed to canonicalise. */
function suggestionsFor(field: Field): string[] {
  const titleCase = (s: string) =>
    s.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and");
  if (field.options === "school-canon") {
    return [...new Set(Object.keys(SCHOOL_ALIASES).filter((k) => k.length > 4))].map(titleCase).sort();
  }
  if (field.options === "org-canon") {
    return [...new Set(Object.keys(ORG_ALIASES).filter((k) => k.length > 3))].map(titleCase).sort();
  }
  return Array.isArray(field.options) ? [...field.options] : [];
}

export interface FieldInputProps {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  onDictate?: (text: string) => void;
  dictationBusy?: boolean;
}

export function FieldInput(props: FieldInputProps) {
  const { field } = props;
  switch (field.input) {
    case "chips": return <ChipsInput {...props} />;
    case "date-list": return <EventListInput {...props} />;
    case "pair": return <PairInput {...props} />;
    case "select": return <SelectInput {...props} />;
    case "date": return <DateInput {...props} />;
    default: return <TextInput {...props} />;
  }
}

function ChipsInput({ field, value, onChange, onDictate, dictationBusy }: FieldInputProps) {
  const chips = Array.isArray(value) ? (value as string[]) : [];
  const [draft, setDraft] = useState("");
  const suggestions = suggestionsFor(field);
  const listId = `${field.id}-options`;

  const add = (raw: string) => {
    const next = raw.trim();
    if (!next || chips.some((c) => c.toLowerCase() === next.toLowerCase())) return setDraft("");
    onChange([...chips, next]);
    setDraft("");
  };

  return (
    <div>
      {chips.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <li key={chip}>
              <button
                type="button"
                onClick={() => onChange(chips.filter((c) => c !== chip))}
                className="focus-ring group inline-flex items-center gap-1.5 rounded-full border bg-[var(--color-raised)] py-1 pl-3 pr-2 text-[13px]"
              >
                {chip}
                <span className="text-[var(--color-faint)] group-hover:text-[var(--color-accent)]" aria-hidden>×</span>
                <span className="sr-only">Remove {chip}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        className={inputClass}
        value={draft}
        list={suggestions.length ? listId : undefined}
        placeholder={field.placeholder ?? "Type and press Enter"}
        onChange={(e) => {
          // Picking from the datalist fires a change with the full value and
          // no keydown, so commit it here rather than waiting for Enter.
          const next = e.target.value;
          if (suggestions.includes(next)) add(next);
          else setDraft(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
          if (e.key === "Backspace" && !draft && chips.length) onChange(chips.slice(0, -1));
        }}
        onBlur={() => add(draft)}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      )}

      {field.dictation && onDictate && <MicButton onTranscript={onDictate} busy={dictationBusy} />}
      {field.specificityMeter && <SpecificityMeter values={chips} />}
    </div>
  );
}

function TextInput({ field, value, onChange, onDictate, dictationBusy }: FieldInputProps) {
  return (
    <div>
      <input
        className={inputClass}
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.dictation && onDictate && <MicButton onTranscript={onDictate} busy={dictationBusy} />}
    </div>
  );
}

function DateInput({ value, onChange }: FieldInputProps) {
  return (
    <input
      type="date"
      className={inputClass}
      value={typeof value === "string" ? value.slice(0, 10) : ""}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}

function SelectInput({ field, value, onChange }: FieldInputProps) {
  const options = suggestionsFor(field);
  return (
    <div>
      <input
        className={inputClass}
        list={`${field.id}-select`}
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder ?? "Start typing…"}
        onChange={(e) => onChange(e.target.value || null)}
      />
      <datalist id={`${field.id}-select`}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </div>
  );
}

function PairInput({ field, value, onChange, onDictate, dictationBusy }: FieldInputProps) {
  const pair = (value ?? {}) as { from?: string; to?: string };
  const set = (part: "from" | "to") => (next: string) => {
    const merged = { from: pair.from ?? "", to: pair.to ?? "", [part]: next };
    onChange(merged.from || merged.to ? merged : null);
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputClass} flex-1 min-w-[10rem]`} placeholder="from — cybersecurity"
          value={pair.from ?? ""} onChange={(e) => set("from")(e.target.value)} />
        <span className="text-[var(--color-faint)]" aria-hidden>→</span>
        <input className={`${inputClass} flex-1 min-w-[10rem]`} placeholder="to — consulting"
          value={pair.to ?? ""} onChange={(e) => set("to")(e.target.value)} />
      </div>
      {field.dictation && onDictate && <MicButton onTranscript={onDictate} busy={dictationBusy} />}
    </div>
  );
}

const EVENT_KINDS = [
  ["career_fair", "Career fair"], ["recruiting_event", "Recruiting event"],
  ["conference", "Conference"], ["webinar", "Webinar"],
  ["case_competition", "Case competition"], ["class", "Class"],
] as const;

interface EventRow { name: string; kind: string; date: string; org: string | null }

function EventListInput({ field, value, onChange, onDictate, dictationBusy }: FieldInputProps) {
  const rows: EventRow[] = Array.isArray(value) ? (value as EventRow[]) : [];
  const update = (i: number, patch: Partial<EventRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input className={`${inputClass} flex-1 min-w-[12rem]`} placeholder="Event name"
            value={row.name} onChange={(e) => update(i, { name: e.target.value })} />
          <select className={`${inputClass} w-auto`} value={row.kind}
            onChange={(e) => update(i, { kind: e.target.value })}>
            {EVENT_KINDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <input type="date" className={`${inputClass} w-auto`} value={row.date.slice(0, 10)}
            onChange={(e) => update(i, { date: e.target.value })} />
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="focus-ring rounded-lg border px-2.5 py-2 text-[13px] text-[var(--color-muted)]">
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { name: "", kind: "career_fair", date: new Date().toISOString().slice(0, 10), org: null }])}
        className="focus-ring rounded-lg border px-3 py-1.5 text-[13px] hover:bg-[var(--color-raised)]"
      >
        + Add an event
      </button>
      {field.dictation && onDictate && <MicButton onTranscript={onDictate} busy={dictationBusy} />}
    </div>
  );
}
