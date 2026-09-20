import assert from "node:assert/strict";
import { beforeEach, test } from "vitest";
import { allow, resetLimits } from "./limit";

const limit = { perKey: 2, global: 3, windowMs: 1000 };
beforeEach(resetLimits);

test("a key gets its allowance, then waits for the window", () => {
  assert.equal(allow("t", "a", limit, 0), true);
  assert.equal(allow("t", "a", limit, 1), true);
  assert.equal(allow("t", "a", limit, 2), false);
  assert.equal(allow("t", "a", limit, 1001), true);
});

test("the global cap holds across keys", () => {
  assert.equal(allow("t", "a", limit, 0), true);
  assert.equal(allow("t", "b", limit, 0), true);
  assert.equal(allow("t", "c", limit, 0), true);
  assert.equal(allow("t", "d", limit, 0), false);
});
