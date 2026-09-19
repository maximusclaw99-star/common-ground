import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import { getPositionsProvider } from "./index";

const original = { positions: process.env.POSITIONS_PROVIDER, people: process.env.PEOPLE_PROVIDER };
afterEach(() => {
  process.env.POSITIONS_PROVIDER = original.positions;
  process.env.PEOPLE_PROVIDER = original.people;
});

test("defaults to the mock provider", () => {
  delete process.env.POSITIONS_PROVIDER;
  delete process.env.PEOPLE_PROVIDER;
  assert.equal(getPositionsProvider().name, "mock");
});

test("follows PEOPLE_PROVIDER when POSITIONS_PROVIDER is unset, so one variable flips the app", () => {
  delete process.env.POSITIONS_PROVIDER;
  process.env.PEOPLE_PROVIDER = "databricks";
  assert.equal(getPositionsProvider().name, "databricks");
});

test("an unknown provider degrades to mock rather than throwing", () => {
  process.env.POSITIONS_PROVIDER = "nonsense";
  assert.equal(getPositionsProvider().name, "mock");
});

test("the mock provider surfaces target companies first but keeps everyone", async () => {
  process.env.POSITIONS_PROVIDER = "mock";
  const positions = await getPositionsProvider().getPositions({ companies: ["Databricks"] });
  assert.equal(positions[0].company, "Databricks");
  assert.ok(positions.some((p) => p.company !== "Databricks"), "postings outside the target list must still be rankable");
});
