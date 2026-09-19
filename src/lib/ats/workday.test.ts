import assert from "node:assert/strict";
import { test, beforeEach } from "vitest";
import { workdayAdapter, parseRelativePostedOn } from "./workday";
import { AtsFetchError } from "./types";

const BOARD = { boardToken: "pwc", workdayHost: "wd3", workdaySite: "Global_Campus_Careers" };

const posting = (n: number) => ({
  title: `Analyst ${n}`,
  externalPath: `/job/NY/Analyst-${n}_${n}WD`,
  locationsText: "New York",
  postedOn: "Posted Today",
  timeType: "Full time",
});

/** Serves `total` postings in pages of 20, like the real endpoint. */
function stubList(total: number) {
  const calls: number[] = [];
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const { offset } = JSON.parse(String(init?.body ?? "{}"));
    calls.push(offset);
    const page = Array.from(
      { length: Math.max(0, Math.min(20, total - offset)) },
      (_, i) => posting(offset + i),
    );
    return { ok: true, status: 200, json: async () => ({ jobPostings: page, total }) };
  }) as unknown as typeof fetch;
  return calls;
}

const realFetch = globalThis.fetch;
beforeEach(() => { globalThis.fetch = realFetch; });

test("paginates through every page at the 20-result cap", async () => {
  const calls = stubList(47);
  const jobs = await workdayAdapter.fetchJobs(BOARD);

  assert.equal(jobs.length, 47);
  assert.deepEqual(calls, [0, 20, 40], "must walk offsets in steps of 20");
  assert.equal(new Set(jobs.map((j) => j.atsJobId)).size, 47, "ids must be unique");
});

test("builds an apply URL and leaves description unset until hydrated", async () => {
  stubList(1);
  const [job] = await workdayAdapter.fetchJobs(BOARD);
  assert.equal(
    job.applyUrl,
    "https://pwc.wd3.myworkdayjobs.com/Global_Campus_Careers/job/NY/Analyst-0_0WD",
  );
  assert.equal(job.descriptionText, null);
});

test("requires host and site rather than guessing them", async () => {
  await assert.rejects(
    () => workdayAdapter.fetchJobs({ boardToken: "pwc" }),
    AtsFetchError,
  );
});

test("throws on HTTP error instead of reporting an empty board", async () => {
  globalThis.fetch = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as never;
  await assert.rejects(() => workdayAdapter.fetchJobs(BOARD), AtsFetchError);
});

test("hydrate fills exact startDate, description and apply URL", async () => {
  globalThis.fetch = (async () => ({
    ok: true, status: 200,
    json: async () => ({
      jobPostingInfo: {
        startDate: "2026-09-18",
        endDate: null,
        jobDescription: "<p>Work with &amp; for clients</p>",
        externalUrl: "https://pwc.wd3.myworkdayjobs.com/en-US/Global_Campus_Careers/job/x",
        location: "Buenos Aires",
      },
    }),
  })) as never;

  const stub = { ...posting(1), atsJobId: "/job/x", title: "t", location: null,
    descriptionText: null, applyUrl: "old", postedAt: null, updatedAt: null,
    explicitDeadline: null, employmentType: null, department: null, isRemote: null, raw: {} };

  const out = await workdayAdapter.hydrate!(BOARD, stub as never);
  assert.equal(out.postedAt?.toISOString().slice(0, 10), "2026-09-18");
  assert.equal(out.descriptionText, "Work with & for clients");
  assert.ok(out.applyUrl.includes("/en-US/"));
  assert.equal(out.explicitDeadline, null, "endDate is present in schema but null in practice");
});

test("relative postedOn parsing covers Workday's wording", () => {
  const now = new Date("2026-09-19T12:00:00Z");
  const day = (d: Date | null) => d?.toISOString().slice(0, 10);
  assert.equal(day(parseRelativePostedOn("Posted Today", now)), "2026-09-19");
  assert.equal(day(parseRelativePostedOn("Posted Yesterday", now)), "2026-09-18");
  assert.equal(day(parseRelativePostedOn("Posted 3 Days Ago", now)), "2026-09-16");
  assert.equal(day(parseRelativePostedOn("Posted 30+ Days Ago", now)), "2026-08-20");
  assert.equal(parseRelativePostedOn("Posted Recently", now), null);
  assert.equal(parseRelativePostedOn(null, now), null);
});

test("keeps paginating when later pages report total: 0", async () => {
  // Workday reports `total` on the first page only; later pages say 0 while
  // still serving results. Reading it per-page truncated Huron to 40 of 260.
  const TOTAL = 65;
  globalThis.fetch = (async (_u: string, init?: RequestInit) => {
    const { offset } = JSON.parse(String(init?.body ?? "{}"));
    const page = Array.from(
      { length: Math.max(0, Math.min(20, TOTAL - offset)) },
      (_, i) => posting(offset + i),
    );
    return {
      ok: true, status: 200,
      json: async () => ({ jobPostings: page, total: offset === 0 ? TOTAL : 0 }),
    };
  }) as unknown as typeof fetch;

  const jobs = await workdayAdapter.fetchJobs(BOARD);
  assert.equal(jobs.length, TOTAL, "must not stop at the first page's boundary");
});
