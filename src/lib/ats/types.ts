/**
 * Shared shape every ATS adapter normalizes to.
 *
 * `postedAt` comes from the source feed (Greenhouse `first_published`,
 * Lever `createdAt`, Ashby `publishedAt`) and is populated on every posting
 * in all three, so "when did this open" is exact from the first poll rather
 * than dependent on our own observation history.
 *
 * `explicitDeadline` is almost always null: the field exists in Greenhouse's
 * schema but employers do not fill it in. Real close dates are derived by the
 * poller (see lib/ats/close-detection.ts), not read from the feed.
 */
export interface NormalizedJob {
  atsJobId: string;
  title: string;
  location: string | null;
  descriptionText: string | null;
  applyUrl: string;
  postedAt: Date | null;
  updatedAt: Date | null;
  explicitDeadline: Date | null;
  employmentType: string | null;
  department: string | null;
  isRemote: boolean | null;
  raw: unknown;
}

export type AtsKind = "greenhouse" | "lever" | "ashby" | "workday";

/**
 * How to reach one employer's board. Greenhouse/Lever/Ashby need only a slug;
 * Workday is addressed by tenant + host shard + site, and one tenant can expose
 * several sites (PwC publishes experienced and campus roles separately).
 */
export interface BoardConfig {
  boardToken: string;
  workdayHost?: string | null;
  workdaySite?: string | null;
}

export interface AtsAdapter {
  readonly kind: AtsKind;
  /** Throws on transport/parse failure. Callers MUST treat a throw as
   *  "unknown", never as "this board has no jobs" — see close-detection. */
  fetchJobs(board: BoardConfig, signal?: AbortSignal): Promise<NormalizedJob[]>;
  /**
   * Optional second pass for feeds whose list view omits fields we need.
   * Workday's list gives no description and only a relative "Posted Today"
   * string, so detail must be fetched per job — expensive, hence opt-in:
   * the poller hydrates only new, entry-level postings.
   */
  hydrate?(board: BoardConfig, job: NormalizedJob, signal?: AbortSignal): Promise<NormalizedJob>;
}

export class AtsFetchError extends Error {
  constructor(
    readonly kind: AtsKind,
    readonly boardToken: string,
    message: string,
    readonly status?: number,
  ) {
    super(`[${kind}:${boardToken}] ${message}`);
    this.name = "AtsFetchError";
  }
}
