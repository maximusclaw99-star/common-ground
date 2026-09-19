import assert from "node:assert/strict";
import { beforeEach, test } from "vitest";
import { DEMO_LOGIN, demoStore } from "./demo-store";

beforeEach(() => demoStore.clear());

test("two accounts never see each other's answers", () => {
  // The bug this store replaced: one shared student, so the questionnaire
  // showed one visitor the answers another had just typed.
  const a = demoStore.createAccount("a@vt.edu", "hunter22")!;
  const b = demoStore.createAccount("b@vt.edu", "hunter22")!;

  demoStore.set(a.id, { facts: { ...demoStore.get(a.id)!.facts, hometown: "Richmond, VA" } });

  assert.equal(demoStore.get(a.id)!.facts.hometown, "Richmond, VA");
  assert.equal(demoStore.get(b.id)!.facts.hometown, null);
  assert.equal(demoStore.get(a.id)!.email, "a@vt.edu");
  assert.equal(demoStore.get(b.id)!.email, "b@vt.edu");
});

test("an address can be taken once, and case does not make a second one", () => {
  assert.ok(demoStore.createAccount("Sam@VT.edu", "password"));
  assert.equal(demoStore.createAccount("sam@vt.edu ", "password"), null);
  assert.ok(demoStore.hasAccount("SAM@vt.edu"));
});

test("sign-in needs the right password and says nothing about which part was wrong", () => {
  const made = demoStore.createAccount("sam@vt.edu", "correct horse")!;
  assert.equal(demoStore.authenticate("sam@vt.edu", "wrong")?.id, undefined);
  assert.equal(demoStore.authenticate("nobody@vt.edu", "correct horse"), null);
  assert.equal(demoStore.authenticate("sam@vt.edu", "correct horse")?.id, made.id);
});

test("an unknown session id is nobody, not the first account", () => {
  demoStore.createAccount("sam@vt.edu", "password");
  assert.equal(demoStore.get("stale-id-from-before-a-restart"), null);
  assert.equal(demoStore.get(null), null);
  assert.throws(() => demoStore.set("stale-id-from-before-a-restart", {}), /Not signed in/);
});

test("reset returns the student to the seed but keeps the account", () => {
  const acct = demoStore.createAccount("sam@vt.edu", "password")!;
  demoStore.set(acct.id, { intakeCompletedAt: "2026-09-19T12:00:00Z" });
  demoStore.reset(acct.id);
  assert.equal(demoStore.get(acct.id)!.intakeCompletedAt, null);
  assert.equal(demoStore.get(acct.id)!.email, "sam@vt.edu");
  assert.ok(demoStore.authenticate("sam@vt.edu", "password"));
});

test("the standing demo login always exists, even on a fresh store", () => {
  // Restarts and cold starts wipe every account made by hand; this one is
  // remade on start so there is always a way in.
  assert.ok(demoStore.authenticate(DEMO_LOGIN.email, DEMO_LOGIN.password));
  assert.equal(demoStore.createAccount(DEMO_LOGIN.email, "anything"), null);
});
