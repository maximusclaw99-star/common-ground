import { AtsAdapter, AtsFetchError, NormalizedJob } from "./types";
import { htmlToText } from "./html";

interface LeverPosting {
  id: string;
  text: string;
  categories?: {
    location?: string | null;
    team?: string | null;
    department?: string | null;
    commitment?: string | null;
  } | null;
  hostedUrl?: string | null;
  applyUrl?: string | null;
  /** Epoch MILLISECONDS, not seconds and not ISO. */
  createdAt?: number | null;
  descriptionPlain?: string | null;
  description?: string | null;
  additionalPlain?: string | null;
  workplaceType?: string | null;
}

export const leverAdapter: AtsAdapter = {
  kind: "lever",

  async fetchJobs({ boardToken }, signal) {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(boardToken)}?mode=json`;

    const res = await fetch(url, { signal, headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new AtsFetchError("lever", boardToken, `HTTP ${res.status}`, res.status);
    }

    const body = await res.json();
    if (!Array.isArray(body)) {
      throw new AtsFetchError("lever", boardToken, "response was not an array");
    }

    return (body as LeverPosting[]).map<NormalizedJob>((job) => {
      // Guard the ms-epoch conversion: treating these as seconds silently
      // yields 1970 dates, which would poison every "posted N days ago".
      const postedAt =
        typeof job.createdAt === "number" && Number.isFinite(job.createdAt)
          ? new Date(job.createdAt)
          : null;

      const descriptionText =
        job.descriptionPlain?.trim() ||
        htmlToText(job.description) ||
        htmlToText(job.additionalPlain);

      return {
        atsJobId: job.id,
        title: job.text,
        location: job.categories?.location?.trim() || null,
        descriptionText: descriptionText || null,
        applyUrl: job.applyUrl || job.hostedUrl || "",
        postedAt,
        updatedAt: null,
        explicitDeadline: null,
        employmentType: job.categories?.commitment?.trim() || null,
        department: job.categories?.team?.trim() || job.categories?.department?.trim() || null,
        isRemote: job.workplaceType ? job.workplaceType.toLowerCase() === "remote" : null,
        raw: job,
      };
    });
  },
};
