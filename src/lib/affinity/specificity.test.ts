import assert from "node:assert/strict";
import { test } from "vitest";
import { SPECIFIC_ENOUGH, specificity } from "./specificity";

test("the two reference phrases land either side of the gate", () => {
  const vague = specificity("AI");
  const sharp = specificity("responsible AI deployment for public-sector clients");
  assert.ok(vague < SPECIFIC_ENOUGH, `"AI" scored ${vague}`);
  assert.ok(sharp >= SPECIFIC_ENOUGH, `the specific phrase scored ${sharp}`);
  assert.equal(vague.toFixed(2), "0.09");
  assert.equal(sharp.toFixed(2), "0.80");
});

test("a pile of buzzwords is still a pile of buzzwords", () => {
  assert.ok(specificity("AI machine learning data technology innovation") < SPECIFIC_ENOUGH);
});

/** Tune the constants against this table, never against a single example. */
const TABLE: ReadonlyArray<[string, boolean]> = [
  ["AI", false],
  ["data", false],
  ["consulting", false],
  ["tech", false],
  ["machine learning", false],
  ["cloud computing", false],
  ["business strategy", false],
  ["digital transformation", false],
  ["leadership and innovation", false],
  ["sustainability", false],
  ["finance", false],
  ["software engineering", false],
  ["analytics", false],
  ["startups", false],
  ["responsible AI deployment for public-sector clients", true],
  ["credit risk modeling in Python", true],
  ["retrieval over legal documents", true],
  ["Databricks Unity Catalog lineage", true],
  ["FedRAMP compliance for cloud migrations", true],
  ["supply chain forecasting for retail", true],
  ["claims reconciliation in healthcare", true],
  ["observability for Kafka pipelines", true],
  ["underwriting automation at insurance carriers", true],
  ["FHIR data ingestion", true],
  ["SOX controls testing", true],
  ["zero trust segmentation for federal agencies", true],
  ["pricing strategy for higher education", true],
  ["evaluation harnesses for LLM agents", true],
  ["dbt lineage governance", true],
  ["fraud detection in fintech", true],
];

test("the gate holds across the whole phrase table", () => {
  const wrong = TABLE.filter(([phrase, expected]) =>
    (specificity(phrase) >= SPECIFIC_ENOUGH) !== expected)
    .map(([phrase]) => `${phrase} -> ${specificity(phrase).toFixed(2)}`);
  assert.deepEqual(wrong, []);
});
