import assert from "node:assert/strict";
import { test } from "vitest";
import { NOW, student } from "@/lib/affinity/__fixtures__/cast";
import { EMPTY_FACTS } from "@/lib/ai/schemas";
import { mockPositions } from "./mock";
import { rankPositions, scorePosition, studentGradYear, studentVerticals, windowStatus } from "./score";
import type { Position } from "./types";

const positions = mockPositions(NOW);
const byId = (id: string) => positions.find((p) => p.id === id)!;

test("verticals derive from what intake already captured, most-wanted first", () => {
  // target_function "consulting", roles "Technology Analyst", industries "Consulting", transition to consulting
  assert.equal(studentVerticals(student)[0], "consulting");
  assert.equal(studentGradYear(student), 2027);
});

test("window status is computed from the two dates", () => {
  assert.equal(windowStatus(byId("m03"), NOW).status, "open");        // opened 5 days ago, closes in 30
  assert.equal(windowStatus(byId("m01"), NOW).status, "opens_soon");  // 12 days out
  assert.equal(windowStatus(byId("m05"), NOW).status, "upcoming");    // 130 days out
  assert.equal(windowStatus(byId("m11"), NOW).status, "closed");      // closed 15 days ago
});

test("a target-company posting in the primary vertical for the right class year scores highest", () => {
  const ranked = rankPositions(student, positions, { now: NOW });
  assert.equal(ranked[0].position.company, "Deloitte");
  assert.equal(ranked[0].fit.primaryVertical, true);
  assert.ok(ranked[0].fit.reasons.some((r) => r.includes("target list")));
  assert.ok(ranked[0].fit.reasons.some((r) => r.includes("class of 2027")));
});

test("closed windows sort last regardless of score", () => {
  const ranked = rankPositions(student, positions, { now: NOW });
  const last = ranked[ranked.length - 1];
  assert.equal(last.fit.windowStatus, "closed");
  assert.ok(ranked.slice(0, -1).every((r) => r.fit.windowStatus !== "closed"));
});

test("a position outside every known vertical is dropped; with no verticals known nothing is", () => {
  const finance = byId("m14");
  assert.equal(scorePosition(student, finance, { now: NOW, verticals: ["consulting"] }), null);
  const blank = { profile: { ...student.profile, targets: { roles: [], locations: [], industries: [] } }, facts: { ...EMPTY_FACTS } };
  assert.ok(scorePosition(blank, finance, { now: NOW }));
});

test("a missing hard-required certification costs ten points and is named", () => {
  const withCert: Position = { ...byId("m01"), requirements: [{ requirement: "PMP", kind: "certification", required: true }] };
  const without: Position = { ...byId("m01"), requirements: [] };
  const a = scorePosition(student, withCert, { now: NOW })!;
  const b = scorePosition(student, without, { now: NOW })!;
  // no-cert posting gets the flat +5; the missing-cert posting gets 0 coverage and -10
  assert.equal(b.score - a.score, 15);
  assert.ok(a.reasons.some((r) => r.includes("PMP")));
});

test("scores are deterministic for a fixed clock", () => {
  const a = rankPositions(student, positions, { now: NOW }).map((r) => r.fit.score);
  const b = rankPositions(student, positions, { now: NOW }).map((r) => r.fit.score);
  assert.deepEqual(a, b);
});

test("accounting is a vertical: audit and tax targets resolve to it", () => {
  const acct = {
    profile: { ...student.profile, targets: { roles: ["Audit Associate"], locations: [], industries: ["Public accounting"] } },
    facts: { ...EMPTY_FACTS, target_function: "audit", target_roles: ["Tax Associate"] },
  };
  assert.equal(studentVerticals(acct)[0], "accounting");
});

test("a posting with no dates counts as open and says posted, never a countdown", () => {
  const undated: Position = { ...byId("m01"), datesKnown: false, justPosted: true, opensOn: "2026-09-19", closesOn: "2026-12-18" };
  const fit = scorePosition(student, undated, { now: NOW })!;
  assert.equal(fit.windowStatus, "open");
  assert.equal(fit.datesKnown, false);
  assert.ok(fit.reasons.includes("Just posted"));
});

test("allVerticals keeps out-of-vertical roles at zero vertical points, and says why", () => {
  const finance = byId("m14");
  assert.equal(scorePosition(student, finance, { now: NOW, verticals: ["consulting"] }), null);
  const kept = scorePosition(student, finance, { now: NOW, verticals: ["consulting"], allVerticals: true })!;
  assert.ok(kept.reasons[0].startsWith("Outside the verticals"));
  assert.ok(kept.score < scorePosition(student, byId("m01"), { now: NOW, verticals: ["consulting"] })!.score);
});
