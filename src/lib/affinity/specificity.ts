import { contentTokens, normalizeText } from "./normalize";

/**
 * The gate that separates "we both like AI" from "responsible AI deployment
 * for public-sector clients".
 *
 * Tier 7 (a specific shared professional interest) is only strong when it is
 * concrete. Without a gate, every pair of people in tech shares "AI" and tier
 * 7 fires for everyone, which destroys the ladder. Anything below the gate
 * falls through to tier 12, where a vague shared interest actually belongs.
 *
 * This is a heuristic with no ground truth. Tune the constants against the
 * table in specificity.test.ts, never against a single example, or it will
 * overfit to two sentences and misclassify everything else.
 */

/** Fields, not problems. A phrase made only of these is not specific. */
const GENERIC = new Set([
  "ai", "ml", "machine", "learning", "data", "tech", "technology", "software",
  "cloud", "analytics", "business", "consulting", "finance", "coding", "code",
  "innovation", "startups", "startup", "sustainability", "leadership",
  "networking", "strategy", "digital", "transformation", "engineering",
  "computing", "science", "systems", "development", "management",
]);

/** A domain rather than a field — real narrowing. */
const QUALIFIERS = [
  "public sector", "public-sector", "federal", "government", "defense", "defence",
  "healthcare", "health care", "fintech", "supply chain", "retail", "insurance",
  "higher ed", "higher education", "nonprofit", "non profit", "manufacturing",
  "energy", "pharma", "pharmaceutical", "banking", "logistics", "education",
  "municipal", "state and local", "clinical", "legal", "aerospace",
];

/** A verb — i.e. an actual problem someone works on. */
const ACTIVITIES = new Set([
  "deployment", "deploy", "migration", "governance", "forecasting", "attribution",
  "reconciliation", "underwriting", "observability", "evaluation", "evals",
  "lineage", "segmentation", "pricing", "provisioning", "retrieval", "ingestion",
  "orchestration", "detection", "remediation", "compliance", "auditing",
  "modeling", "modelling", "benchmarking", "instrumentation", "hardening",
  "testing", "forecasting", "triage", "tuning", "labeling", "labelling",
  "onboarding", "personalization", "personalisation", "routing", "indexing",
]);

/** Tools, standards and regulations. A named thing is a specific thing. */
const KNOWN_ENTITIES = new Set([
  "databricks", "snowflake", "spark", "kafka", "airflow", "dbt", "terraform",
  "kubernetes", "postgres", "redshift", "bigquery", "tableau", "powerbi",
  "unity", "catalog", "delta", "mlflow", "pytorch", "tensorflow", "langchain",
  "fhir", "hipaa", "sox", "fedramp", "nist", "cmmc", "gdpr", "pci", "soc2",
  "iso27001", "cissp", "cisa", "cpa", "cfa", "aws", "azure", "gcp", "splunk",
  "crowdstrike", "okta", "sap", "workday", "salesforce", "servicenow",
]);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function hasNamedEntity(raw: string, tokens: string[]): boolean {
  if (tokens.some((t) => KNOWN_ENTITIES.has(t))) return true;
  // Capitalisation in the RAW string, before lowercasing — a proper noun the
  // table has not heard of is still a proper noun. Skip the first word, which
  // is capitalised for sentence reasons rather than naming reasons.
  const rawWords = raw.trim().split(/\s+/).slice(1);
  return rawWords.some((w) => /^[A-Z][a-zA-Z0-9]{2,}$/.test(w) && !/^(The|And|For|With)$/.test(w));
}

/**
 * 0 = "AI". 1 = a real problem statement. The tier-7 gate is >= 0.5.
 *
 * Takes the RAW string, not a normalized one: `hasNamedEntity` reads
 * capitalisation, which normalization destroys.
 */
export function specificity(raw: string): number {
  if (!raw?.trim()) return 0;
  const tokens = contentTokens(raw);
  if (!tokens.length) return 0;

  const flat = normalizeText(raw);
  let s = (Math.min(tokens.length, 5) / 5) * 0.45;              // compoundness
  if (QUALIFIERS.some((q) => flat.includes(q))) s += 0.2;        // a domain, not a field
  if (hasNamedEntity(raw, tokens)) s += 0.2;                     // a named thing
  if (tokens.some((t) => ACTIVITIES.has(t))) s += 0.15;          // an actual problem

  // A pile of buzzwords is still a pile of buzzwords.
  if (tokens.every((t) => GENERIC.has(t))) s = Math.min(s, 0.25);
  return clamp01(s);
}

/** Tier 7 fires at or above this; below it the pair falls to tier 12. */
export const SPECIFIC_ENOUGH = 0.5;

export const isSpecific = (raw: string): boolean => specificity(raw) >= SPECIFIC_ENOUGH;
