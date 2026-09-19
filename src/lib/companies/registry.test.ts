import assert from "node:assert/strict";
import { test } from "vitest";
import { KNOWN_COMPANIES, findKnownCompany, slugify } from "./registry";
import { companyInfo, monogram, resolveCompanySlug, sameCompany } from "./index";

test("every known company has a unique slug and no alias points two ways", () => {
  const slugs = KNOWN_COMPANIES.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const c of KNOWN_COMPANIES) {
    for (const alias of c.aliases ?? []) {
      assert.equal(findKnownCompany(alias)?.name, c.name, `${alias} should resolve to ${c.name}`);
    }
  }
});

test("slugs are URL-safe and stable across spellings", () => {
  assert.equal(slugify("Bain & Company"), "bain-and-company");
  assert.equal(slugify("  PwC (Campus) "), "pwc-campus");
  assert.equal(slugify("Forvis Mazars"), "forvis-mazars");
  assert.equal(companyInfo("bcg").slug, "boston-consulting-group");
  assert.equal(companyInfo("PwC (Campus)").name, "PwC");
});

test("an unknown company is first-class: its own name, a slug, and a monogram", () => {
  const info = companyInfo("Roanoke Robotics Co");
  assert.equal(info.known, false);
  assert.equal(info.name, "Roanoke Robotics Co");
  assert.equal(info.slug, "roanoke-robotics-co");
  assert.equal(info.logo, null);
  assert.equal(monogram("Roanoke Robotics Co"), "RR");
  assert.equal(monogram("Deloitte"), "D");
});

test("sameCompany agrees across aliases, suffixes and case", () => {
  assert.ok(sameCompany("BCG", "Boston Consulting Group"));
  assert.ok(sameCompany("deloitte", "Deloitte"));
  assert.ok(sameCompany("Acme Analytics Inc", "Acme Analytics"));
  assert.ok(!sameCompany("Deloitte", "Databricks"));
  assert.ok(!sameCompany("", "Deloitte"));
});

test("a dashboard slug resolves to the student's own spelling first", () => {
  assert.equal(resolveCompanySlug("deloitte", ["Deloitte", "Databricks"]), "Deloitte");
  assert.equal(resolveCompanySlug("roanoke-robotics-co", ["Roanoke Robotics Co"]), "Roanoke Robotics Co");
  // Not on the student's list, but one we know.
  assert.equal(resolveCompanySlug("stripe", []), "Stripe");
  assert.equal(resolveCompanySlug("nobody-heard-of-them", []), null);
});
