import type { AffinityFacts } from "@/lib/ai/schemas";
import { canonical, contentTokens, sameEntity, sharedPhrase, type CanonRef } from "./normalize";
import { SPECIFIC_ENOUGH, specificity } from "./specificity";
import { SENIORITY_LADDER, type Evidence, type Person, type ScorableStudent, type Seniority, type TierHit, type Unlockable } from "./types";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * No real data source populates a seniority field, but tier 10 ("exactly one
 * step ahead") is meaningless without an ordering. Same keyword-list shape as
 * jobs/entry-level.ts, and deliberately ordered most-senior-first so that
 * "Senior Manager" does not match on "Manager".
 */
const TITLE_LADDER: ReadonlyArray<[RegExp, Seniority]> = [
  [/\b(chief|cto|ceo|cfo|coo|cio|president)\b/i, "executive"],
  [/\bpartner\b/i, "partner"],
  [/\b(vp|vice president|head of)\b/i, "vp"],
  [/\bdirector\b/i, "director"],
  [/\b(senior|sr\.?)\s+manager\b/i, "senior_manager"],
  [/\bmanager\b/i, "manager"],
  [/\b(senior|sr\.?)\s+(associate|consultant|analyst|engineer|scientist)\b/i, "senior_associate"],
  [/\b(associate|consultant)\b/i, "associate"],
  [/\b(analyst|engineer|scientist|developer|designer)\b/i, "analyst"],
  [/\b(intern|internship|co-?op)\b/i, "intern"],
  [/\b(student|candidate|undergraduate)\b/i, "student"],
];

export function deriveSeniority(title: string | null | undefined): Seniority | null {
  if (!title) return null;
  for (const [re, level] of TITLE_LADDER) if (re.test(title)) return level;
  return null;
}

const rung = (s: Seniority | null): number => (s ? SENIORITY_LADDER.indexOf(s) : -1);

// ------------------------------------------------------------ student index

/**
 * Canonical forms of the student's facts, computed ONCE per ranking run.
 * rankPeople scores thousands of people; recomputing canonical refs inside the
 * per-person loop is the difference between 40ms and 4 seconds.
 */
export interface StudentIndex {
  school: CanonRef;
  orgs: CanonRef[];
  employers: CanonRef[];
  clients: CanonRef[];
  hometown: CanonRef;
  highSchool: CanonRef;
  communities: CanonRef[];
  targetCompanies: CanonRef[];
  /** technical_domains + public projects — the specific side. */
  domains: string[];
  /** interests — the possibly-vague side. */
  interests: string[];
  events: AffinityFacts["events"];
  transition: AffinityFacts["desired_transition"];
  targetFunction: string | null;
  targetSeniority: Seniority | null;
  /** Major / function / industry tokens, for the tier-3 path comparison. */
  pathTokens: Set<string>;
  employerYears: Map<string, [number, number]>;
}

const parseYear = (s: string | null): number | null => {
  if (!s) return null;
  const m = /(\d{4})/.exec(s);
  return m ? Number(m[1]) : null;
};

export function prepareStudent(student: ScorableStudent): StudentIndex {
  const f = student.facts;
  const canonAll = (kind: Parameters<typeof canonical>[0], xs: string[]) =>
    xs.map((x) => canonical(kind, x)).filter((c) => c.key);

  const employerYears = new Map<string, [number, number]>();
  for (const e of student.profile.experience ?? []) {
    const c = canonical("company", e.employer);
    if (!c.key) continue;
    const start = parseYear(e.start) ?? 0;
    const end = parseYear(e.end) ?? start;
    employerYears.set(c.key, [start, end]);
  }

  const pathTokens = new Set<string>();
  for (const t of [...f.majors, ...f.minors, ...f.target_roles, f.target_function ?? ""]) {
    for (const tok of contentTokens(t)) pathTokens.add(tok);
  }

  return {
    school: canonical("school", f.school_canonical),
    orgs: canonAll("org", [...f.student_orgs, ...f.greek, ...f.case_competitions, ...f.programs]),
    employers: canonAll("company", f.prior_employers),
    clients: canonAll("company", f.clients_and_programs),
    hometown: canonical("place", f.hometown),
    highSchool: canonical("school", f.high_school),
    communities: canonAll("org", f.communities),
    targetCompanies: canonAll("company", f.target_companies),
    domains: [...f.technical_domains, ...f.projects_public],
    interests: f.interests,
    events: f.events,
    transition: f.desired_transition,
    targetFunction: f.target_function,
    targetSeniority: (f.target_seniority as Seniority | null) ?? null,
    pathTokens,
    employerYears,
  };
}

// ---------------------------------------------------------------- helpers

const ev = (
  rank: number, kind: Evidence["kind"], label: string,
  studentValue: string, personValue: string, confidence: number, sourceField: string,
): Evidence => ({ rank, kind, label, studentValue, personValue, confidence, sourceField });

const pairConfidence = (a: CanonRef, b: CanonRef) =>
  a.how === "alias" && b.how === "alias" ? 1 : Math.min(a.confidence, b.confidence);

/** The person's education rows that are at the student's school. */
function schoolMatches(idx: StudentIndex, person: Person) {
  if (!idx.school.key) return [];
  return person.education
    .map((e, i) => ({ e, i, c: canonical("school", e.school) }))
    .filter(({ c }) => sameEntity("school", idx.school, c));
}

// ---------------------------------------------------------------- tier 2

export function tier2(idx: StudentIndex, person: Person): TierHit | null {
  const schools = schoolMatches(idx, person);
  if (!schools.length || !idx.orgs.length) return null;

  const evidence: Evidence[] = [];
  let anyAliasExact = false;

  for (const { e, i } of schools) {
    e.activities.forEach((activity, j) => {
      const pc = canonical("org", activity);
      const hit = idx.orgs.find((o) => sameEntity("org", o, pc));
      if (!hit) return;
      if (hit.how === "alias" && pc.how === "alias") anyAliasExact = true;
      evidence.push(ev(
        2, "org",
        `You were both in ${hit.display} at ${idx.school.display}`,
        hit.display, activity, pairConfidence(hit, pc),
        `person.education[${i}].activities[${j}]`,
      ));
    });
  }
  if (!evidence.length) return null;

  const strength = clamp01(0.6 + 0.15 * (evidence.length - 1) + (anyAliasExact ? 0.25 : 0));
  return {
    rank: 2, strength, freshness: 1, evidence,
    slots: { org: evidence[0].studentValue, school: idx.school.display },
  };
}

// ---------------------------------------------------------------- tier 3

export function tier3(idx: StudentIndex, person: Person): TierHit | null {
  const schools = schoolMatches(idx, person);
  if (!schools.length) return null;
  const school = schools[0].c;

  // Did they already make the exact jump the student wants to make?
  if (idx.transition) {
    const from = contentTokens(idx.transition.from);
    const to = contentTokens(idx.transition.to);
    const text = (r: Person["roles"][number]) =>
      contentTokens([r.title, r.function ?? "", r.industry ?? "", r.company].join(" "));

    const sorted = [...person.roles].sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0));
    const fromAt = sorted.findIndex((r) => from.some((t) => text(r).includes(t)));
    const toAt = sorted.findIndex((r) => to.some((t) => text(r).includes(t)));

    if (fromAt >= 0 && toAt > fromAt) {
      return {
        rank: 3, strength: 1, freshness: 1,
        slots: { school: idx.school.display, from: idx.transition.from, to: idx.transition.to },
        evidence: [ev(
          3, "role",
          `They made the same move you're making: ${idx.transition.from} to ${idx.transition.to}`,
          `${idx.transition.from} → ${idx.transition.to}`,
          `${sorted[fromAt].title} → ${sorted[toAt].title}`,
          0.9, `person.roles[${toAt}]`,
        )],
      };
    }
  }

  // Otherwise the path has to overlap concretely. "Closely similar career
  // path" describes everyone at a consultancy, so this gate is deliberately
  // tight: two shared non-generic tokens, or it demotes to tier 11.
  const current = person.roles.find((r) => r.endYear === null) ?? person.roles[0];
  const personPath = new Set([
    ...contentTokens(person.currentTitle ?? ""),
    ...contentTokens(person.currentFunction ?? ""),
    ...contentTokens(person.currentIndustry ?? ""),
    ...person.education.flatMap((e) => contentTokens(e.field ?? "")),
    ...(current ? contentTokens(current.function ?? "") : []),
  ]);
  const shared = [...idx.pathTokens].filter((t) => personPath.has(t));
  if (shared.length < 2) return null;

  return {
    rank: 3, strength: clamp01(0.5 + 0.1 * shared.length), freshness: 1,
    slots: {
      school: school.display,
      from: idx.pathTokens.size ? [...idx.pathTokens].slice(0, 2).join(" ") : "where I am",
      to: person.currentFunction ?? person.currentTitle,
    },
    evidence: [ev(
      3, "role",
      `Same path out of ${school.display}: ${shared.join(", ")}`,
      shared.join(", "), person.currentTitle, 0.85, "person.currentTitle",
    )],
  };
}

