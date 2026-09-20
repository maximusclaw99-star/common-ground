"use server";

import { getPositionsProvider, rankPositions } from "@/lib/positions";
import { runPlanAgent, type AgentResult } from "@/lib/plan/agent";
import { getSession } from "@/lib/session";

export interface AskState {
  result: AgentResult | null;
  error: string | null;
}

/** Runs the plan agent for one opening. Nothing is stored on the student; the run itself is logged to agent_runs. */
export async function askAgent(_prev: AskState, formData: FormData): Promise<AskState> {
  const positionId = String(formData.get("position") ?? "");
  const { student } = await getSession();
  if (!student) return { result: null, error: "Sign in first." };

  const provider = getPositionsProvider();
  const positions = await provider.getPositions({ companies: student.facts.target_companies, limit: 8000 });
  const position = positions.find((p) => p.id === positionId);
  if (!position) return { result: null, error: "That opening is no longer listed." };

  const scorable = { profile: student.profile, facts: student.facts };
  try {
    const result = await runPlanAgent({
      student: scorable, position, ranked: rankPositions(scorable, positions),
      mode: provider.name === "databricks" ? "databricks" : "mock",
      studentEmail: student.email,
    });
    return { result, error: null };
  } catch (err) {
    console.error("[opening] agent failed", err);
    return { result: null, error: "The agent could not finish. Nothing was saved — try again." };
  }
}
