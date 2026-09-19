import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import { getPeopleProvider } from "./index";

const original = process.env.PEOPLE_PROVIDER;
afterEach(() => { process.env.PEOPLE_PROVIDER = original; });

test("defaults to the mock provider", () => {
  delete process.env.PEOPLE_PROVIDER;
  assert.equal(getPeopleProvider().name, "mock");
});

test("an unknown provider degrades to mock rather than throwing", () => {
  process.env.PEOPLE_PROVIDER = "nonsense";
  assert.equal(getPeopleProvider().name, "mock");
});

test("the mock provider surfaces target companies first but keeps everyone", async () => {
  process.env.PEOPLE_PROVIDER = "mock";
  const people = await getPeopleProvider().getPeople({ companies: ["Deloitte"] });
  assert.equal(people[0].currentCompany, "Deloitte");
  assert.ok(people.length > 2, "people outside the target list must still be rankable");
});