// ---------------------------------------------------------------- tier 4

export function tier4(idx: StudentIndex, person: Person): TierHit | null {
  let best: { strength: number; evidence: Evidence; variant: string; where: string } | null = null;
  const keep = (strength: number, evidence: Evidence, variant: string, where: string) => {
    if (!best || strength > best.strength) best = { strength, evidence, variant, where };
  };

  person.roles.forEach((role, i) => {
    // A named internal programme is the strongest form of this tier.
    role.programs.forEach((program, j) => {
      const pc = canonical("org", program);
      const hit = idx.clients.find((c) => sameEntity("org", c, pc));
      if (hit) {
        keep(1, ev(4, "client", `You were both in ${hit.display}`, hit.display, program,
          pairConfidence(hit, pc), `person.roles[${i}].programs[${j}]`), "program", hit.display);
      }
    });

    role.clients.forEach((client, j) => {
      const pc = canonical("company", client);
      const hit = idx.clients.find((c) => sameEntity("company", c, pc));
      if (hit) {
        keep(0.85, ev(4, "client", `You've both worked with ${hit.display}`, hit.display, client,
          pairConfidence(hit, pc), `person.roles[${i}].clients[${j}]`), "client", hit.display);
      }
    });

    const pc = canonical("company", role.company);
    const hit = idx.employers.find((c) => sameEntity("company", c, pc));
    if (hit) {
      const mine = idx.employerYears.get(hit.key);
      const overlapped = Boolean(
        mine && role.startYear && (role.endYear ?? 9999) >= mine[0] && role.startYear <= mine[1],
      );
      keep(overlapped ? 0.9 : 0.75, ev(
        4, "employer",
        overlapped
          ? `You were both at ${hit.display} at the same time`
          : `You've both worked at ${hit.display}`,
        hit.display, role.company, pairConfidence(hit, pc), `person.roles[${i}].company`,
      ), "employer", hit.display);
    }
  });

  if (!best) return null;
  const chosen: { strength: number; evidence: Evidence; variant: string; where: string } = best;
  return {
    rank: 4, strength: chosen.strength, freshness: 1, evidence: [chosen.evidence],
    variant: chosen.variant, slots: { where: chosen.where },
  };
}

