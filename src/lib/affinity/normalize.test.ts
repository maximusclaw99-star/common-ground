import assert from "node:assert/strict";
import { test } from "vitest";
import { canonical, fuzzyMatches, sharedPhrase, tokenSetSimilarity } from "./normalize";

const key = (kind: Parameters<typeof canonical>[0], s: string) => canonical(kind, s).key;

test("school name variants collapse to one key", () => {
  const keys = [
    "Virginia Tech",
    "Virginia Polytechnic Institute and State University",
    "VT",
    "Virginia Tech (Blacksburg, VA)",
    "virginia tech",
  ].map((s) => key("school", s));
  assert.equal(new Set(keys).size, 1, `expected one key, got ${[...new Set(keys)].join(", ")}`);
});

test("schools that merely share a word stay distinct", () => {
  // The single most expensive false positive available to this product.
  const keys = [
    key("school", "University of Virginia"),
    key("school", "Virginia Tech"),
    key("school", "Virginia Commonwealth University"),
  ];
  assert.equal(new Set(keys).size, 3);
});

test("fuzzy matching is refused for schools", () => {
  assert.ok(tokenSetSimilarity("University of Virginia", "Virginia University") > 0.8);
  assert.equal(fuzzyMatches("school", "University of Virginia", "Virginia University"), false);
  assert.equal(fuzzyMatches("org", "Consulting Club", "Club Consulting"), true);
});

test("company legal suffixes are noise", () => {
  const keys = ["Deloitte Consulting LLP", "Deloitte & Touche", "Deloitte"].map((s) => key("company", s));
  assert.equal(new Set(keys).size, 1);
  assert.equal(key("company", "Databricks, Inc."), "databricks");
});

test("a place is a city AND a state", () => {
  const richmondVA = ["Richmond, VA", "Richmond, Virginia", "Greater Richmond Area"]
    .map((s) => key("place", s));
  assert.equal(new Set(richmondVA).size, 1);
  // Same city name, different state, is a different place.
  assert.notEqual(key("place", "Richmond, VA"), key("place", "Richmond, CA"));
});

test("a bare state is marked as one so tier 5 can refuse it", () => {
  assert.ok(key("place", "Virginia").startsWith("state:"));
  assert.ok(!key("place", "Richmond, VA").startsWith("state:"));
});

test("an unknown school still derives a stable, self-matching key", () => {
  const a = key("school", "Blue Ridge Technical College");
  assert.ok(a.length > 0);
  assert.equal(a, key("school", "blue ridge technical college"));
});

test("acronyms only resolve through the alias table", () => {
  assert.equal(key("org", "BAP"), key("org", "Beta Alpha Psi"));
  // Not in the table, so it stays itself rather than being guessed at.
  assert.notEqual(key("org", "QZX"), key("org", "Quantitative Zoology Exchange"));
});

test("sharedPhrase scores the overlap, not either side", () => {
  const overlap = sharedPhrase("responsible AI deployment for public-sector clients", "AI");
  assert.equal(overlap, "ai");
  assert.equal(sharedPhrase("marching band", "investment club"), null);
});
