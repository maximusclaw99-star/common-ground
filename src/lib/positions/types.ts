export type PositionType = "internship" | "full_time" | "research";
export type RequirementKind = "skill" | "certification" | "degree" | "experience";

export interface PositionRequirement {
  requirement: string;
  kind: RequirementKind;
  /** true = the posting calls it required; false = preferred. */
  required: boolean;
}

/**
 * One opening. Dates are ISO `YYYY-MM-DD`; the window is what the product is
 * about, so both ends are mandatory even when a source only knows one and we
 * had to assume the other.
 */
export interface Position {
  id: string;
  title: string;
  company: string;
  companyId: string | null;
  type: PositionType;
  /** swe | consulting | finance — the launch verticals. */
  vertical: string;
  location: string | null;
  opensOn: string;
  closesOn: string;
  targetGradYears: number[];
  description: string | null;
  url: string | null;
  requirements: PositionRequirement[];
  /** Provider name, for the status footer. */
  source: string;
}

export interface PositionsQuery {
  /** Company names as the student wrote them; used to order, never to filter. */
  companies: readonly string[];
  limit?: number;
}

export interface PositionsProvider {
  readonly name: string;
  getPositions(query: PositionsQuery): Promise<Position[]>;
}
