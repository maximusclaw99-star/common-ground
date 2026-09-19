import assert from "node:assert/strict";
import { test } from "vitest";
import { classifyEntryLevel, maxYearsRequired } from "./entry-level";

const isEntry = (title: string, description = "") =>
  classifyEntryLevel({ title, description }).isEntryLevel;

test("accepts the obvious student-facing titles", () => {
  for (const t of [
    "Software Engineer Intern", "2027 New Grad Software Engineer",
    "Campus Recruiting Analyst", "Business Analyst", "Junior Data Engineer",
    "Associate Consultant", "Technology Co-op", "Rotational Development Program",
  ]) assert.equal(isEntry(t), true, t);
});

test("seniority in the title outranks an entry keyword", () => {
  // The bug this guards: "Senior Analyst" matching on "analyst".
  for (const t of [
    "Senior Analyst", "Staff Software Engineer", "Principal Data Analyst",
    "Analytics Manager", "Director of Analytics", "Lead Associate",
  ]) assert.equal(isEntry(t), false, t);
});

test("reads years-of-experience out of the body", () => {
  assert.equal(isEntry("Data Scientist", "8+ years of experience required"), false);
  assert.equal(isEntry("Data Scientist", "0-2 years experience"), true);
  assert.equal(isEntry("Consultant", "We seek graduating seniors, class of 2027"), true);
});

test("maxYearsRequired takes the largest figure present", () => {
  assert.equal(maxYearsRequired("2 years experience, ideally 7+ years of experience"), 7);
  assert.equal(maxYearsRequired("no numbers here"), null);
  assert.equal(maxYearsRequired("5+ years of relevant experience"), 5);
});

test("unmarked mid-level roles are excluded rather than guessed in", () => {
  assert.equal(isEntry("Software Engineer", "Build things."), false);
});
