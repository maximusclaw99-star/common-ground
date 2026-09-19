import {
  COMPANY_ALIASES, COMPANY_SUFFIXES, ORG_ALIASES, PLACE_ALIASES, PLACE_NOISE,
  SCHOOL_ALIASES, SCHOOL_STOPWORDS, US_STATES,
} from "./aliases";

export type CanonKind = "school" | "company" | "org" | "place";

export interface CanonRef {
  /** "virginia-tech" — the thing predicates compare. */
  key: string;
  /** The raw input, kept for evidence copy. */
  display: string;
  how: "alias" | "derived" | "fuzzy" | "empty";
  confidence: number;
}

const EMPTY: CanonRef = { key: "", display: "", how: "empty", confidence: 0 };

/**
 * Pure functions of their input, called with the same few hundred strings over
 * and over while ranking thousands of people — company names, school names and
 * org names repeat constantly. Bounded so a long-running server cannot grow
 * these without limit.
 */
const MAX_CACHE = 5000;
function memo<T>(cache: Map<string, T>, key: string, compute: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(key, value);
  return value;
}

const normalizeCache = new Map<string, string>();
const canonicalCache = new Map<string, CanonRef>();
const tokenCache = new Map<string, string[]>();

/** Stage 1: text hygiene. Lossless enough that nothing distinct collapses here. */
export function normalizeText(s: string): string {
  return memo(normalizeCache, s, () => normalizeTextUncached(s));
}

function normalizeTextUncached(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")     // strip diacritics
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")          // "Virginia Tech (Blacksburg, VA)" -> "Virginia Tech"
    .replace(/&/g, " and ")
    .replace(/[._'’`]/g, "")             // "U.S." -> "us", "don't" -> "dont"
    .replace(/[^a-z0-9,]+/g, " ")        // keep commas: place parsing needs them
    .replace(/\s+/g, " ")
    .trim();
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const ALIAS_TABLES: Record<CanonKind, Readonly<Record<string, string>>> = {
  school: SCHOOL_ALIASES,
  company: COMPANY_ALIASES,
  org: ORG_ALIASES,
  place: PLACE_ALIASES,
};

/** Splits on whitespace; commas are structural and handled by the place branch. */
const words = (s: string) => s.replace(/,/g, " ").split(" ").filter(Boolean);

/**
 * Places key on city AND state, so "Richmond, VA" never matches "Richmond, CA".
 * A state-only value ("Virginia") keys as `state:va` and tier 5 refuses to fire
 * on it — being from the same state is not a connection.
 */
function placeKey(normalized: string): string {
  const parts = normalized.split(",").map((p) => p.trim()).filter(Boolean);
  const clean = (p: string) => words(p).filter((w) => !PLACE_NOISE.has(w));

  if (parts.length >= 2) {
    const city = clean(parts[0]);
    const tail = clean(parts.slice(1).join(" ")).join(" ");
    const state = US_STATES[tail] ?? (tail.length === 2 ? tail : "");
    if (city.length && state) return `${slug(city.join(" "))}-${state}`;
    if (city.length) return slug(city.join(" "));
    return slug(tail);
  }

  // No comma: either a bare state, or a city we cannot pin to one.
  const tokens = clean(normalized);
  const joined = tokens.join(" ");
  if (US_STATES[joined]) return `state:${US_STATES[joined]}`;
  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    const state = US_STATES[last] ?? (last.length === 2 && /^[a-z]{2}$/.test(last) ? last : "");
    if (state) return `${slug(tokens.slice(0, -1).join(" "))}-${state}`;
  }
  return slug(joined);
}

export function canonical(kind: CanonKind, raw: string | null | undefined): CanonRef {
  if (!raw || !raw.trim()) return EMPTY;
  return memo(canonicalCache, `${kind}\u0000${raw}`, () => canonicalUncached(kind, raw));
}

function canonicalUncached(kind: CanonKind, raw: string): CanonRef {
  const display = raw.trim();
  const normalized = normalizeText(raw);
  if (!normalized) return EMPTY;

  const alias = ALIAS_TABLES[kind][normalized];
  if (alias) return { key: alias, display, how: "alias", confidence: 1 };

  // Strip the noise words for this kind, then TRY THE ALIAS TABLE AGAIN before
  // falling back to a derived key. "Deloitte Consulting LLP" is not in the
  // table, but "deloitte consulting" is — and a company that resolves under
  // one spelling and not another silently splits a real tier-4 match in two.
  let cleaned = normalized;
  switch (kind) {
    case "school":
      cleaned = words(normalized).filter((w) => !SCHOOL_STOPWORDS.has(w)).join(" ");
      break;
    case "company":
      cleaned = words(normalized).filter((w) => !COMPANY_SUFFIXES.has(w)).join(" ");
      break;
    default:
      break;
  }

  if (cleaned !== normalized) {
    const second = ALIAS_TABLES[kind][cleaned];
    if (second) return { key: second, display, how: "alias", confidence: 1 };
  }

  const key = kind === "place" ? placeKey(normalized) : slug(cleaned);

  // A stopword-only input would key as "" and then match every other empty.
  return { key: key || slug(normalized), display, how: "derived", confidence: 0.85 };
}

const GENERIC_TOKENS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "in", "on", "at", "to", "with",
  "club", "society", "association", "organization", "organisation", "group",
  "student", "team", "program", "programme", "chapter", "national", "international",
]);

