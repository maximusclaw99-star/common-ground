import assert from "node:assert/strict";
import { beforeEach, test } from "vitest";
import { demoStore } from "./demo-store";

beforeEach(() => demoStore.clear());

test("two browsers never see each other's answers", () => {
  // The bug this store replaced: one shared student, so the questionnaire
  // showed one visitor the answers another had just typed.
  demoStore.set("browser-a", { facts: { ...demoStore.get("browser-a")!.facts, hometown: "Richmond, VA" } });

  assert.equal(demoStore.get("browser-a")!.facts.hometown, "Richmond, VA");
  assert.equal(demoStore.get("browser-b")!.facts.hometown, null);
  assert.equal(demoStore.size(), 2);
});

test("an id the store has never seen gets a fresh student, not an error", () => {
  // After a restart every browser still carries its old cookie. That must
  // mean "start again", never "session expired".
  const student = demoStore.get("cookie-from-before-a-restart");
  assert.ok(student);
  assert.equal(student.intakeCompletedAt, null);
  assert.equal(demoStore.get(null), null);
  assert.equal(demoStore.get(""), null);
});

test("reset returns the student to the seed", () => {
  demoStore.set("browser-a", { intakeCompletedAt: "2026-09-19T12:00:00Z" });
  demoStore.reset("browser-a");
  assert.equal(demoStore.get("browser-a")!.intakeCompletedAt, null);
});
