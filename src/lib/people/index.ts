import { databricksPeopleProvider } from "./databricks";
import { mockPeopleProvider } from "./mock";
import type { PeopleProvider } from "./types";

/**
 * Provider registry, selected with PEOPLE_PROVIDER. Mirrors the networking
 * registry: a missing provider degrades the connections panel rather than
 * breaking the page around it.
 */
const providers = new Map<string, PeopleProvider>([
  [mockPeopleProvider.name, mockPeopleProvider],
  [databricksPeopleProvider.name, databricksPeopleProvider],
]);

export function registerPeopleProvider(provider: PeopleProvider): void {
  providers.set(provider.name, provider);
}

export function getPeopleProvider(): PeopleProvider {
  const requested = process.env.PEOPLE_PROVIDER ?? "mock";
  const provider = providers.get(requested);
  if (!provider) {
    console.warn(
      `[people] provider "${requested}" is not registered; using mock. ` +
        `Known: ${[...providers.keys()].join(", ")}`,
    );
    return mockPeopleProvider;
  }
  return provider;
}

export * from "./types";
