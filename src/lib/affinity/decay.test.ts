import assert from "node:assert/strict";
import { test } from "vitest";
import { NOW, p8, p9, student } from "./__fixtures__/cast";
import { scoreAffinity } from "./score";
import type { Person } from "./types";

const DAY = 86_400_000;
/** Both the student's event and Colin's are dated one day before NOW. */
const EVENT_AT = NOW - DAY;
const POST_AT = NOW - 3 * DAY;

const rankAt = (person: Person, now: number) => scoreAffinity(student, person, { now }).rank;
const scoreAt = (person: Person, now: number) => scoreAffinity(student, person, { now }).score;

test("a shared event fades over 72 hours and then stops being the opener", () => {
  assert.equal(rankAt(p9, EVENT_AT), 9);
  assert.equal(rankAt(p9, EVENT_AT + DAY), 9);
  assert.equal(rankAt(p9, EVENT_AT + 3 * DAY), 9, "at exactly 72h it is still just alive");

  const fresh = scoreAt(p9, EVENT_AT);
  const day1 = scoreAt(p9, EVENT_AT + DAY);
  const day3 = scoreAt(p9, EVENT_AT + 3 * DAY);
  assert.ok(fresh > day1 && day1 > day3, `${fresh} > ${day1} > ${day3}`);

  // Past the floor the hit is DROPPED, not merely weakened — Colin has nothing
  // else in common, so he falls all the way to the bottom of the ladder.
  assert.equal(rankAt(p9, EVENT_AT + 4 * DAY), 13);
});

test("a publication fades over about a month, then demotes to plain overlap", () => {
  assert.equal(rankAt(p8, POST_AT), 8);
  assert.equal(rankAt(p8, POST_AT + 10 * DAY), 8);
  assert.equal(rankAt(p8, POST_AT + 29 * DAY), 8);

  const fresh = scoreAt(p8, POST_AT);
  const old = scoreAt(p8, POST_AT + 29 * DAY);
  assert.ok(fresh > old);

  // Ruth is still at a company the student targets, so she lands at tier 11.
  assert.equal(rankAt(p8, POST_AT + 45 * DAY), 11);
});

test("an event that has not happened yet is fresh, not negatively aged", () => {
  const upcoming: Person = {
    ...p9,
    events: [{ ...p9.events[0], date: new Date(NOW + 5 * DAY).toISOString() }],
  };
  const withFuture = { ...student, facts: { ...student.facts,
    events: [{ ...student.facts.events[0], date: new Date(NOW + 5 * DAY).toISOString() }] } };

  const r = scoreAffinity(withFuture, upcoming, { now: NOW });
  assert.equal(r.rank, 9);
  assert.equal(r.components.freshness, 1);
});

test("scoring is pure and never reads the clock itself", () => {
  const a = scoreAffinity(student, p9, { now: NOW });
  const b = scoreAffinity(student, p9, { now: NOW });
  assert.deepEqual(a, b);

  // If any predicate reached for Date.now(), the demo would be time-dependent
  // and these tests would be flaky. Prove it cannot.
  const real = Date.now;
  Date.now = () => { throw new Error("Date.now() leaked into the hot path"); };
  try {
    assert.equal(scoreAffinity(student, p9, { now: NOW }).rank, 9);
  } finally {
    Date.now = real;
  }
});
