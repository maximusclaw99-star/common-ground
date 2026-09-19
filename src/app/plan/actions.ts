"use server";

import { getPositionsProvider, rankPositions } from "@/lib/positions";
import { runPlanAgent, type AgentResult } from "@/lib/plan/agent";
import { getSession } from "@/lib/session";

export interface PlanState {
  result: AgentResult | null;
  error: string | null;
  positionId: string | null;
}

export async function buildPlan(_prev: PlanState, formData: FormData): Promise<PlanState> {
  const positionId = String(formData.get("position") ?? "");
  const { student } = await getSession();
  if (!student) return { result: null, error: "Sign in first.", positionId };
  if (!positionId) return { result: null, error: "Pick an opening.", positionId };

  const provider = getPositionsProvider();
  const positions = await provider.getPositions({ companies: student.facts.target_companies, limit: 400 });
  const position = positions.find((p) => p.id === positionId);
  if (!position) return { result: null, error: "That opening is no longer listed.", positionId };

  const scorable = { profile: student.profile, facts: student.facts };
  const ranked = rankPositions(scorable, positions);
  try {
    const result = await runPlanAgent({
      student: scorable, position, ranked,
      mode: provider.name === "databricks" ? "databricks" : "mock",
      studentEmail: student.email,
    });
    return { result, error: null, positionId };
  } catch (err) {
    console.error("[plan] agent failed", err);
    return { result: null, error: "The agent could not finish. Nothing was saved — try again.", positionId };
  }
}
