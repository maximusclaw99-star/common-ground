import assert from "node:assert/strict";
import { test } from "vitest";
import { fillPercent } from "./progress-bar";

test("the fill grows with the clock and never claims to be done", () => {
  assert.equal(fillPercent(0, 18), 0);
  const early = fillPercent(5, 18);
  const mid = fillPercent(18, 18);
  const late = fillPercent(60, 18);
  assert.ok(early > 20 && early < mid && mid < late);
  assert.ok(Math.abs(mid - 63.2) < 0.2);
  assert.equal(fillPercent(600, 18), 96);
});
