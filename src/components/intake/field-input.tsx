"use client";

import { useState } from "react";
import { SCHOOL_ALIASES, ORG_ALIASES } from "@/lib/affinity/aliases";
import type { OptionGroup } from "@/lib/intake/options";
import type { Field } from "@/lib/intake/types";
import { Combobox } from "./combobox";
import { Dictation, MicField } from "./mic-button";
import { SpecificityMeter } from "./specificity-meter";

const inputClass = "tb-field";

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

/** Grouped option lists are objects; the canon sources are strings. */
function groupsFor(field: Field): readonly OptionGroup[] | null {
  const o = field.options;
  if (Array.isArray(o) && o.length && typeof o[0] === "object" && "items" in (o[0] as object)) {
    return o as readonly OptionGroup[];
  }
  return null;
}

export interface FieldInputProps {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  onDictate?: (text: string) => void;
  dictationBusy?: boolean;
  /** Reports text typed but not yet committed, so submit can flush it. */
  onDraftChange?: (draft: string) => void;
}

/** Wraps a single field so the mic sits at its end, with any status beneath. */
function withMic(
  field: Field,
  onDictate: ((text: string) => void) | undefined,
  busy: boolean | undefined,
  input: React.ReactNode,
) {
  if (!field.dictation || !onDictate) return input;
  return <MicField onTranscript={onDictate} busy={busy}>{input}</MicField>;
}

/** For fields made of several inputs, where no one box owns the mic. */
function StandaloneMic({
  field, onDictate, busy, row,
}: {
  field: Field;
  onDictate?: (text: string) => void;
  busy?: boolean;
  row: (mic: React.ReactNode) => React.ReactNode;
}) {
  if (!field.dictation || !onDictate) return <>{row(null)}</>;
  return (
    <Dictation
      onTranscript={onDictate}
      busy={busy}
      standalone
      render={(mic, status) => <>{row(mic)}{status}</>}
    />
  );
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

/**
 * A field with a curated list gets a real searchable multi-select; everything
 * else keeps free-text chip entry with datalist hints. These are two
 * components rather than one with a branch, because the branch would sit
 * above the free-text path's hooks.
 */
function ChipsInput(props: FieldInputProps) {
  return groupsFor(props.field) ? <PickerChips {...props} /> : <FreeChips {...props} />;
}

function PickerChips({ field, value, onChange, onDictate, dictationBusy, onDraftChange }: FieldInputProps) {
  const chips = Array.isArray(value) ? (value as string[]) : [];
  const groups = groupsFor(field)!;
  const box = (trailing?: React.ReactNode) => (
    <Combobox
      inputId={field.id}
      value={chips}
      onChange={onChange}
      groups={groups}
      placeholder={field.placeholder}
      onDraftChange={onDraftChange}
      trailing={trailing}
    />
  );
  return (
    <div>
      {field.dictation && onDictate ? (
        <Dictation
          onTranscript={onDictate}
          busy={dictationBusy}
          render={(mic, status) => <>{box(mic)}{status}</>}
        />
      ) : box()}
      {field.specificityMeter && <SpecificityMeter values={chips} />}
    </div>
  );
}

function FreeChips({ field, value, onChange, onDictate, dictationBusy, onDraftChange }: FieldInputProps) {
  const chips = Array.isArray(value) ? (value as string[]) : [];

  const [draft, setDraft] = useState("");
  const suggestions = suggestionsFor(field);
  const listId = `${field.id}-options`;

  const add = (raw: string) => {
    const next = raw.trim();
    onDraftChange?.("");
    if (!next || chips.some((c) => c.toLowerCase() === next.toLowerCase())) return setDraft("");
    onChange([...chips, next]);
    setDraft("");
  };

  return (
    <div>
      {chips.length > 0 && (
        <ul className="mb-[var(--space-12)] flex flex-wrap gap-[var(--space-8)]">
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

      {withMic(
        field, onDictate, dictationBusy,
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
            else { setDraft(next); onDraftChange?.(next); }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
            if (e.key === "Backspace" && !draft && chips.length) onChange(chips.slice(0, -1));
          }}
          onBlur={() => add(draft)}
        />,
      )}
      {suggestions.length > 0 && (
        <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      )}

      {field.specificityMeter && <SpecificityMeter values={chips} />}
    </div>
  );
}

function TextInput({ field, value, onChange, onDictate, dictationBusy }: FieldInputProps) {
  return (
    <div>
      {withMic(
        field, onDictate, dictationBusy,
        <input
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />,
      )}
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
      <StandaloneMic field={field} onDictate={onDictate} busy={dictationBusy} row={(mic) => (
        <div className="flex flex-wrap items-center gap-[var(--space-12)]">
          <input className={inputClass} style={{ flex: 1, minWidth: "10rem" }} placeholder="from — cybersecurity"
            value={pair.from ?? ""} onChange={(e) => set("from")(e.target.value)} />
          <span className="mono-label" style={{ color: "var(--ink-faint)" }} aria-hidden>&rarr;</span>
          <input className={inputClass} style={{ flex: 1, minWidth: "10rem" }} placeholder="to — consulting"
            value={pair.to ?? ""} onChange={(e) => set("to")(e.target.value)} />
          {mic}
        </div>
      )} />
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
    <div className="grid gap-[var(--space-12)]">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-[var(--space-12)]">
          <input className={`${inputClass} flex-1 min-w-[12rem]`} placeholder="Event name"
            value={row.name} onChange={(e) => update(i, { name: e.target.value })} />
          <select className={inputClass} style={{ width: "auto" }} value={row.kind}
            onChange={(e) => update(i, { kind: e.target.value })}>
            {EVENT_KINDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <input type="date" className={inputClass} style={{ width: "auto" }} value={row.date.slice(0, 10)}
            onChange={(e) => update(i, { date: e.target.value })} />
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="tb-btn tb-btn--sm mono-label">
            Remove
          </button>
        </div>
      ))}
      <StandaloneMic field={field} onDictate={onDictate} busy={dictationBusy} row={(mic) => (
        <div className="flex flex-wrap items-center gap-[var(--space-12)]">
          <button
            type="button"
            onClick={() => onChange([...rows, { name: "", kind: "career_fair", date: new Date().toISOString().slice(0, 10), org: null }])}
            className="tb-btn tb-btn--sm mono-label"
          >
            + Add an event
          </button>
          {mic}
        </div>
      )} />
    </div>
  );
}
