import { placeholderNetworkingProvider } from "./placeholder";
import type { NetworkingProvider } from "./types";

/**
 * Provider registry. The dedicated networking module registers itself here and
 * is selected with NETWORKING_PROVIDER — nothing else in the app changes.
 */
const providers = new Map<string, NetworkingProvider>([
  [placeholderNetworkingProvider.name, placeholderNetworkingProvider],
]);

export function registerNetworkingProvider(provider: NetworkingProvider): void {
  providers.set(provider.name, provider);
}

export function getNetworkingProvider(): NetworkingProvider {
  const requested = process.env.NETWORKING_PROVIDER ?? "placeholder";
  const provider = providers.get(requested);

  if (!provider) {
    // Fall back loudly: a missing provider should degrade the networking
    // panel, not break the job page around it.
    console.warn(
      `[networking] provider "${requested}" is not registered; using placeholder. ` +
        `Known: ${[...providers.keys()].join(", ")}`,
    );
    return placeholderNetworkingProvider;
  }
  return provider;
}

export * from "./types";