// ---------------------------------------------------------------- tier 5

export function tier5(idx: StudentIndex, person: Person): TierHit | null {
  // High school is rarest and warmest, so it wins when present.
  if (idx.highSchool.key && person.highSchool) {
    const pc = canonical("school", person.highSchool);
    if (idx.highSchool.key === pc.key) {
      return {
        rank: 5, strength: 1, freshness: 1,
        variant: "high_school", slots: { place: person.highSchool },
        evidence: [ev(5, "place", `You went to the same high school — ${pc.display}`,
          idx.highSchool.display, person.highSchool, pairConfidence(idx.highSchool, pc), "person.highSchool")],
      };
    }
  }

  // Being from the same STATE is not a connection, so a state-only key refuses.
  if (idx.hometown.key && !idx.hometown.key.startsWith("state:") && person.hometown) {
    const pc = canonical("place", person.hometown);
    if (pc.key && !pc.key.startsWith("state:") && idx.hometown.key === pc.key) {
      return {
        rank: 5, strength: 0.95, freshness: 1,
        variant: "hometown", slots: { place: idx.hometown.display },
        evidence: [ev(5, "place", `You're both from ${pc.display}`,
          idx.hometown.display, person.hometown, pairConfidence(idx.hometown, pc), "person.hometown")],
      };
    }
  }

  for (let i = 0; i < person.communities.length; i += 1) {
    const pc = canonical("org", person.communities[i]);
    const hit = idx.communities.find((c) => sameEntity("org", c, pc));
    if (hit) {
      return {
        rank: 5, strength: 0.7, freshness: 1,
        variant: "community", slots: { place: hit.display },
        evidence: [ev(5, "place", `You're both part of ${hit.display}`,
          hit.display, person.communities[i], pairConfidence(hit, pc), `person.communities[${i}]`)],
      };
    }
  }
  return null;
}

