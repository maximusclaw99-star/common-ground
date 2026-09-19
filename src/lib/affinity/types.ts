import type { AffinityFacts, StudentProfile } from "@/lib/ai/schemas";

/**
 * A rung on the career ladder. Tier 10 ("exactly one step ahead") is unusable
 * without an ordering, and no real data source populates one, so titles are
 * mapped onto this scale by `deriveSeniority`.
 */
export type Seniority =
  | "student" | "intern" | "analyst" | "associate" | "senior_associate"
  | "manager" | "senior_manager" | "director" | "vp" | "partner" | "executive";

export const SENIORITY_LADDER: readonly Seniority[] = [
  "student", "intern", "analyst", "associate", "senior_associate",
  "manager", "senior_manager", "director", "vp", "partner", "executive",
];

/** Tiers 2 and 3: the campus surface. */
export interface PersonEducation {
  school: string;
  degree: string | null;
  field: string | null;
  startYear: number | null;
  endYear: number | null;
  /** Clubs, student orgs, Greek letters, case-competition teams, honour societies. */
  activities: string[];
}

/** Tiers 3, 4, 10, 11: the work surface. */
export interface PersonRole {
  company: string;
  title: string;
  function: string | null;
  industry: string | null;
  seniority: Seniority | null;
  startYear: number | null;
  /** null means current. */
  endYear: number | null;
  /** Named clients, accounts or agencies. Tier 4 fires on these with no date overlap. */
  clients: string[];
  /** Named internal programmes: "Deloitte Analyst Program", "Databricks University". */
  programs: string[];
}

/** Tier 8. */
export interface PersonPost {
  id: string;
  kind: "post" | "article" | "talk" | "podcast" | "paper" | "press";
  title: string;
  excerpt: string | null;
  topics: string[];
  url: string | null;
  /** ISO 8601 — the decay clock for tier 8. */
  publishedAt: string;
}

/** Tier 9. */
export interface PersonEvent {
  name: string;
  kind: "conference" | "recruiting_event" | "webinar" | "case_competition" | "class" | "career_fair";
  /** ISO 8601 — the decay clock for tier 9. */
  date: string;
  org: string | null;
}

/**
 * Every field here exists because some in-scope tier cannot be computed
 * without it. Collections are non-optional and may be empty: an optional
 * array means every predicate needs a `?? []` and one will be forgotten.
 */
export interface Person {
  id: string;
  fullName: string;
  headline: string | null;
  profileUrl: string | null;
  /** Headshot, or null for initials. A path under public/ or a full URL. */
  photoUrl: string | null;
  /** Work email when the source has one. Shown, never sent to — the product's whole point. */
  email: string | null;

  currentCompany: string;
  currentTitle: string;
  currentFunction: string | null;
  currentIndustry: string | null;
  currentSeniority: Seniority | null;

  /** Where they are now. */
  location: string | null;
  /**
   * Where they are *from*. Separate from `location` on purpose: conflating the
   * two produces the most embarrassing false positive available to this
   * product — "you're both from San Francisco!" when in fact they moved there.
   */
  hometown: string | null;
  highSchool: string | null;
  /** ROTC, a church, a hometown youth programme, a rec league. */
  communities: string[];

  education: PersonEducation[];
  roles: PersonRole[];

  interests: string[];
  projects: string[];
  posts: PersonPost[];
  events: PersonEvent[];

  /** Provider name, so the debug panel can show provenance. */
  source: string;
  /** ISO — honesty about how stale the decay clocks are. */
  fetchedAt: string;
}

export interface ScorableStudent {
  profile: StudentProfile;
  facts: AffinityFacts;
}

export type EvidenceKind =
  | "school" | "org" | "employer" | "client" | "place"
  | "interest" | "post" | "event" | "role";

export interface Evidence {
  rank: number;
  kind: EvidenceKind;
  /** Human sentence for the UI: "Both in Beta Alpha Psi at Virginia Tech". */
  label: string;
  studentValue: string;
  personValue: string;
  /** 1.0 alias-exact, 0.85 derived, 0.65 fuzzy. */
  confidence: number;
  /** "person.education[0].activities[2]" — provenance for the debug panel. */
  sourceField: string;
}

export interface TierHit {
  rank: number;
  /** 0..1 — how good *this instance* of this tier is. */
  strength: number;
  /**
   * 0..1 — 1 for tiers that do not decay. Predicates for decaying tiers leave
   * this at 1 and set `at`; score.ts owns the clock so that no predicate ever
   * reads Date.now() and makes the demo time-dependent.
   */
  freshness: number;
  /** ISO timestamp this hit decays from. Only set for tiers 8 and 9. */
  at?: string;
  /**
   * Values for the {slots} in the tier's opener. The predicate fills these
   * because only the predicate knows what its own evidence means — deriving
   * them generically from Evidence produces sentences like "in Beta Alpha Psi
   * at Beta Alpha Psi".
   */
  slots?: Record<string, string>;
  /** Picks a tier `variants` template; falls back to `opener`. */
  variant?: string;
  evidence: Evidence[];
}

/** A tier this person WOULD have reached if the student had supplied one fact. */
export interface Unlockable {
  rank: number;
  fieldId: string;
  /** "she's from Richmond, VA" — shown to justify the question. */
  because: string;
}

export interface AffinityResult {
  personId: string;
  rank: number;
  tierId: string;
  tierLabel: string;
  score: number;
  evidence: Evidence[];
  outreach: { guidance: string; opener: string; timing: string | null };
  /** Debug panel only. */
  components: { strength: number; freshness: number; corroboration: number; base: number };
  unlockable: Unlockable[];
}

/** Aggregated `unlockable` across a whole ranking, for question ordering. */
export interface UnlockDemand {
  fieldId: string;
  rank: number;
  count: number;
  /** A couple of real examples, for the question's subtitle. */
  examples: string[];
}
