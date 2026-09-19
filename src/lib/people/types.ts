import type { Person } from "@/lib/affinity/types";

export interface PeopleQuery {
  /** Company names as the student wrote them; the provider canonicalises. */
  companies: readonly string[];
  limit?: number;
}

export interface PeopleProvider {
  readonly name: string;
  getPeople(query: PeopleQuery): Promise<Person[]>;
}
