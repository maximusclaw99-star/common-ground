/**
 * The connection ladder, as data.
 *
 * Three reasons this is a table and not a switch statement: the outreach copy
 * has to be editable without touching matching logic; the band invariant is
 * *computed* from this table in a test rather than restated in one; and the UI
 * renders the whole ladder with the matched row highlighted.
 *
 * Ranks 1 and 6 need a private LinkedIn connection graph. We deliberately do
 * not collect one, so they stay here with `inScope: false` — the numbering
 * matches the source ladder, and the UI can show them greyed with the reason
 * rather than quietly renumbering and hoping nobody asks.
 */

export type TierId =
  | "linkedin_mutual"            // 1  — out of scope
  | "same_uni_same_org"          // 2
  | "same_uni_similar_path"      // 3
  | "shared_employer_context"    // 4
  | "hometown_or_school"         // 5
  | "linkedin_second_degree"     // 6  — out of scope
  | "specific_shared_interest"   // 7
  | "engageable_content"         // 8
  | "shared_event"               // 9
  | "one_step_ahead"             // 10
  | "same_function_only"         // 11
  | "broad_interest_only"        // 12
  | "no_connection";             // 13

export interface TierDecay {
  halfLifeDays: number;
  /** Below this freshness the hit is DISCARDED, not merely reduced. */
  floor: number;
  timing: string;
}

export interface TierDef {
  rank: number;
  id: TierId;
  inScope: boolean;
  label: string;
  /** Short line for the tier badge. */
  blurb: string;
  base: number;
  decay?: TierDecay;
  guidance: string;
  /** First-line template; {slots} are filled by the predicate that matched. */
  opener: string;
  /**
   * Some tiers match in genuinely different shapes — a shared employer reads
   * nothing like a shared client. Keeping the alternatives here rather than in
   * predicates.ts means every word a student sends still lives in one file.
   */
  variants?: Readonly<Record<string, string>>;
}

/** Ranks we can actually compute, strongest first. */
export const IN_SCOPE_RANKS = [2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13] as const;

/**
 * Band arithmetic — the load-bearing decision in this module.
 *
 * BAND is the distance between consecutive tier floors; SPAN is the largest
 * in-band bonus. Keeping SPAN < BAND means bands never overlap, so sorting by
 * `score` is *identical* to sorting by tier rank and the bonus can only ever
 * break ties inside a band. `bands never overlap` in tiers.test.ts asserts
 * this from the table — do not replace it with hardcoded numbers.
 */
export const BAND = 8;
export const SPAN = 7;

/** tier 2 -> [92,99], tier 3 -> [84,91], ... tier 13 -> [12,19] */
export const baseFor = (rank: number): number => {
  const i = IN_SCOPE_RANKS.indexOf(rank as (typeof IN_SCOPE_RANKS)[number]);
  return i < 0 ? 0 : 92 - i * BAND;
};

const OUT_OF_SCOPE_REASON =
  "Needs a private LinkedIn connection graph. We deliberately do not collect one.";

