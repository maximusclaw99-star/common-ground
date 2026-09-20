import assert from "node:assert/strict";
import { test } from "vitest";
import captured from "./__fixtures__/positions-statement.json";
import { toDirectoryPosition, toPosition } from "./databricks";

/**
 * The fixture is a real Statement Execution API response (captured 2026-09-19,
 * trimmed to the fields the client reads). It pins the two facts the parser
 * depends on: rows are positional, and ARRAY/STRUCT columns arrive as JSON text.
 */
const columns = captured.manifest.schema.columns.map((c) => c.name);
const rows = captured.result.data_array.map((values) => {
  const row: Record<string, unknown> = {};
  columns.forEach((name, i) => (row[name] = values[i]));
  return row;
});

test("positional rows zip with the manifest into named columns", () => {
  assert.ok(columns.includes("opens_on") && columns.includes("requirements"));
  assert.equal(rows.length, 3);
});

test("a warehouse row becomes a Position with typed dates, years and requirements", () => {
  const p = toPosition(rows[0]);
  assert.equal(p.id, "j001");
  assert.ok(p.company.length > 0);
  assert.match(p.opensOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(p.closesOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(p.targetGradYears.every((y) => Number.isInteger(y) && y > 2020), JSON.stringify(p.targetGradYears));
  assert.ok(p.requirements.length > 0);
  for (const r of p.requirements) {
    assert.equal(typeof r.requirement, "string");
    assert.ok(["skill", "certification", "degree", "experience"].includes(r.kind));
    assert.equal(typeof r.required, "boolean");
  }
  assert.equal(p.source, "databricks");
});

test("every position carries exactly one degree requirement, as the generator guarantees", () => {
  for (const row of rows) {
    const degrees = toPosition(row).requirements.filter((r) => r.kind === "degree");
    assert.equal(degrees.length, 1, row.id as string);
  }
});

test("missing or malformed nested columns degrade to empty arrays, never throw", () => {
  const p = toPosition({ ...rows[0], target_grad_years: "not json", requirements: null });
  assert.deepEqual(p.targetGradYears, []);
  assert.deepEqual(p.requirements, []);
});

test("a directory row becomes a Position with typical requirements and stand-in dates flagged as such", () => {
  const p = toDirectoryPosition({
    id: "i00003", category: "Quantitative Trading / Research", company: "Booz Allen Hamilton",
    title: "University - Summer 2027 Quantum Computing Intern", location: "Washington, District of Columbia, United States",
    just_posted: "true", apply_url: "https://bah.wd1.myworkdayjobs.com/x", vertical: "finance",
    requirements: JSON.stringify([{ requirement: "Python", kind: "skill", required: true }, { requirement: "Statistics", kind: "skill", required: true }]),
  });
  assert.equal(p.type, "internship");
  assert.equal(p.vertical, "finance");
  assert.equal(p.datesKnown, false);
  assert.equal(p.justPosted, true);
  assert.equal(p.requirementsTypical, true);
  assert.equal(p.requirements.length, 2);
  assert.equal(p.url, "https://bah.wd1.myworkdayjobs.com/x");
  assert.deepEqual(toDirectoryPosition({ id: "x", requirements: null }).requirements, []);
});
