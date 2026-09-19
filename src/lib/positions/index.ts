import { databricksPositionsProvider } from "./databricks";
import { mockPositionsProvider } from "./mock";
import type { PositionsProvider } from "./types";

/**
 * Provider registry, selected with POSITIONS_PROVIDER and falling back to
 * PEOPLE_PROVIDER so one variable flips the whole app to the warehouse.
 * Mirrors the people registry: an unknown name degrades to mock rather than
 * breaking the page around it.
 */
const providers = new Map<string, PositionsProvider>([
  [mockPositionsProvider.name, mockPositionsProvider],
  [databricksPositionsProvider.name, databricksPositionsProvider],
]);

export function getPositionsProvider(): PositionsProvider {
  const requested = process.env.POSITIONS_PROVIDER ?? process.env.PEOPLE_PROVIDER ?? "mock";
  const provider = providers.get(requested);
  if (!provider) {
    console.warn(
      `[positions] provider "${requested}" is not registered; using mock. ` +
        `Known: ${[...providers.keys()].join(", ")}`,
    );
    return mockPositionsProvider;
  }
  return provider;
}

export * from "./types";
export { rankPositions, scorePosition, windowStatus, studentVerticals } from "./score";
export type { PositionScore, RankedPosition, WindowStatus } from "./score";
export { positionGaps, headlineGap } from "./gaps";
export type { Gap } from "./gaps";