export const TIERS: readonly TierDef[] = Object.freeze<TierDef[]>([
  {
    rank: 1, id: "linkedin_mutual", inScope: false, base: 0,
    label: "Warm introduction from someone who knows you both",
    blurb: "The strongest route by far — the shared contact lends trust and context.",
    guidance: OUT_OF_SCOPE_REASON, opener: "",
  },
  {
    rank: 2, id: "same_uni_same_org", inScope: true, base: baseFor(2),
    label: "Same university and the same organisation or programme",
    blurb: "A shared school is strong; a smaller shared community is personal.",
    guidance: "Lead with the shared organisation by name, and ask what it was like when they were in it. Do not ask for anything in the first message.",
    opener: "I noticed you were also in {org} at {school}.",
  },
  {
    rank: 3, id: "same_uni_similar_path", inScope: true, base: baseFor(3),
    label: "Same university and a closely similar career path",
    blurb: "Most valuable when they already made the move you are trying to make.",
    guidance: "Ask about one specific transition or decision they made — not their whole career.",
    opener: "Fellow {school} grad — I'm trying to go from {from} to {to}, which looks like the move you made.",
  },
  {
    rank: 4, id: "shared_employer_context", inScope: true, base: baseFor(4),
    label: "Shared employer, client or programme",
    blurb: "Shared context gives a credible reason to write, even with no overlap.",
    guidance: "Shared context beats shared time. You do not have to have overlapped with them for this to be real.",
    opener: "I worked at {where} too — I saw you did as well.",
    variants: {
      employer: "I worked at {where} too — I saw you did as well.",
      client: "I've spent time on {where} as well, which is actually why I'm writing.",
      program: "I went through {where} too.",
    },
  },
  {
    rank: 5, id: "hometown_or_school", inScope: true, base: baseFor(5),
    label: "Same hometown, high school or local community",
    blurb: "Underused and surprisingly effective, especially with alumni.",
    guidance: "Say where you're from plainly. It disarms — don't over-explain it.",
    opener: "I saw we're both from {place}.",
    variants: {
      hometown: "I saw we're both from {place}.",
      high_school: "We both went to {place} — small world.",
      community: "I saw you're part of {place} too.",
    },
  },
  {
    rank: 6, id: "linkedin_second_degree", inScope: false, base: 0,
    label: "Shared mutual connection, without an introduction",
    blurb: "Still useful, but much weaker than an actual referral.",
    guidance: OUT_OF_SCOPE_REASON, opener: "",
  },
  {
    rank: 7, id: "specific_shared_interest", inScope: true, base: baseFor(7),
    label: "A specific shared professional interest or project",
    blurb: "Strong only when concrete — a real problem, not a field.",
    guidance: "Be concrete or don't send it. Name the problem, not the industry. Refer to a post, project, talk or technical domain.",
    opener: "I've been working on {topic} — I saw you've been close to it.",
  },
  {
    rank: 8, id: "engageable_content", inScope: true, base: baseFor(8),
    decay: { halfLifeDays: 10, floor: 0.125, timing: "best within two weeks of the post" },
    label: "They published something you can engage with",
    blurb: "A timely, authentic reason to write.",
    guidance: "Add a thoughtful observation about one specific claim they made. Disagreeing well is fine; summarising them back is not.",
    opener: "I read your {kind}, “{title}” — I've been circling the same question.",
    variants: {
      topical: "Your {kind} on {topic} — I've been working on the same problem from the other side.",
      untopical: "I read your {kind}, “{title}” — I'd like to ask you one thing about it.",
    },
  },
  {
    rank: 9, id: "shared_event", inScope: true, base: baseFor(9),
    decay: { halfLifeDays: 1.5, floor: 0.25, timing: "reach out within 24–72 hours" },
    label: "Same event, class or competition",
    blurb: "Legitimate, but it fades fast.",
    guidance: "This fades fast. Send within 24–72 hours or don't use it as the opener at all.",
    opener: "It was great hearing your perspective at {event}.",
  },
  {
    rank: 10, id: "one_step_ahead", inScope: true, base: baseFor(10),
    label: "Their role is exactly one step ahead of yours",
    blurb: "People help most when they recently walked the path themselves.",
    guidance: "They remember being you. Ask what the first ninety days actually looked like.",
    opener: "I'm exploring {function} and would value your perspective on how you got to {theirTitle}.",
  },
  {
    rank: 11, id: "same_function_only", inScope: true, base: baseFor(11),
    label: "Same function, industry or company — no personal overlap",
    blurb: "A viable cold message, but it needs stronger personalisation.",
    guidance: "There's no hook here, so be short and ask one well-formed question about their work or a career decision.",
    opener: "I'm heading into {function} and you're doing it at {company}.",
  },
  {
    rank: 12, id: "broad_interest_only", inScope: true, base: baseFor(12),
    label: "Same broad interest only",
    blurb: "Weak unless you make it far more specific first.",
    guidance: "Weak as written. Tie the interest to a concrete artefact or problem they care about before you send it.",
    opener: "We're both interested in {topic} — specifically, I've been looking at {narrow}.",
    variants: { bare: "We're both interested in {topic}, though I'd want to get more specific before writing." },
  },
  {
    rank: 13, id: "no_connection", inScope: true, base: baseFor(13),
    label: "No connection beyond wanting a job there",
    blurb: "It can work, but it is the lowest-quality basis for outreach.",
    guidance: "Seek perspective first; earn the right to ask later. Do not lead with a referral request.",
    opener: "I'm early in looking at {company} and would value fifteen minutes of your perspective.",
  },
]);

const BY_RANK = new Map(TIERS.map((t) => [t.rank, t]));
export const tierByRank = (rank: number): TierDef => {
  const t = BY_RANK.get(rank);
  if (!t) throw new Error(`No tier with rank ${rank}`);
  return t;
};

/** Importance of a tier as a 0..1 weight, used to order intake questions. */
export const tierWeight = (rank: number): number => {
  const i = IN_SCOPE_RANKS.indexOf(rank as (typeof IN_SCOPE_RANKS)[number]);
  return i < 0 ? 0 : 1 - i / IN_SCOPE_RANKS.length;
};
