import { AtsAdapter, AtsFetchError, NormalizedJob } from "./types";
import { htmlToText } from "./html";

interface GreenhouseJob {
  id: number;
  title: string;
  location?: { name?: string | null } | null;
  absolute_url: string;
  content?: string | null;
  first_published?: string | null;
  updated_at?: string | null;
  application_deadline?: string | null;
  departments?: Array<{ name?: string | null }> | null;
}

const parseDate = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const greenhouseAdapter: AtsAdapter = {
  kind: "greenhouse",

  async fetchJobs({ boardToken }, signal) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
      boardToken,
    )}/jobs?content=true`;

    const res = await fetch(url, { signal, headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new AtsFetchError("greenhouse", boardToken, `HTTP ${res.status}`, res.status);
    }

    const body = (await res.json()) as { jobs?: GreenhouseJob[] };
    if (!Array.isArray(body.jobs)) {
      throw new AtsFetchError("greenhouse", boardToken, "response had no `jobs` array");
    }

    return body.jobs.map<NormalizedJob>((job) => ({
      atsJobId: String(job.id),
      title: job.title,
      location: job.location?.name?.trim() || null,
      // Greenhouse ships content HTML-entity-encoded; htmlToText handles it.
      descriptionText: htmlToText(job.content),
      applyUrl: job.absolute_url,
      postedAt: parseDate(job.first_published),
      updatedAt: parseDate(job.updated_at),
      // Present in the schema, empty in practice — read it, don't rely on it.
      explicitDeadline: parseDate(job.application_deadline),
      employmentType: null,
      department: job.departments?.[0]?.name?.trim() || null,
      isRemote: null,
      raw: job,
    }));
  },
};
