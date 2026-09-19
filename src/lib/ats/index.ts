import { ashbyAdapter } from "./ashby";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { workdayAdapter } from "./workday";
import { AtsAdapter, AtsKind } from "./types";

export const adapters: Record<AtsKind, AtsAdapter> = {
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  ashby: ashbyAdapter,
  workday: workdayAdapter,
};

export function getAdapter(kind: AtsKind): AtsAdapter {
  const adapter = adapters[kind];
  if (!adapter) throw new Error(`No ATS adapter registered for "${kind}"`);
  return adapter;
}

export * from "./types";
