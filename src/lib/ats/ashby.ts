import { AtsAdapter, AtsFetchError, NormalizedJob } from "./types";
import { htmlToText } from "./html";

interface AshbyJob {
  id: string;
  title: string;
  location?: string | null;
  department?: string | null;
  team?: string | null;
  employmentType?: string | null;
  publishedAt?: string | null;
  jobUrl?: string | null;
  applyUrl?: string | null;
  descriptionPlain?: string | null;
  descriptionHtml?: string | null;
  isListed?: boolean | null;
  isRemote?: boolean | null;
}

export const ashbyAdapter: AtsAdapter = {
  kind: "ashby",

  async fetchJobs({ boardToken }, signal) {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardToken)}`;

    const res = await fetch(url, { signal, headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new AtsFetchError("ashby", boardToken, `HTTP ${res.status}`, res.status);
    }

    const body = (await res.json()) as { jobs?: AshbyJob[] };
    if (!Array.isArray(body.jobs)) {
      throw new AtsFetchError("ashby", boardToken, "response had no `jobs` array");
    }

    return body.jobs
      // Ashby exposes unlisted postings; only listed ones are publicly open.
      .filter((job) => job.isListed !== false)
      .map<NormalizedJob>((job) => {
        const publishedAt = job.publishedAt ? new Date(job.publishedAt) : null;
        return {
          atsJobId: job.id,
          title: job.title.trim(),
          location: job.location?.trim() || null,
          descriptionText: job.descriptionPlain?.trim() || htmlToText(job.descriptionHtml),
          applyUrl: job.applyUrl || job.jobUrl || "",
          postedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
          updatedAt: null,
          explicitDeadline: null,
          employmentType: job.employmentType?.trim() || null,
          department: job.department?.trim() || job.team?.trim() || null,
          isRemote: job.isRemote ?? null,
          raw: job,
        };
      });
  },
};
