import assert from "node:assert/strict";
import { test } from "vitest";
import { AffinityFactsSchema } from "@/lib/ai/schemas";
import { IN_SCOPE_RANKS, TIERS } from "@/lib/affinity/tiers";
import { FIELDS, fieldWeight } from "./fields";

test("every field id is unique and writes a real facts key", () => {
  const ids = FIELDS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  const shape = AffinityFactsSchema.shape as Record<string, unknown>;
  for (const f of FIELDS) {
    assert.ok(shape[f.path], `${f.id} writes "${f.path}", which is not in AffinityFacts`);
  }
});

test("every tier a field claims to unlock is one we can actually compute", () => {
  const inScope = new Set<number>(IN_SCOPE_RANKS);
  for (const f of FIELDS) {
    for (const rank of f.tiers) {
      assert.ok(inScope.has(rank), `${f.id} claims tier ${rank}, which is out of scope`);
    }
  }
});

test("every tier that needs a fact from the student has a question feeding it", () => {
  // The guard against a half-built ladder: a tier with no question behind it
  // can never fire, however good the predicate is.
  const fed = new Set(FIELDS.flatMap((f) => f.tiers));
  for (const rank of IN_SCOPE_RANKS) {
    if (rank === 13) continue;   // tier 13 is the absence of everything
    assert.ok(fed.has(rank), `no question feeds tier ${rank}`);
  }
});

test("required questions have no way to say 'none'", () => {
  for (const f of FIELDS) {
    if (f.required) assert.equal(f.skipLabel, undefined, `${f.id} is required but skippable`);
    if (f.skipLabel) {
      assert.ok(f.minAnswers !== undefined || f.input === "text" || f.input === "pair",
        `${f.id} offers a skip but has no minimum to skip past`);
    }
  }
});

test("the copy stays tight", () => {
  for (const f of FIELDS) {
    assert.ok(f.question.endsWith("?"), `${f.id}: "${f.question}" is not a question`);
    assert.ok(f.question.length <= 90, `${f.id}: question is ${f.question.length} chars`);
    assert.ok(f.help.length <= 200, `${f.id}: help is ${f.help.length} chars`);
  }
});

test("weight follows the ladder, with exactly one deliberate override", () => {
  const overrides = FIELDS.filter((f) => f.weightOverride !== undefined);
  assert.deepEqual(overrides.map((f) => f.id), ["hometown"]);

  const orgs = FIELDS.find((f) => f.id === "student_orgs")!;
  const interests = FIELDS.find((f) => f.id === "interests")!;
  assert.ok(fieldWeight(orgs) > fieldWeight(interests),
    "a tier-2 question must outweigh a tier-12 one");
});

test("the out-of-scope tiers have no questions behind them", () => {
  const outOfScope = new Set(TIERS.filter((t) => !t.inScope).map((t) => t.rank));
  for (const f of FIELDS) {
    for (const rank of f.tiers) assert.ok(!outOfScope.has(rank));
  }
});
