import { z } from "zod";

/**
 * DynamicHomophilyScorer — a direct port of the Python reference.
 *
 * Scores the strength of a potential referral connection by adding up shared
 * background factors, each worth a caller-chosen weight, and names every
 * factor that fired. Five factors: hometown, universities, clubs, academic
 * focus, past companies. Matching is exact after lowercasing, as in the
 * original; anything smarter (aliases, "VT" = "Virginia Tech") is the
 * adapter's job, not this class's — see ./adapter.ts.
 *
 * This is deliberately a second opinion next to the tier ladder in
 * src/lib/affinity: the ladder answers "what is the single best opener", this
 * answers "how much do we have in common, all told".
 */

export interface HomophilyProfile {
  hometown?: string;
  universities?: readonly string[];
  clubs?: readonly string[];
  academicFocus?: readonly string[];
  pastCompanies?: readonly string[];
}

export const HomophilyWeightsSchema = z.object({
  shared_company: z.number().min(0).max(100),
  shared_club: z.number().min(0).max(100),
  shared_academic_focus: z.number().min(0).max(100),
  shared_hometown: z.number().min(0).max(100),
  shared_university: z.number().min(0).max(100),
});
export type HomophilyWeights = z.infer<typeof HomophilyWeightsSchema>;

/** The reference weights: former coworkers highest, shared university the baseline. */
export const DEFAULT_WEIGHTS: HomophilyWeights = Object.freeze({
  shared_company: 30,
  shared_club: 20,
  shared_academic_focus: 15,
  shared_hometown: 10,
  shared_university: 5,
});

/** Student-facing labels for each weight, in the reference's order. */
export const WEIGHT_LABELS: readonly { key: keyof HomophilyWeights; label: string; hint: string }[] = [
  { key: "shared_company", label: "Shared past employer", hint: "High value for former coworkers" },
  { key: "shared_club", label: "Shared organisation", hint: "Micro-community alignment" },
  { key: "shared_academic_focus", label: "Shared academic focus", hint: "Cohort peer alignment" },
  { key: "shared_hometown", label: "Shared hometown", hint: "Geographic rapport" },
  { key: "shared_university", label: "Shared university", hint: "Macro-community baseline" },
];

export interface HomophilyResult {
  name: string;
  totalScore: number;
  /** One line per factor that fired, or the single "none found" line. */
  matchDrivers: string[];
}

export const NO_FACTORS = "No shared homophily factors found.";

/** Python's str.title(): every run of letters starts uppercase, rest lowercase. */
export const titleCase = (s: string): string =>
  s.replace(/[A-Za-zÀ-ɏ]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const lower = (xs: readonly string[] | undefined): string[] => (xs ?? []).map((x) => x.toLowerCase());

export class DynamicHomophilyScorer {
  private readonly anchorHometown: string;
  private readonly anchorUniversities: string[];
  private readonly anchorClubs: string[];
  private readonly anchorAcademicFocus: string[];
  private readonly anchorCompanies: string[];
  readonly weights: HomophilyWeights;

  constructor(userProfile: HomophilyProfile, customWeights: Partial<HomophilyWeights>) {
    // Normalise the anchor profile to lowercase for accurate matching.
    this.anchorHometown = (userProfile.hometown ?? "").toLowerCase();
    this.anchorUniversities = lower(userProfile.universities);
    this.anchorClubs = lower(userProfile.clubs);
    this.anchorAcademicFocus = lower(userProfile.academicFocus);
    this.anchorCompanies = lower(userProfile.pastCompanies);
    // A missing weight counts 0, exactly as `weights.get(key, 0)` did.
    this.weights = { ...zeroWeights(), ...customWeights };
  }

  scoreConnection(candidateName: string, candidate: HomophilyProfile = {}): HomophilyResult {
    const universities = lower(candidate.universities);
    const clubs = lower(candidate.clubs);
    const academicFocus = lower(candidate.academicFocus);
    const pastCompanies = lower(candidate.pastCompanies);
    const w = this.weights;

    let score = 0;
    const matchReasons: string[] = [];

    // 1. Geographic rapport
    if (candidate.hometown && candidate.hometown.toLowerCase() === this.anchorHometown) {
      score += w.shared_hometown;
      matchReasons.push(`Shared Hometown (+${w.shared_hometown})`);
    }

    // 2. Institutional alignment
    const sharedUnis = intersect(universities, this.anchorUniversities);
    if (sharedUnis.length) {
      score += w.shared_university * sharedUnis.length;
      for (const uni of sharedUnis) matchReasons.push(`Shared University: ${titleCase(uni)} (+${w.shared_university})`);
    }

    // 3. Micro-community / club alignment
    const sharedClubs = intersect(clubs, this.anchorClubs);
    if (sharedClubs.length) {
      score += w.shared_club * sharedClubs.length;
      for (const club of sharedClubs) matchReasons.push(`Shared Organization: ${titleCase(club)} (+${w.shared_club})`);
    }

    // 4. Academic cohort alignment
    const sharedFocus = intersect(academicFocus, this.anchorAcademicFocus);
    if (sharedFocus.length) {
      score += w.shared_academic_focus * sharedFocus.length;
      for (const focus of sharedFocus) matchReasons.push(`Shared Academic Focus: ${titleCase(focus)} (+${w.shared_academic_focus})`);
    }

    // 5. Professional / past company alignment
    const sharedCompanies = intersect(pastCompanies, this.anchorCompanies);
    if (sharedCompanies.length) {
      score += w.shared_company * sharedCompanies.length;
      for (const comp of sharedCompanies) matchReasons.push(`Shared Past Employer: ${titleCase(comp)} (+${w.shared_company})`);
    }

    return {
      name: candidateName,
      totalScore: score,
      matchDrivers: matchReasons.length ? matchReasons : [NO_FACTORS],
    };
  }
}

/**
 * Set intersection, as the reference does it — each shared value counts once
 * however many times it appears. Order follows the candidate's list so the
 * reasons read in a stable order (Python's set order is arbitrary).
 */
function intersect(candidate: readonly string[], anchor: readonly string[]): string[] {
  const wanted = new Set(anchor);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of candidate) {
    if (wanted.has(v) && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

const zeroWeights = (): HomophilyWeights => ({
  shared_company: 0, shared_club: 0, shared_academic_focus: 0, shared_hometown: 0, shared_university: 0,
});

export interface NamedCandidate extends HomophilyProfile { candidateName: string }

/** Scores every candidate and ranks them, highest total first; ties keep input order. */
export function rankConnections(scorer: DynamicHomophilyScorer, candidates: readonly NamedCandidate[]): HomophilyResult[] {
  return candidates
    .map((c) => scorer.scoreConnection(c.candidateName, c))
    .sort((a, b) => b.totalScore - a.totalScore);
}

/** The reference script's printout, for logs and tests. */
export function formatRanking(results: readonly HomophilyResult[]): string {
  return results.map((res, i) => [
    `Rank ${i + 1}: ${res.name} - Score: ${res.totalScore}`,
    ...res.matchDrivers.map((r) => `  -> ${r}`),
    "-".repeat(40),
  ].join("\n")).join("\n");
}
