import assert from "node:assert/strict";
import { test } from "vitest";
import { NOW, cast, student } from "./__fixtures__/cast";
import { rankPeople } from "./score";
import type { Person } from "./types";

/**
 * This runs live while someone watches. The failure mode it catches is
 * rebuilding the alias Maps or recompiling regexes inside the per-person loop,
 * which turns 40ms into several seconds.
 */
test("ranking five thousand people stays interactive", () => {
  const many: Person[] = Array.from({ length: 5000 }, (_, i) => ({
    ...cast[i % cast.length],
    id: `synthetic-${i}`,
  }));

  const started = performance.now();
  const { results } = rankPeople(student, many, { now: NOW });
  const elapsed = performance.now() - started;

  assert.equal(results.length, 5000);
  assert.ok(elapsed < 150, `ranking took ${elapsed.toFixed(0)}ms`);
});
