import { anthropicResumeProvider } from "./anthropic";
import { databricksResumeProvider } from "./databricks";
import type { ResumeProvider } from "./types";

/**
 * Provider registry, selected with RESUME_PROVIDER. Mirrors src/lib/people:
 * an unknown name degrades loudly to the default rather than throwing.
 *
 * Databricks is the default. The warehouse is where this product's data lives
 * and where skill-gap advice and resume tailoring already run, so reading the
 * resume there too means one credential and one vendor instead of two.
 */
const providers = new Map<string, ResumeProvider>([
  [databricksResumeProvider.name, databricksResumeProvider],
  [anthropicResumeProvider.name, anthropicResumeProvider],
]);

export function registerResumeProvider(provider: ResumeProvider): void {
  providers.set(provider.name, provider);
}

export function getResumeProvider(): ResumeProvider {
  const requested = process.env.RESUME_PROVIDER ?? "databricks";
  const provider = providers.get(requested);
  if (!provider) {
    console.warn(
      `[resume] provider "${requested}" is not registered; using databricks. ` +
        `Known: ${[...providers.keys()].join(", ")}`,
    );
    return databricksResumeProvider;
  }
  return provider;
}

export * from "./types";
export { UnreadablePdfError } from "./pdf-text";
