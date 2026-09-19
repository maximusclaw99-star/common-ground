import type { ScorableStudent } from "@/lib/affinity/types";
import type { Position, RequirementKind } from "./types";

/**
 * What stands between a student and a posting: the skills and certifications
 * it lists that the student has not shown us. Degree and experience lines are
 * left out — we cannot honestly evaluate them from a resume and a questionnaire,
 * and a wrong "you lack the degree" is worse than silence.
 *
 * A certification the student is studying for is reported as in_progress, not
 * missing: the resume schema deliberately does not distinguish held from
 * in-progress ("studying for" counts), so the honest status is "underway".
 */
export interface Gap {
  requirement: string;
  kind: Extract<RequirementKind, "skill" | "certification">;
  required: boolean;
  status: "missing" | "in_progress";
}

const norm = (s: string) => s.trim().toLowerCase();

export function positionGaps(student: ScorableStudent, position: Position): Gap[] {
  const skills = new Set(student.profile.skills.map(norm));
  const certs = new Set([
    ...student.facts.certifications_in_progress,
    ...student.profile.affinity.certifications_in_progress,
  ].map(norm));

  const gaps: Gap[] = [];
  for (const r of position.requirements) {
    const key = norm(r.requirement);
    if (r.kind === "skill") {
      if (!skills.has(key)) gaps.push({ requirement: r.requirement, kind: "skill", required: r.required, status: "missing" });
    } else if (r.kind === "certification") {
      if (certs.has(key)) {
        gaps.push({ requirement: r.requirement, kind: "certification", required: r.required, status: "in_progress" });
      } else {
        gaps.push({ requirement: r.requirement, kind: "certification", required: r.required, status: "missing" });
      }
    }
  }
  // Hard blockers first, then certifications before skills (a cert is a
  // bigger ask), then alphabetical so the list is stable between renders.
  gaps.sort((a, b) =>
    Number(b.required) - Number(a.required)
    || (a.kind === b.kind ? 0 : a.kind === "certification" ? -1 : 1)
    || a.requirement.localeCompare(b.requirement));
  return gaps;
}

/** The single gap most worth advice on: a hard-required, still-missing certification if there is one. */
export function headlineGap(gaps: readonly Gap[]): Gap | null {
  return gaps.find((g) => g.required && g.status === "missing" && g.kind === "certification")
    ?? gaps.find((g) => g.required && g.status === "missing")
    ?? gaps.find((g) => g.status === "missing")
    ?? null;
}
