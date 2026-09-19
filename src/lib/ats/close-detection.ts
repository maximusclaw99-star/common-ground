/**
 * Deciding that a posting has CLOSED is the highest-risk inference in the app:
 * public ATS feeds list open roles only, so absence is the only closure signal
 * we get — and absence is indistinguishable from "we failed to look".
 *
 * Telling a student a live job is dead costs them the application, so every
 * rule here fails toward leaving a job open.
 */

export interface PollOutcome {
  companyId: string;
  /** False for ANY transport/parse failure. A throw is "unknown", never "empty". */
  ok: boolean;
  /** ATS job ids observed in this poll. Meaningless unless `ok`. */
  seenJobIds: ReadonlySet<string>;
  error?: string;
}

export interface TrackedJob {
  id: string;
  companyId: string;
  atsJobId: string;
  closedAt: Date | null;
}

export interface ClosureDecision {
  /** Job row ids to stamp with `closed_at = now`. */
  toClose: string[];
  /** Previously-closed jobs that reappeared in the feed; clear their closed_at. */
  toReopen: string[];
  /** Companies skipped by the empty-feed guard, for operator review. */
  suspiciousCompanies: Array<{ companyId: string; trackedOpen: number }>;
}

export interface ClosureOptions {
  /**
   * If a poll SUCCEEDS but returns zero jobs while we track at least this many
   * open roles for that company, treat it as a board glitch or a renamed slug
   * rather than a mass closure. Every such job would otherwise be closed at once.
   */
  emptyFeedGuardThreshold?: number;
}

export function resolveClosures(
  outcomes: readonly PollOutcome[],
  openJobs: readonly TrackedJob[],
  options: ClosureOptions = {},
): ClosureDecision {
  const { emptyFeedGuardThreshold = 3 } = options;

  const byCompany = new Map<string, PollOutcome>();
  for (const outcome of outcomes) byCompany.set(outcome.companyId, outcome);

  const trackedOpenCount = new Map<string, number>();
  for (const job of openJobs) {
    if (job.closedAt === null) {
      trackedOpenCount.set(job.companyId, (trackedOpenCount.get(job.companyId) ?? 0) + 1);
    }
  }

  const suspicious = new Set<string>();
  const suspiciousCompanies: ClosureDecision["suspiciousCompanies"] = [];
  for (const [companyId, outcome] of byCompany) {
    if (!outcome.ok) continue;
    const tracked = trackedOpenCount.get(companyId) ?? 0;
    if (outcome.seenJobIds.size === 0 && tracked >= emptyFeedGuardThreshold) {
      suspicious.add(companyId);
      suspiciousCompanies.push({ companyId, trackedOpen: tracked });
    }
  }

  const toClose: string[] = [];
  const toReopen: string[] = [];

  for (const job of openJobs) {
    const outcome = byCompany.get(job.companyId);

    // No poll this run, or the poll failed → we learned nothing. Leave it alone.
    if (!outcome || !outcome.ok) continue;
    if (suspicious.has(job.companyId)) continue;

    const present = outcome.seenJobIds.has(job.atsJobId);

    if (present && job.closedAt !== null) {
      toReopen.push(job.id);
    } else if (!present && job.closedAt === null) {
      toClose.push(job.id);
    }
  }

  return { toClose, toReopen, suspiciousCompanies };
}