const STOPWORDS = new Set([
  ...GENERIC_TOKENS, "i", "my", "we", "our", "is", "are", "was", "were", "be",
  "been", "it", "that", "this", "these", "those", "as", "by", "from", "about",
  "into", "over", "using", "used", "use", "work", "working", "worked", "like",
  "really", "very", "some", "more", "also", "but", "so", "how", "what",
]);

/** NOTE: the returned array is shared. Read it; never mutate it in place. */
export const contentTokens = (s: string): string[] =>
  memo(tokenCache, s, () =>
    normalizeText(s).replace(/,/g, " ").split(" ").filter((t) => t && !STOPWORDS.has(t)));

/** Jaccard over content tokens. */
export function tokenSetSimilarity(a: string, b: string): number {
  const A = new Set(contentTokens(a));
  const B = new Set(contentTokens(b));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared += 1;
  return shared / (A.size + B.size - shared);
}

export const FUZZY_THRESHOLD = 0.8;

/**
 * Fuzzy equality, deliberately restricted.
 *
 * Allowed for `org` and `company` only. NEVER for `school`: "University of
 * Virginia" and "Virginia Tech" share the token "virginia", and a matcher that
 * happily calls them the same place torches the top two tiers — the most
 * expensive error this product can make. Canonical school names come from a
 * select box backed by the alias table, so the student half is always exact
 * and only the person half ever needs resolving.
 */
export function fuzzyMatches(kind: CanonKind, a: string, b: string): boolean {
  if (kind === "school" || kind === "place") return false;
  const A = contentTokens(a).filter((t) => !GENERIC_TOKENS.has(t));
  const B = contentTokens(b).filter((t) => !GENERIC_TOKENS.has(t));
  if (!A.length || !B.length) return false;
  return tokenSetSimilarity(A.join(" "), B.join(" ")) >= FUZZY_THRESHOLD;
}

/** Two canonical refs agree, by key or by a permitted fuzzy match. */
export function sameEntity(kind: CanonKind, a: CanonRef, b: CanonRef): boolean {
  if (!a.key || !b.key) return false;
  if (a.key === b.key) return true;
  return fuzzyMatches(kind, a.display, b.display);
}

/**
 * The overlap between two free-text interests, or null when they do not really
 * overlap. Scoring the OVERLAP rather than either side is what makes the
 * specificity rule hold: student says "responsible AI deployment for
 * public-sector clients", person says "AI", the overlap is just "ai" — which
 * is weak, and lands the pair in tier 12 where it belongs.
 */
export function sharedPhrase(a: string, b: string): string | null {
  const A = contentTokens(a);
  const B = new Set(contentTokens(b));
  const overlap = A.filter((t) => B.has(t));
  if (!overlap.length) return null;
  const rare = overlap.filter((t) => !GENERIC_TOKENS.has(t));
  if (overlap.length < 2 && !rare.length) return null;
  return [...new Set(overlap)].join(" ");
}

/** For the near-miss report: pairs that ALMOST matched, so aliases get added. */
export function nearMiss(a: string, b: string): boolean {
  const s = tokenSetSimilarity(a, b);
  return s >= 0.5 && s < FUZZY_THRESHOLD;
}
