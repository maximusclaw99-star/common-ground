import assert from "node:assert/strict";
import { test } from "vitest";
import type { PollOutcome, TrackedJob } from "./close-detection";
import { resolveClosures } from "./close-detection";

const ok = (companyId: string, ids: string[]): PollOutcome => ({
  companyId, ok: true, seenJobIds: new Set(ids),
});
const failed = (companyId: string): PollOutcome => ({
  companyId, ok: false, seenJobIds: new Set(), error: "HTTP 503",
});
const job = (id: string, companyId: string, atsJobId: string, closedAt: Date | null = null):
  TrackedJob => ({ id, companyId, atsJobId, closedAt });

test("closes a job that vanished from a successful poll", () => {
  const r = resolveClosures([ok("c1", ["a", "b"])], [
    job("1", "c1", "a"), job("2", "c1", "b"), job("3", "c1", "gone"),
  ]);
  assert.deepEqual(r.toClose, ["3"]);
  assert.deepEqual(r.toReopen, []);
});

test("a FAILED poll closes nothing", () => {
  const r = resolveClosures([failed("c1")], [
    job("1", "c1", "a"), job("2", "c1", "b"),
  ]);
  assert.deepEqual(r.toClose, []);
  assert.deepEqual(r.suspiciousCompanies, []);
});

test("a company not polled at all this run is untouched", () => {
  const r = resolveClosures([ok("c1", [])], [job("9", "c2", "x")]);
  assert.deepEqual(r.toClose, []);
});

test("empty-feed guard prevents mass closure when a board returns nothing", () => {
  const openJobs = ["a", "b", "c", "d"].map((x, i) => job(String(i), "c1", x));
  const r = resolveClosures([ok("c1", [])], openJobs);
  assert.deepEqual(r.toClose, [], "should refuse to close the whole board at once");
  assert.deepEqual(r.suspiciousCompanies, [{ companyId: "c1", trackedOpen: 4 }]);
});

test("below the guard threshold, a genuinely emptied small board still closes", () => {
  const r = resolveClosures([ok("c1", [])], [job("1", "c1", "a"), job("2", "c1", "b")]);
  assert.deepEqual(r.toClose.sort(), ["1", "2"]);
  assert.deepEqual(r.suspiciousCompanies, []);
});

test("a reappearing job is reopened, not left closed", () => {
  const r = resolveClosures([ok("c1", ["a"])], [job("1", "c1", "a", new Date("2026-01-01"))]);
  assert.deepEqual(r.toReopen, ["1"]);
  assert.deepEqual(r.toClose, []);
});

test("already-closed absent jobs are not closed twice", () => {
  const r = resolveClosures([ok("c1", [])], [job("1", "c1", "a", new Date("2026-01-01"))]);
  assert.deepEqual(r.toClose, []);
});

test("one company failing does not block closures at another", () => {
  const r = resolveClosures([failed("c1"), ok("c2", ["keep"])], [
    job("1", "c1", "vanished-but-unknown"),
    job("2", "c2", "keep"),
    job("3", "c2", "vanished"),
  ]);
  assert.deepEqual(r.toClose, ["3"]);
});
