import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import { getResumeProvider } from "./index";

const original = process.env.RESUME_PROVIDER;
afterEach(() => {
  if (original === undefined) delete process.env.RESUME_PROVIDER;
  else process.env.RESUME_PROVIDER = original;
});

test("the warehouse reads resumes by default", () => {
  delete process.env.RESUME_PROVIDER;
  assert.equal(getResumeProvider().name, "databricks");
});

test("anthropic can still be selected", () => {
  process.env.RESUME_PROVIDER = "anthropic";
  assert.equal(getResumeProvider().name, "anthropic");
});

test("an unknown provider degrades to databricks rather than throwing", () => {
  process.env.RESUME_PROVIDER = "nonsense";
  assert.equal(getResumeProvider().name, "databricks");
});

test("readiness is reported from the variables each provider actually needs", () => {
  process.env.RESUME_PROVIDER = "databricks";
  const databricks = getResumeProvider();
  const saved = { ...process.env };
  delete process.env.DATABRICKS_HOST;
  assert.equal(databricks.isReady(), false);
  assert.match(databricks.notReadyReason, /DATABRICKS_HOST/);
  Object.assign(process.env, saved);
});
