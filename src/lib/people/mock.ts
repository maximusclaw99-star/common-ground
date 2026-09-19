import { canonical, sameEntity } from "@/lib/affinity/normalize";
import { cast } from "@/lib/affinity/__fixtures__/cast";
import type { Person } from "@/lib/affinity/types";
import type { PeopleProvider, PeopleQuery } from "./types";

/**
 * The stage-safe provider: the same eleven people the ladder test asserts on.
 * If the demo drifts from the test, the test breaks — which is the point.
 */
export const mockPeopleProvider: PeopleProvider = {
  name: "mock",
  async getPeople({ companies, limit }: PeopleQuery): Promise<Person[]> {
    if (!companies.length) return [...cast].slice(0, limit);
    const wanted = companies.map((c) => canonical("company", c));
    const matched = cast.filter((p) =>
      wanted.some((w) => sameEntity("company", w, canonical("company", p.currentCompany))));
    // People outside the target list still matter — a shared fraternity is a
    // shared fraternity wherever they work — so they are ranked, not filtered.
    const rest = cast.filter((p) => !matched.includes(p));
    return [...matched, ...rest].slice(0, limit);
  },
};
