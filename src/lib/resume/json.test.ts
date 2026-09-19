import assert from "node:assert/strict";
import { test } from "vitest";
import { extractJsonObject } from "./json";

test("plain JSON parses", () => {
  assert.deepEqual(extractJsonObject('{"a":1}'), { a: 1 });
});

test("a fenced reply parses", () => {
  assert.deepEqual(extractJsonObject('```json\n{"a":1}\n```'), { a: 1 });
});

test("a reply with prose either side parses", () => {
  // Llama 3.3 does this often enough that failing the upload over it would be
  // the wrong call.
  const reply = 'Here is the profile:\n{"full_name":"Sam"}\nLet me know if you need changes.';
  assert.deepEqual(extractJsonObject(reply), { full_name: "Sam" });
});

test("braces inside string values do not end the object early", () => {
  // The reason this counts braces instead of reaching for lastIndexOf('}').
  const reply = '{"bullets":["Wrote {json} parsers","Closed }"],"n":2}';
  assert.deepEqual(extractJsonObject(reply), { bullets: ["Wrote {json} parsers", "Closed }"], n: 2 });
});

test("an escaped quote does not end the string", () => {
  assert.deepEqual(extractJsonObject('{"q":"a \\" b"}'), { q: 'a " b' });
});

test("nested objects come back whole", () => {
  const reply = 'text {"affinity":{"greek":["Beta Alpha Psi"]},"skills":[]} more text';
  assert.deepEqual(extractJsonObject(reply), { affinity: { greek: ["Beta Alpha Psi"] }, skills: [] });
});

test("a reply with no object is refused", () => {
  assert.throws(() => extractJsonObject("I could not read that resume."), /no JSON object/);
});

test("an unclosed object is refused rather than half-parsed", () => {
  assert.throws(() => extractJsonObject('{"a":1'), /never closed/);
});
