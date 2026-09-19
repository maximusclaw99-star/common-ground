import { INPUT_SECONDS, THEME_COPY, THEME_ORDER, type Gap, type IntakeStep, type Theme } from "./types";

export interface GroupOptions {
  maxPerStep?: number;
  maxSteps?: number;
}

/**
 * Turns a flat list of gaps into screens.
 *
 * Two rules carry the weight. Every REQUIRED gap lands on the first screen,
 * because a student who abandons after one screen must still be scoreable —
 * that is what "required" has to mean. Everything else groups by theme,
 * because five related questions read as a conversation and five unrelated
 * ones read as a form.
 */
export function groupIntoSteps(gaps: readonly Gap[], opts?: GroupOptions): IntakeStep[] {
  const maxPerStep = opts?.maxPerStep ?? 5;
  const maxSteps = opts?.maxSteps ?? 5;
  if (!gaps.length) return [];

  // "Confirm what we read" belongs with the required questions even when a
  // given confirmation is optional — otherwise it becomes a second screen with
  // the same heading, which reads like a bug, and it burns a screen that a
  // real theme should have had.
  const opening = gaps.filter((g) => g.field.required || g.field.theme === "confirm");
  const rest = gaps.filter((g) => !g.field.required && g.field.theme !== "confirm");

  const byTheme = new Map<Theme, Gap[]>();
  for (const gap of rest) {
    const list = byTheme.get(gap.field.theme) ?? [];
    list.push(gap);
    byTheme.set(gap.field.theme, list);
  }

  // Themes in ladder order: the strongest question in a theme decides where
  // the whole theme sits, so tier importance survives the grouping.
  const themes = [...byTheme.keys()].sort((a, b) => {
    const best = (t: Theme) => Math.max(...byTheme.get(t)!.map((g) => g.priority));
    return best(b) - best(a) || THEME_ORDER.indexOf(a) - THEME_ORDER.indexOf(b);
  });

  type Chunk = { theme: Theme; gaps: Gap[]; part?: string; key: string };
  const chunks: Chunk[] = [];

  const chunkUp = (theme: Theme, list: Gap[], key: string) => {
    const parts = Math.ceil(list.length / maxPerStep);
    for (let i = 0; i < list.length; i += maxPerStep) {
      chunks.push({
        theme, gaps: list.slice(i, i + maxPerStep), key: `${key}-${i / maxPerStep}`,
        part: parts > 1 ? `${i / maxPerStep + 1} of ${parts}` : undefined,
      });
    }
  };

  // The opening screens come first, spilling onto further screens only if
  // there are more than fit — never behind an optional question.
  if (opening.length) chunkUp("confirm", opening, "opening");
  for (const theme of themes) chunkUp(theme, byTheme.get(theme)!, theme);

  if (chunks.length <= maxSteps) {
    return chunks.map((c) => makeStep(c.key, c.theme, c.gaps, false, c.part));
  }

  // Over the cap: keep the highest-priority screens and collapse the whole
  // low-priority tail into one screen the student may skip outright, rather
  // than four more screens they abandon on. The tail is deliberately exempt
  // from maxPerStep — it is a single opt-in list, not a step to work through.
  const kept = chunks.slice(0, maxSteps - 1);
  const tail = chunks.slice(maxSteps - 1).flatMap((c) => c.gaps);

  return [
    ...kept.map((c) => makeStep(c.key, c.theme, c.gaps, false, c.part)),
    {
      id: "optional-tail",
      title: "A few optional extras",
      subtitle: "Each one adds people we can find for you. Skip the whole screen if you'd rather.",
      fields: tail,
      estimatedSeconds: estimate(tail),
      optional: true,
    },
  ];
}

function makeStep(id: string, theme: Theme, fields: Gap[], optional: boolean, part?: string): IntakeStep {
  const copy = THEME_COPY[theme];
  return {
    id,
    title: part ? `${copy.title} (${part})` : copy.title,
    subtitle: copy.subtitle,
    fields,
    estimatedSeconds: estimate(fields),
    optional,
  };
}

const estimate = (gaps: readonly Gap[]): number =>
  gaps.reduce((sum, g) => sum + INPUT_SECONDS[g.field.input], 0);

/** "about 40 seconds" — shown on the step, because it beats a progress bar. */
export function humanEstimate(seconds: number): string {
  if (seconds < 45) return `about ${Math.max(15, Math.round(seconds / 5) * 5)} seconds`;
  const minutes = Math.round(seconds / 30) / 2;
  return minutes <= 1 ? "about a minute" : `about ${minutes} minutes`;
}

/** Value-framed progress: how many more people the remaining screens open up. */
export function peopleRemaining(steps: readonly IntakeStep[], fromIndex: number): number {
  return steps.slice(fromIndex).reduce(
    (sum, s) => sum + s.fields.reduce((n, g) => n + g.demandCount, 0), 0);
}
