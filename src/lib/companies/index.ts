import manifest from "@/../public/logos/manifest.json";
import { canonical, sameEntity } from "@/lib/affinity/normalize";
import { findKnownCompany, slugify, type KnownCompany, type Sector } from "./registry";

export { KNOWN_COMPANIES, findKnownCompany, slugify } from "./registry";
export type { KnownCompany, Sector } from "./registry";

/** Slugs with a vendored logo under public/logos. Written by scripts/fetch-logos.ts. */
const LOGOS = new Set<string>(manifest as string[]);

export interface CompanyInfo {
  /** The display name — the registry's spelling when it knows the company. */
  name: string;
  slug: string;
  sector: Sector | null;
  /** Public path of the logo, or null: the UI then shows a monogram. */
  logo: string | null;
  known: boolean;
}

/**
 * Everything the UI needs to show a company, for any spelling of its name.
 * Unknown companies are first-class: they get a slug and a monogram, and the
 * name is shown exactly as the student typed it.
 */
export function companyInfo(name: string): CompanyInfo {
  const known: KnownCompany | undefined = findKnownCompany(name);
  const display = known?.name ?? name.trim();
  const slug = known?.slug ?? slugify(display);
  return {
    name: display,
    slug,
    sector: known?.sector ?? null,
    logo: LOGOS.has(slug) ? `/logos/${slug}.png` : null,
    known: Boolean(known),
  };
}

/**
 * Two spellings of the same employer. Registry aliases first ("BCG" and
 * "Boston Consulting Group"), then the affinity engine's own company
 * canonicalisation, which strips "Inc" and "LLP" and knows the same alias
 * tables the scorer uses — so the dashboard and the ranking agree on who
 * works where.
 */
export function sameCompany(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ka = findKnownCompany(a);
  const kb = findKnownCompany(b);
  if (ka && kb) return ka === kb;
  if (slugify(a) === slugify(b)) return true;
  return sameEntity("company", canonical("company", a), canonical("company", b));
}

/**
 * Turns a dashboard URL segment back into a company name, given the names it
 * could refer to. Candidates are checked before the registry so a student's
 * own spelling of a company wins over ours.
 */
export function resolveCompanySlug(slug: string, candidates: Iterable<string>): string | null {
  for (const name of candidates) {
    if (companyInfo(name).slug === slug) return name;
  }
  const known = findKnownCompany(slug);
  return known?.name ?? null;
}

/** Initials for the monogram tile: "Booz Allen Hamilton" → "BA". */
export function monogram(name: string): string {
  const words = name.replace(/[()]/g, " ").split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  const letters = words.slice(0, 2).map((w) => w[0]!.toUpperCase());
  return letters.join("") || "?";
}