// ------------------------------------------------------------- tiers 7 & 12

/**
 * 7 and 12 are one computation with a gate between them: the same overlap is
 * a strong hook when it is concrete and a weak one when it is not. Running
 * them together is what makes "we both like AI" land in 12 automatically
 * rather than needing a special case.
 */
export function tier7or12(idx: StudentIndex, person: Person): TierHit | null {
  const personSide = [
    ...person.interests.map((v, i) => ({ v, f: `person.interests[${i}]` })),
    ...person.projects.map((v, i) => ({ v, f: `person.projects[${i}]` })),
    ...person.posts.flatMap((p, i) => p.topics.map((v, j) => ({ v, f: `person.posts[${i}].topics[${j}]` }))),
  ];
  if (!personSide.length) return null;

  const studentSide = [
    ...idx.domains.map((v) => ({ v, specific: true })),
    ...idx.interests.map((v) => ({ v, specific: false })),
  ];

  let best: { score: number; evidence: Evidence; overlap: string; mine: string } | null = null;
  for (const mine of studentSide) {
    for (const theirs of personSide) {
      const overlap = sharedPhrase(mine.v, theirs.v);
      if (!overlap) continue;
      const score = specificity(overlap);
      if (best && score <= best.score) continue;
      const rank = score >= SPECIFIC_ENOUGH ? 7 : 12;
      best = {
        score, overlap, mine: mine.v,
        evidence: ev(
          rank, "interest",
          rank === 7
            ? `You're both close to ${overlap}`
            : `You share a broad interest in ${overlap} — narrow it before you write`,
          mine.v, theirs.v, score >= SPECIFIC_ENOUGH ? 0.9 : 0.6, theirs.f,
        ),
      };
    }
  }
  if (!best) return null;
  const chosen: { score: number; evidence: Evidence; overlap: string; mine: string } = best;
  const specific = chosen.score >= SPECIFIC_ENOUGH;
  // Tier 12's opener shows the student how to sharpen the vague overlap by
  // pointing at their own, more concrete phrasing of it.
  const narrow = chosen.mine !== chosen.overlap ? chosen.mine : "";
  return {
    rank: specific ? 7 : 12,
    strength: chosen.score, freshness: 1, evidence: [chosen.evidence],
    variant: specific ? undefined : (narrow ? undefined : "bare"),
    slots: { topic: specific ? chosen.mine : chosen.overlap, narrow },
  };
}

// ---------------------------------------------------------------- tier 8

