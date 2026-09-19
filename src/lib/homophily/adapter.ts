import { canonical, normalizeText } from "@/lib/affinity/normalize";
import type { Person } from "@/lib/affinity/types";
import type { StoredStudent } from "@/lib/session/demo-store";
import {
  DEFAULT_WEIGHTS, DynamicHomophilyScorer,
  type HomophilyProfile, type HomophilyResult, type HomophilyWeights,
} from "./scorer";

/**
 * Feeds the app's own data to the scorer.
 *
 * The scorer matches strings exactly after lowercasing, as the reference
 * does. Real data is messier — "VT", "Virginia Tech" and "Virginia
 * Polytechnic Institute and State University" are one school — so both sides
 * are pushed through the affinity engine's canonicaliser first, and the
 * scorer then compares canonical names. The reasons it writes come out as
 * "Shared University: Virginia Tech (+5)", which is what a student expects.
 */

type Kind = Parameters<typeof canonical>[0];

/** "virginia-tech" → "virginia tech": a canonical key the scorer can title-case. */
const name = (kind: Kind, raw: string | null | undefined): string | null => {
  const key = canonical(kind, raw).key;
  return key ? key.replace(/-/g, " ") : null;
};

const names = (kind: Kind, raws: readonly (string | null | undefined)[]): string[] =>
  [...new Set(raws.map((r) => name(kind, r)).filter((x): x is string => Boolean(x)))];

/** Fields of study have no alias table; text hygiene is the best we can do. */
const focus = (raws: readonly (string | null | undefined)[]): string[] =>
  [...new Set(raws.map((r) => (r ? normalizeText(r) : "")).filter(Boolean))];

export function studentHomophilyProfile(student: StoredStudent): HomophilyProfile {
  const { facts, profile } = student;
  const a = profile.affinity;
  return {
    hometown: name("place", facts.hometown) ?? "",
    universities: names("school", [facts.school_canonical, a.school_raw, profile.school]),
    clubs: names("org", [...facts.student_orgs, ...facts.greek, ...facts.programs, ...facts.communities]),
    academicFocus: focus([...facts.majors, ...facts.minors, ...a.majors, ...a.minors]),
    pastCompanies: names("company", [
      ...facts.prior_employers, ...profile.experience.map((e) => e.employer),
    ]),
  };
}

export function personHomophilyProfile(person: Person): HomophilyProfile {
  return {
    hometown: name("place", person.hometown) ?? "",
    universities: names("school", person.education.map((e) => e.school)),
    clubs: names("org", [...person.education.flatMap((e) => e.activities), ...person.communities]),
    academicFocus: focus(person.education.map((e) => e.field)),
    // "Past" includes where they are now: they have worked there.
    pastCompanies: names("company", [person.currentCompany, ...person.roles.map((r) => r.company)]),
  };
}

export interface RankedByHomophily extends HomophilyResult { personId: string }

/** Everyone scored against this student and ranked, highest total first. */
export function rankPeopleByHomophily(
  student: StoredStudent,
  people: readonly Person[],
  weights: HomophilyWeights = student.homophilyWeights ?? DEFAULT_WEIGHTS,
): RankedByHomophily[] {
  const scorer = new DynamicHomophilyScorer(studentHomophilyProfile(student), weights);
  return people
    .map((p) => ({ personId: p.id, ...scorer.scoreConnection(p.fullName, personHomophilyProfile(p)) }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

export function scorePersonByHomophily(student: StoredStudent, person: Person): HomophilyResult {
  return rankPeopleByHomophily(student, [person])[0];
}
