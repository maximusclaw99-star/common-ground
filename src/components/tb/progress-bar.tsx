/**
 * A bar that fills left to right as the seconds pass.
 *
 * The server reports nothing until it returns, so this is not a percentage
 * of the work. It is the elapsed time on a curve that approaches full at the
 * pace the operation usually takes (`typicalSeconds`): quick at first, then
 * slowing, never quite reaching the end until the result lands. What moves
 * is measured; where it ends up is honest about not knowing.
 *
 * It moves under "Reduce motion" too: a width that grows with the clock is
 * progress, not decoration, and the operating-system setting is about
 * sweeps and pulses.
 */
export function fillPercent(elapsed: number, typicalSeconds: number): number {
  const fill = 100 * (1 - Math.exp(-elapsed / typicalSeconds));
  return Math.min(96, Math.round(fill * 10) / 10);
}

export function ProgressBar({ elapsed, typicalSeconds, label }: { elapsed: number; typicalSeconds: number; label: string }) {
  const pct = fillPercent(elapsed, typicalSeconds);
  return (
    <div className="tb-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className="tb-progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}