export function tier8(idx: StudentIndex, person: Person): TierHit | null {
  if (!person.posts.length) return null;
  const topicsOfMine = [...idx.domains, ...idx.interests];

  // A post from someone at a target company is engageable even with no
  // topical overlap — it is a legitimate, timely reason to write.
  const atTarget = idx.targetCompanies.some((c) =>
    sameEntity("company", c, canonical("company", person.currentCompany)));

  type PostHit = { post: Person["posts"][number]; i: number; overlap: string | null; score: number };
  let best: PostHit | null = null;

  for (let i = 0; i < person.posts.length; i += 1) {
    const post = person.posts[i];
    const text = [post.title, post.excerpt ?? "", ...post.topics].join(" ");
    let overlap: string | null = null;
    for (const mine of topicsOfMine) {
      const o = sharedPhrase(mine, text);
      if (o && (!overlap || specificity(o) > specificity(overlap))) overlap = o;
    }
    if (!overlap && !atTarget) continue;

    const score = overlap ? Math.max(0.5, specificity(overlap)) : 0.5;
    if (best && Date.parse(post.publishedAt) <= Date.parse(best.post.publishedAt)) continue;
    best = { post, i, overlap, score };
  }
  if (!best) return null;

  const { post, i, overlap, score } = best;
  return {
    rank: 8, strength: score, freshness: 1, at: post.publishedAt,
    variant: overlap ? "topical" : "untopical",
    slots: { kind: post.kind, title: post.title, topic: overlap ?? post.title },
    evidence: [ev(
      8, "post",
      overlap
        ? `They published a ${post.kind} on ${overlap}`
        : `They recently published: “${post.title}”`,
      overlap ?? "", post.title, 0.9, `person.posts[${i}]`,
    )],
  };
}

// ---------------------------------------------------------------- tier 9

const DAY = 86_400_000;

export function tier9(idx: StudentIndex, person: Person): TierHit | null {
  if (!idx.events.length || !person.events.length) return null;

  type EventHit = { mine: string; theirs: Person["events"][number]; i: number };
  let best: EventHit | null = null;

  for (const mineEvent of idx.events) {
    const mc = canonical("org", mineEvent.name);
    for (let i = 0; i < person.events.length; i += 1) {
      const theirs = person.events[i];
      const tc = canonical("org", theirs.name);
      if (!sameEntity("org", mc, tc)) continue;
      // Same-named event in a different year is not the same event.
      const gap = Math.abs(Date.parse(mineEvent.date) - Date.parse(theirs.date));
      if (!Number.isFinite(gap) || gap > 2 * DAY) continue;
      if (best && Date.parse(theirs.date) <= Date.parse(best.theirs.date)) continue;
      best = { mine: mineEvent.name, theirs, i };
    }
  }
  if (!best) return null;

  const { mine, theirs, i } = best;
  return {
    rank: 9, strength: 1, freshness: 1, at: theirs.date,
    slots: { event: theirs.name },
    evidence: [ev(9, "event", `You were both at ${theirs.name}`, mine, theirs.name, 0.9, `person.events[${i}]`)],
  };
}

// --------------------------------------------------------------- tier 10

export function tier10(idx: StudentIndex, person: Person): TierHit | null {
  const theirs = person.currentSeniority ?? deriveSeniority(person.currentTitle);
  const mine = idx.targetSeniority ?? "analyst";
  if (!theirs) return null;
  if (rung(theirs) - rung(mine) !== 1) return null;

  const sameFunction = Boolean(
    idx.targetFunction && person.currentFunction &&
    contentTokens(idx.targetFunction).some((t) => contentTokens(person.currentFunction!).includes(t)),
  );
  // One rung ahead in a completely unrelated function is not "one step ahead
  // of you" — it is just a stranger with a bigger title, which is tier 11's
  // job. Only when we don't know the student's target function does the rung
  // gap stand on its own.
  if (idx.targetFunction && !sameFunction) return null;

  return {
    rank: 10, strength: sameFunction ? 1 : 0.8, freshness: 1,
    slots: { function: idx.targetFunction ?? "this path", theirTitle: person.currentTitle },
    evidence: [ev(
      10, "role",
      `They're exactly one step ahead of where you're starting — ${person.currentTitle}`,
      `${mine}${idx.targetFunction ? ` in ${idx.targetFunction}` : ""}`,
      person.currentTitle, 0.85, "person.currentTitle",
    )],
  };
}

