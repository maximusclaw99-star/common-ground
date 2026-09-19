/**
 * Cheap pre-LLM filter deciding which postings are plausibly for students.
 *
 * Deliberately tuned to over-include: a false positive costs one row in a
 * candidate set the matcher will rank anyway, while a false negative means a
 * student never sees a job they were eligible for. Seniority markers are the
 * only hard exclusions.
 */

const SENIOR = [
  "senior", "sr.", "staff", "principal", "lead ", "head of", "director",
  "vp ", "vice president", "chief", "manager", "architect", "fellow",
  "distinguished", "executive",
];

const ENTRY_TITLE = [
  "intern", "internship", "co-op", "coop", "new grad", "new graduate",
  "university grad", "campus", "entry level", "entry-level", "graduate program",
  "rotational", "apprentice", "trainee", "early career", "associate",
  "analyst", "junior", "jr.", " i", " 1",
];

const ENTRY_BODY = [
  "new grad", "recent graduate", "graduating", "entry level", "entry-level",
  "0-2 years", "0-1 year", "1-2 years", "no prior experience",
  "currently enrolled", "pursuing a bachelor", "pursuing a master",
  "final year", "class of 20",
];

const YEARS = /(\d+)\+?\s*(?:-\s*\d+\s*)?years?(?:\s+of)?\s+(?:relevant\s+|professional\s+|industry\s+)?experience/gi;

/** Highest "N years experience" figure demanded anywhere in the text. */
export function maxYearsRequired(text: string): number | null {
  let max: number | null = null;
  for (const m of text.matchAll(YEARS)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && (max === null || n > max)) max = n;
  }
  return max;
}

export function classifyEntryLevel(input: {
  title: string;
  description?: string | null;
}): { isEntryLevel: boolean; reason: string } {
  const title = input.title.toLowerCase();
  const body = (input.description ?? "").toLowerCase();

  // "Senior Analyst" must not pass on the strength of "analyst".
  const senior = SENIOR.find((k) => title.includes(k));
  if (senior) return { isEntryLevel: false, reason: `senior marker in title: "${senior.trim()}"` };

  const titleHit = ENTRY_TITLE.find((k) => title.includes(k));
  if (titleHit) return { isEntryLevel: true, reason: `entry marker in title: "${titleHit.trim()}"` };

  const years = maxYearsRequired(body);
  if (years !== null && years >= 4) {
    return { isEntryLevel: false, reason: `requires ${years}+ years experience` };
  }

  const bodyHit = ENTRY_BODY.find((k) => body.includes(k));
  if (bodyHit) return { isEntryLevel: true, reason: `entry signal in body: "${bodyHit}"` };

  if (years !== null && years <= 2) {
    return { isEntryLevel: true, reason: `asks for only ${years} years experience` };
  }

  return { isEntryLevel: false, reason: "no entry-level signal" };
}
