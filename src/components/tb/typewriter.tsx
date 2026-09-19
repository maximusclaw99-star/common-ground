/**
 * `--tb-chars` is computed from the string rather than hard-coded, and each
 * line's delay is the sum of the previous lines' durations at 45ms per
 * character — the one prop in the system that needs arithmetic.
 */
export const CHAR_MS = 45;
/** Beat between machine lines. */
const GAP_MS = 200;

export function Type({
  children, delay = 0, caret = false,
}: { children: string; delay?: number; caret?: boolean }) {
  return (
    <span
      className={caret ? "tb-type" : "tb-type tb-type--nocaret"}
      style={{ "--tb-chars": children.length, "--tb-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </span>
  );
}

/** Machine lines: `>` opens one, `_` ends one that is still running. */
export function TypedLines({ lines }: { lines: string[] }) {
  // Each line starts when the previous ones have finished typing. Derived
  // rather than accumulated in a running variable, so nothing is reassigned
  // during render — the list is two or three lines, so the cost is nothing.
  const delayOf = (i: number) =>
    lines.slice(0, i).reduce((sum, line) => sum + line.length * CHAR_MS + GAP_MS, 0);

  return (
    <>
      {lines.map((line, i) => (
        <span key={line}>
          <Type delay={delayOf(i)} caret={i === lines.length - 1}>{line}</Type>
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}
