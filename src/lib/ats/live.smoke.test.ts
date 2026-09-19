import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { getAdapter } from "./index";

/**
 * Hits the real endpoints. Opt-in so the normal suite stays offline and fast:
 *   ATS_LIVE=1 npm test
 * Run this when a provider changes its payload shape.
 */
const live = process.env.ATS_LIVE === "1";

describe.skipIf(!live)("live ATS endpoints", () => {
  test("workday: paginates a real board past the 20-item cap", async () => {
    const board = { boardToken: "huron", workdayHost: "wd1", workdaySite: "HuronCareers" };
    const jobs = await getAdapter("workday").fetchJobs(board);

    assert.ok(jobs.length > 20, `expected pagination, got ${jobs.length}`);
    assert.equal(new Set(jobs.map((j) => j.atsJobId)).size, jobs.length, "no duplicate ids");
    assert.ok(jobs.every((j) => j.applyUrl.startsWith("https://")));
    console.log(`    huron: ${jobs.length} postings`);

    const hydrated = await getAdapter("workday").hydrate!(board, jobs[0]);
    assert.ok((hydrated.descriptionText?.length ?? 0) > 100, "hydrate must fetch a description");
    assert.ok(hydrated.postedAt instanceof Date, "hydrate must fetch an exact startDate");
    console.log(`    hydrated "${hydrated.title}" posted ${hydrated.postedAt?.toISOString().slice(0,10)}`);
  }, 120_000);

  test.each([
    ["greenhouse", { boardToken: "sigmacomputing" }],
    ["lever", { boardToken: "matchgroup" }],
    ["ashby", { boardToken: "ramp" }],
  ] as const)("%s: returns usable postings", async (kind, board) => {
    const jobs = await getAdapter(kind).fetchJobs(board);
    assert.ok(jobs.length > 0);
    assert.ok(jobs.every((j) => j.title && j.applyUrl.startsWith("http")));
    assert.ok(jobs.some((j) => j.postedAt), "expected a posted date");
    console.log(`    ${kind}: ${jobs.length} postings`);
  }, 120_000);
});