// --------------------------------------------------------------- tier 11

export function tier11(idx: StudentIndex, person: Person): TierHit | null {
  const pc = canonical("company", person.currentCompany);
  const company = idx.targetCompanies.some((c) => sameEntity("company", c, pc));
  const fn = Boolean(
    idx.targetFunction && person.currentFunction &&
    contentTokens(idx.targetFunction).some((t) => contentTokens(person.currentFunction!).includes(t)),
  );
  const industry = person.currentIndustry
    ? [...idx.pathTokens].some((t) => contentTokens(person.currentIndustry!).includes(t))
    : false;
  if (!company && !fn && !industry) return null;

  const bits = [company && `at ${person.currentCompany}`, fn && `in ${person.currentFunction}`,
    industry && `in ${person.currentIndustry}`].filter(Boolean) as string[];

  return {
    rank: 11,
    strength: clamp01(0.4 + (company ? 0.2 : 0) + (fn ? 0.2 : 0) + (industry ? 0.2 : 0)),
    freshness: 1,
    slots: { function: idx.targetFunction ?? "your field", company: person.currentCompany },
    evidence: [ev(11, "role", `Same ground as you — ${bits.join(", ")}`,
      idx.targetFunction ?? "", person.currentTitle, 0.8, "person.currentCompany")],
  };
}

// ------------------------------------------------------------- unlockables

/**
 * Tiers this person WOULD have reached if the student had told us one more
 * thing. This is what lets the questionnaire say "we asked for your hometown
 * because eleven people at your target companies share one" instead of just
 * asserting that the field matters.
 */
export function findUnlockable(idx: StudentIndex, person: Person): Unlockable[] {
  const out: Unlockable[] = [];
  if (!idx.hometown.key && person.hometown) {
    out.push({ rank: 5, fieldId: "hometown", because: `${person.fullName} is from ${person.hometown}` });
  }
  if (!idx.highSchool.key && person.highSchool) {
    out.push({ rank: 5, fieldId: "high_school", because: `${person.fullName} went to ${person.highSchool}` });
  }
  if (!idx.orgs.length && person.education.some((e) => e.activities.length)) {
    const org = person.education.flatMap((e) => e.activities)[0];
    out.push({ rank: 2, fieldId: "student_orgs", because: `${person.fullName} was in ${org}` });
  }
  if (!idx.communities.length && person.communities.length) {
    out.push({ rank: 5, fieldId: "communities", because: `${person.fullName} is in ${person.communities[0]}` });
  }
  if (!idx.clients.length && person.roles.some((r) => r.clients.length || r.programs.length)) {
    const named = person.roles.flatMap((r) => [...r.clients, ...r.programs])[0];
    out.push({ rank: 4, fieldId: "clients_and_programs", because: `${person.fullName} worked on ${named}` });
  }
  if (!idx.events.length && person.events.length) {
    out.push({ rank: 9, fieldId: "events", because: `${person.fullName} was at ${person.events[0].name}` });
  }
  if (!idx.domains.length && (person.interests.length || person.posts.length)) {
    const topic = person.interests[0] ?? person.posts[0]?.title ?? "";
    out.push({ rank: 7, fieldId: "technical_domains", because: `${person.fullName} works on ${topic}` });
  }
  if (!idx.transition && person.roles.length > 1) {
    out.push({ rank: 3, fieldId: "desired_transition", because: `${person.fullName} has already changed paths once` });
  }
  return out;
}
