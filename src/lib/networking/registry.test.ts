import assert from "node:assert/strict";
import { test, afterEach } from "vitest";
import { getNetworkingProvider, registerNetworkingProvider } from "./index";
import type { NetworkingProvider } from "./types";

const original = process.env.NETWORKING_PROVIDER;
afterEach(() => { process.env.NETWORKING_PROVIDER = original; });

test("defaults to the placeholder", () => {
  delete process.env.NETWORKING_PROVIDER;
  assert.equal(getNetworkingProvider().name, "placeholder");
});

test("a registered provider can be selected by env var", () => {
  const custom: NetworkingProvider = { name: "custom", getTargets: async () => [] };
  registerNetworkingProvider(custom);
  process.env.NETWORKING_PROVIDER = "custom";
  assert.equal(getNetworkingProvider().name, "custom");
});

test("an unknown provider degrades to the placeholder instead of throwing", () => {
  process.env.NETWORKING_PROVIDER = "not-built-yet";
  assert.equal(getNetworkingProvider().name, "placeholder");
});
