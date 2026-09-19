import type { Person } from "@/lib/affinity/types";
import { getPeopleProvider } from "@/lib/people";
import { getPositionsProvider, type Position } from "@/lib/positions";
import { companyInfo, sameCompany, type CompanyInfo } from "./index";

export interface CompanySummary extends CompanyInfo {
  /** People at this company the engine can rank. */
  people: number;
  /** Openings there that are not yet closed. */
  openings: number;
}

export interface CompanyPool {
  people: Person[];
  positions: Position[];
  companies: CompanySummary[];
  peopleSource: string;
}

/**
 * Everyone and everything the providers can reach, folded by employer.
 *
 * The dashboard is company-first, so the first thing it needs is the list of
 * companies where there is anyone to write to. Counting from the provider
 * rather than a fixed list means a warehouse with 1,100 alumni shows the
 * companies they actually work at, and the demo cast shows its eleven.
 * Openings never block the page: if that provider fails, the counts are zero.
 */
export async function loadCompanyPool(targetCompanies: readonly string[]): Promise<CompanyPool> {
  const peopleProvider = getPeopleProvider();
  const [people, positions] = await Promise.all([
    peopleProvider.getPeople({ companies: targetCompanies, limit: 2000 }),
    getPositionsProvider().getPositions({ companies: targetCompanies, limit: 400 })
      .catch((err) => {
        console.warn("[dashboard] openings unavailable", err instanceof Error ? err.message : err);
        return [] as Position[];
      }),
  ]);

  const bySlug = new Map<string, CompanySummary>();
  const summary = (name: string): CompanySummary => {
    const info = companyInfo(name);
    let s = bySlug.get(info.slug);
    if (!s) {
      s = { ...info, people: 0, openings: 0 };
      bySlug.set(info.slug, s);
    }
    return s;
  };

  for (const p of people) if (p.currentCompany) summary(p.currentCompany).people += 1;
  const today = new Date().toISOString().slice(0, 10);
  for (const pos of positions) {
    if (pos.company && pos.closesOn >= today) summary(pos.company).openings += 1;
  }

  const companies = [...bySlug.values()].sort(
    (a, b) => b.people - a.people || b.openings - a.openings || a.name.localeCompare(b.name),
  );
  return { people, positions, companies, peopleSource: peopleProvider.name };
}

/** The people who work at `company`, by any spelling. */
export const peopleAt = (people: readonly Person[], company: string): Person[] =>
  people.filter((p) => sameCompany(p.currentCompany, company));

export const positionsAt = (positions: readonly Position[], company: string): Position[] =>
  positions.filter((p) => sameCompany(p.company, company));
