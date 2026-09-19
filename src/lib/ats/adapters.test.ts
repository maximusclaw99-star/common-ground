import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { test, beforeEach } from "vitest";
import { ashbyAdapter } from "./ashby";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { htmlToText } from "./html";
import { AtsFetchError } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(here, "__fixtures__", `${name}.json`), "utf8"));

/** Adapters must never hit the network in tests — stub fetch with the fixture. */
function stubFetch(payload: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  globalThis.fetch = (async () => ({
    ok,
    status,
    json: async () => payload,
  })) as unknown as typeof fetch;
}

const realFetch = globalThis.fetch;
beforeEach(() => { globalThis.fetch = realFetch; });

test("greenhouse: normalizes a real payload", async () => {
  stubFetch(fixture("greenhouse"));
  const jobs = await greenhouseAdapter.fetchJobs({ boardToken: "sigmacomputing" });

  assert.ok(jobs.length > 0);
  for (const j of jobs) {
    assert.ok(j.atsJobId.length > 0, "atsJobId");
    assert.ok(j.title.length > 0, "title");
    assert.ok(j.applyUrl.startsWith("http"), "applyUrl");
  }
  assert.ok(jobs.every((j) => j.postedAt instanceof Date), "first_published is always present");
});

test("greenhouse: decodes entity-encoded HTML content into readable text", async () => {
  stubFetch(fixture("greenhouse"));
  const jobs = await greenhouseAdapter.fetchJobs({ boardToken: "sigmacomputing" });
  const withBody = jobs.find((j) => j.descriptionText && j.descriptionText.length > 200);

  assert.ok(withBody, "expected at least one job with a description");
  const text = withBody!.descriptionText!;
  assert.ok(!text.includes("&lt;"), "entities must be decoded");
  assert.ok(!/<[a-z][^>]*>/i.test(text), "tags must be stripped");
});

test("lever: createdAt is epoch MILLISECONDS, not seconds", async () => {
  stubFetch(fixture("lever"));
  const jobs = await leverAdapter.fetchJobs({ boardToken: "matchgroup" });
  const dated = jobs.filter((j) => j.postedAt);

  assert.ok(dated.length > 0, "fixture should carry createdAt values");
  for (const j of dated) {
    const year = j.postedAt!.getUTCFullYear();
    // Reading ms as seconds lands in 1970; as microseconds, far future.
    assert.ok(year >= 2015 && year <= 2035, `implausible posted year ${year}`);
  }
});

test("ashby: normalizes and drops unlisted postings", async () => {
  const payload = fixture("ashby");
  payload.jobs[0].isListed = false;
  const listed = payload.jobs.length - 1;

  stubFetch(payload);
  const jobs = await ashbyAdapter.fetchJobs({ boardToken: "ramp" });

  assert.equal(jobs.length, listed, "unlisted postings must be excluded");
  assert.ok(jobs.every((j) => j.applyUrl.startsWith("http")));
  assert.ok(jobs.every((j) => j.postedAt instanceof Date));
});

test("every adapter throws (never returns []) on an HTTP error", async () => {
  for (const adapter of [greenhouseAdapter, leverAdapter, ashbyAdapter]) {
    stubFetch({}, { ok: false, status: 503 });
    await assert.rejects(
      () => adapter.fetchJobs({ boardToken: "whatever" }),
      (err: unknown) => err instanceof AtsFetchError && err.status === 503,
      `${adapter.kind} must throw, or a transport blip reads as a closed board`,
    );
  }
});

test("greenhouse/ashby throw on a malformed body instead of reporting zero jobs", async () => {
  stubFetch({ notJobs: [] });
  await assert.rejects(() => greenhouseAdapter.fetchJobs({ boardToken: "x" }), AtsFetchError);
  stubFetch({ notJobs: [] });
  await assert.rejects(() => ashbyAdapter.fetchJobs({ boardToken: "x" }), AtsFetchError);
  stubFetch({ nope: true });
  await assert.rejects(() => leverAdapter.fetchJobs({ boardToken: "x" }), AtsFetchError);
});

test("htmlToText handles double-encoded entities and block breaks", () => {
  assert.equal(htmlToText("&lt;p&gt;Hello&lt;/p&gt;&lt;p&gt;World&lt;/p&gt;"), "Hello\nWorld");
  assert.equal(htmlToText("<p>A&amp;B</p>"), "A&B");
  assert.equal(htmlToText(""), null);
  assert.equal(htmlToText(null), null);
});
