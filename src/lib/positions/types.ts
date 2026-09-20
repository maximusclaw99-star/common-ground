export type PositionType = "internship" | "full_time" | "research";
export type RequirementKind = "skill" | "certification" | "degree" | "experience";

export interface PositionRequirement {
  requirement: string;
  kind: RequirementKind;
  /** true = the posting calls it required; false = preferred. */
  required: boolean;
}

/**
 * One opening. Dates are ISO `YYYY-MM-DD`. A source that carries no dates
 * (the internships directory) sets `datesKnown: false` and the UI says
 * "posted" instead of pretending to know a window.
 */
export interface Position {
  id: string;
  title: string;
  company: string;
  companyId: string | null;
  type: PositionType;
  /** swe | consulting | finance | accounting | engineering | operations | business | design | science | other */
  vertical: string;
  /** The source's own grouping, e.g. "Finance / Investment Banking". Null for the mock set. */
  category: string | null;
  location: string | null;
  opensOn: string;
  closesOn: string;
  /** False when opensOn/closesOn are stand-ins because the source has no dates. */
  datesKnown: boolean;
  /** The source flagged it as newly posted. */
  justPosted: boolean;
  targetGradYears: number[];
  description: string | null;
  url: string | null;
  /** From the posting when the source has text; otherwise typical for the category, and `requirementsTypical` is true. */
  requirements: PositionRequirement[];
  requirementsTypical: boolean;
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
