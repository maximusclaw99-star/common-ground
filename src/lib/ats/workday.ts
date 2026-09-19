import { AtsAdapter, AtsFetchError, BoardConfig, NormalizedJob } from "./types";
import { htmlToText } from "./html";

/**
 * Workday is the only source here that consulting firms actually use, and it
 * is the weakest of the four:
 *  - the list endpoint is POST, hard-capped at 20 results per page, and
 *    SILENTLY returns zero postings for any limit above 20;
 *  - it carries no description and only a relative date ("Posted Today");
 *  - exact `startDate`, the apply URL and the body live on a per-job detail
 *    endpoint, so those need `hydrate()`.
 */

const PAGE_SIZE = 20; // Hard cap. Raising this returns an empty list, not an error.
const MAX_PAGES = 400;

interface WorkdayListPosting {
  title: string;
  externalPath: string;
  locationsText?: string | null;
  postedOn?: string | null;
  timeType?: string | null;
  bulletFields?: string[] | null;
}

function requireWorkday(board: BoardConfig): { tenant: string; host: string; site: string } {
  const { boardToken: tenant, workdayHost: host, workdaySite: site } = board;
  if (!host || !site) {
    throw new AtsFetchError(
      "workday",
      tenant,
      "workdayHost and workdaySite are required (e.g. wd3 / Global_Campus_Careers)",
    );
  }
  return { tenant, host, site };
}

const base = (t: string, h: string, s: string) =>
  `https://${t}.${h}.myworkdayjobs.com/wday/cxs/${t}/${s}`;

/**
 * Coarse fallback only, used until a posting is hydrated. Workday says things
 * like "Posted Today", "Posted 3 Days Ago", "Posted 30+ Days Ago".
 */
export function parseRelativePostedOn(text: string | null | undefined, now: Date): Date | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("today")) return now;
  if (t.includes("yesterday")) return new Date(now.getTime() - 86_400_000);
  const m = t.match(/(\d+)\+?\s*day/);
  if (m) return new Date(now.getTime() - Number(m[1]) * 86_400_000);
  return null;
}

export const workdayAdapter: AtsAdapter = {
  kind: "workday",

  async fetchJobs(board, signal) {
    const { tenant, host, site } = requireWorkday(board);
    const endpoint = `${base(tenant, host, site)}/jobs`;
    const now = new Date();

    const jobs: NormalizedJob[] = [];
    let offset = 0;
    // `total` is reported on the FIRST page only; later pages say total: 0 while
    // still returning results. Trusting the per-page value truncates the board.
    let reportedTotal: number | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetch(endpoint, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ limit: PAGE_SIZE, offset, searchText: "" }),
      });
      if (!res.ok) {
        throw new AtsFetchError("workday", tenant, `HTTP ${res.status} at offset ${offset}`, res.status);
      }

      const body = (await res.json()) as { jobPostings?: WorkdayListPosting[]; total?: number };
      const batch = body.jobPostings;
      if (!Array.isArray(batch)) {
        throw new AtsFetchError("workday", tenant, "response had no `jobPostings` array");
      }
      if (batch.length === 0) break;
      if (reportedTotal === null && typeof body.total === "number" && body.total > 0) {
        reportedTotal = body.total;
      }

      for (const p of batch) {
        jobs.push({
          // externalPath is stable per requisition and unique within a site.
          atsJobId: p.externalPath,
          title: p.title.trim(),
          location: p.locationsText?.trim() || null,
          descriptionText: null, // list view carries none — see hydrate()
          applyUrl: `https://${tenant}.${host}.myworkdayjobs.com/${site}${p.externalPath}`,
          postedAt: parseRelativePostedOn(p.postedOn, now),
          updatedAt: null,
          explicitDeadline: null,
          employmentType: p.timeType?.trim() || null,
          department: null,
          isRemote: null,
          raw: p,
        });
      }

      offset += batch.length;
      if (reportedTotal !== null && offset >= reportedTotal) break;
    }

    return jobs;
  },

  async hydrate(board, job, signal) {
    const { tenant, host, site } = requireWorkday(board);
    const res = await fetch(`${base(tenant, host, site)}${job.atsJobId}`, {
      signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      throw new AtsFetchError("workday", tenant, `detail HTTP ${res.status}`, res.status);
    }

    const info = ((await res.json()) as { jobPostingInfo?: Record<string, unknown> })
      .jobPostingInfo;
    if (!info) throw new AtsFetchError("workday", tenant, "detail had no `jobPostingInfo`");

    const startDate = typeof info.startDate === "string" ? new Date(info.startDate) : null;
    // `endDate` exists in the schema; like Greenhouse's application_deadline it
    // is essentially always null, so it is read but never depended on.
    const endDate = typeof info.endDate === "string" ? new Date(info.endDate) : null;
    const ok = (d: Date | null) => (d && !Number.isNaN(d.getTime()) ? d : null);

    return {
      ...job,
      descriptionText:
        htmlToText(typeof info.jobDescription === "string" ? info.jobDescription : null) ??
        job.descriptionText,
      applyUrl: typeof info.externalUrl === "string" ? info.externalUrl : job.applyUrl,
      postedAt: ok(startDate) ?? job.postedAt,
      explicitDeadline: ok(endDate),
      location: typeof info.location === "string" ? info.location : job.location,
      raw: info,
    };
  },
};
