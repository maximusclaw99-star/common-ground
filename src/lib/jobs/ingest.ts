import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdapter } from "@/lib/ats";
import { resolveClosures, type PollOutcome, type TrackedJob } from "@/lib/ats/close-detection";
import type { AtsKind, BoardConfig, NormalizedJob } from "@/lib/ats/types";
import { classifyEntryLevel } from "./entry-level";

export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  ats: AtsKind;
  workday_host: string | null;
  workday_site: string | null;
}

export interface IngestSummary {
  companies: number;
  succeeded: number;
  failed: number;
  jobsSeen: number;
  inserted: number;
  closed: number;
  reopened: number;
  hydrated: number;
  suspicious: Array<{ companyId: string; trackedOpen: number }>;
  errors: Array<{ company: string; error: string }>;
}

const CONCURRENCY = 5;
/** Cap per run so one huge board cannot exhaust the function's time budget. */
const HYDRATE_BUDGET = 150;

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index]);
      }
    }),
  );
  return results;
}

const boardOf = (c: CompanyRow): BoardConfig => ({
  boardToken: c.slug,
  workdayHost: c.workday_host,
  workdaySite: c.workday_site,
});

export async function ingestAll(
  supabase: SupabaseClient,
  options: { companyIds?: string[] } = {},
): Promise<IngestSummary> {
  let query = supabase
    .from("companies")
    .select("id,name,slug,ats,workday_host,workday_site")
    .eq("active", true);
  if (options.companyIds?.length) query = query.in("id", options.companyIds);

  const { data: companies, error } = await query.returns<CompanyRow[]>();
  if (error) throw error;
  if (!companies?.length) {
    return { companies: 0, succeeded: 0, failed: 0, jobsSeen: 0, inserted: 0,
             closed: 0, reopened: 0, hydrated: 0, suspicious: [], errors: [] };
  }

  const outcomes: PollOutcome[] = [];
  const errors: IngestSummary["errors"] = [];
  const fetched = new Map<string, NormalizedJob[]>();

  await mapLimit(companies, CONCURRENCY, async (company) => {
    const startedAt = Date.now();
    try {
      const jobs = await getAdapter(company.ats).fetchJobs(boardOf(company));
      fetched.set(company.id, jobs);
      outcomes.push({
        companyId: company.id,
        ok: true,
        seenJobIds: new Set(jobs.map((j) => j.atsJobId)),
      });
      await supabase.from("job_poll_runs").insert({
        company_id: company.id, ok: true, job_count: jobs.length,
        duration_ms: Date.now() - startedAt,
      });
    } catch (err) {
      // A throw means "we could not look", never "the board is empty".
      const message = err instanceof Error ? err.message : String(err);
      outcomes.push({ companyId: company.id, ok: false, seenJobIds: new Set(), error: message });
      errors.push({ company: company.name, error: message });
      await supabase.from("job_poll_runs").insert({
        company_id: company.id, ok: false, error: message,
        duration_ms: Date.now() - startedAt,
      });
    }
  });

  // ---- upsert everything we saw -------------------------------------------
  const now = new Date().toISOString();
  let jobsSeen = 0;
  let inserted = 0;

  for (const [companyId, jobs] of fetched) {
    if (jobs.length === 0) continue;
    jobsSeen += jobs.length;

    const { data: existing } = await supabase
      .from("jobs").select("ats_job_id").eq("company_id", companyId)
      .returns<Array<{ ats_job_id: string }>>();
    const known = new Set(existing?.map((r) => r.ats_job_id) ?? []);
    inserted += jobs.filter((j) => !known.has(j.atsJobId)).length;

    const rows = jobs.map((job) => {
      const { isEntryLevel } = classifyEntryLevel({
        title: job.title, description: job.descriptionText,
      });
      return {
        company_id: companyId,
        ats_job_id: job.atsJobId,
        title: job.title,
        location: job.location,
        description: job.descriptionText,
        apply_url: job.applyUrl,
        employment_type: job.employmentType,
        department: job.department,
        is_remote: job.isRemote,
        is_entry_level: isEntryLevel,
        posted_at: job.postedAt?.toISOString() ?? null,
        explicit_deadline: job.explicitDeadline?.toISOString() ?? null,
        last_seen: now,
        closed_at: null,
      };
    });

    // first_seen is omitted so its default only applies on insert; an update
    // must never move it, or "posted N days ago" resets on every poll.
    for (let i = 0; i < rows.length; i += 500) {
      const { error: upsertError } = await supabase
        .from("jobs").upsert(rows.slice(i, i + 500), { onConflict: "company_id,ats_job_id" });
      if (upsertError) throw upsertError;
    }
  }

  // ---- closures ------------------------------------------------------------
  const { data: tracked } = await supabase
    .from("jobs").select("id,company_id,ats_job_id,closed_at")
    .returns<Array<{ id: string; company_id: string; ats_job_id: string; closed_at: string | null }>>();

  const trackedJobs: TrackedJob[] = (tracked ?? []).map((r) => ({
    id: r.id, companyId: r.company_id, atsJobId: r.ats_job_id,
    closedAt: r.closed_at ? new Date(r.closed_at) : null,
  }));

  const decision = resolveClosures(outcomes, trackedJobs);

  if (decision.toClose.length) {
    await supabase.from("jobs").update({ closed_at: now }).in("id", decision.toClose);
  }
  if (decision.toReopen.length) {
    await supabase.from("jobs").update({ closed_at: null }).in("id", decision.toReopen);
  }

  // ---- hydrate Workday ------------------------------------------------------
  // Only Workday needs it, and only for entry-level rows still missing a body.
  let hydrated = 0;
  const workday = companies.filter((c) => c.ats === "workday");

  for (const company of workday) {
    if (hydrated >= HYDRATE_BUDGET) break;
    const adapter = getAdapter("workday");
    if (!adapter.hydrate) break;

    const { data: needy } = await supabase
      .from("jobs")
      .select("id,ats_job_id,title,apply_url")
      .eq("company_id", company.id).eq("is_entry_level", true)
      .is("closed_at", null).is("hydrated_at", null)
      .limit(Math.min(40, HYDRATE_BUDGET - hydrated))
      .returns<Array<{ id: string; ats_job_id: string; title: string; apply_url: string }>>();

    await mapLimit(needy ?? [], 4, async (row) => {
      try {
        const full = await adapter.hydrate!(boardOf(company), {
          atsJobId: row.ats_job_id, title: row.title, applyUrl: row.apply_url,
          location: null, descriptionText: null, postedAt: null, updatedAt: null,
          explicitDeadline: null, employmentType: null, department: null,
          isRemote: null, raw: {},
        });
        const { isEntryLevel } = classifyEntryLevel({
          title: full.title, description: full.descriptionText,
        });
        await supabase.from("jobs").update({
          description: full.descriptionText,
          apply_url: full.applyUrl,
          posted_at: full.postedAt?.toISOString() ?? null,
          explicit_deadline: full.explicitDeadline?.toISOString() ?? null,
          location: full.location,
          is_entry_level: isEntryLevel,
          hydrated_at: now,
        }).eq("id", row.id);
        hydrated++;
      } catch {
        // Leave hydrated_at null so the next run retries this posting.
      }
    });
  }

  return {
    companies: companies.length,
    succeeded: outcomes.filter((o) => o.ok).length,
    failed: outcomes.filter((o) => !o.ok).length,
    jobsSeen, inserted,
    closed: decision.toClose.length,
    reopened: decision.toReopen.length,
    hydrated,
    suspicious: decision.suspiciousCompanies,
    errors,
  };
}
