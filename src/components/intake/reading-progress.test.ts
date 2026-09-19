import assert from "node:assert/strict";
import { test } from "vitest";
import { stageAt, stagesFor } from "./reading-progress";

test("the stage advances with elapsed time, and never goes backwards", () => {
  let last = -1;
  for (let t = 0; t <= 90; t += 1) {
    const stage = stageAt("databricks", t);
    assert.ok(stage.after >= last, `stage went backwards at ${t}s`);
    last = stage.after;
  }
});

test("the first stage covers time zero", () => {
  for (const reader of ["databricks", "anthropic"]) {
    assert.equal(stageAt(reader, 0).after, 0);
    assert.ok(stageAt(reader, 0).label.length > 0);
  }
});

test("each reader's stages describe its own pipeline", () => {
  // Databricks flattens the PDF then asks the warehouse; Claude takes the
  // pages directly. Telling a student the wrong one is a small lie.
  assert.match(stageAt("databricks", 10).label, /warehouse/i);
  assert.match(stageAt("anthropic", 10).label, /claude|reading/i);
  assert.ok(!stagesFor("anthropic").some((s) => /warehouse/i.test(s.label)));
});

test("a long wait gets its own stage rather than looking hung", () => {
  // ai_query waits up to 50s before polling, so a minute is ordinary.
  assert.notEqual(stageAt("databricks", 60).label, stageAt("databricks", 10).label);
});

test("stages are declared in ascending order", () => {
  for (const reader of ["databricks", "anthropic"]) {
    const afters = stagesFor(reader).map((s) => s.after);
    assert.deepEqual(afters, [...afters].sort((a, b) => a - b));
  }
});
