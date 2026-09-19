import { AI_QUERY_MODEL, databricksConfig } from "./sql";

/**
 * Chat completions against a Databricks-hosted model, with tool calling.
 *
 * `ai_query` in SQL is fine for one-shot prompts; an agent needs the model to
 * return structured tool calls and then see the tool results, which is the
 * OpenAI-compatible route on Model Serving. Same credential, same model as
 * everything else in the app (Llama 3.3 70B on Free Edition — no Claude there).
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatOptions {
  tools?: ToolSpec[];
  toolChoice?: "auto" | "none" | "required";
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatMessage> {
  const cfg = databricksConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000);
  try {
    const res = await fetch(`https://${cfg.host}/serving-endpoints/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_QUERY_MODEL,
        messages,
        ...(opts.tools?.length ? { tools: opts.tools, tool_choice: opts.toolChoice ?? "auto" } : {}),
        max_tokens: opts.maxTokens ?? 800,
        temperature: opts.temperature ?? 0.2,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Databricks chat failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { choices?: { message?: ChatMessage }[] };
    const msg = body.choices?.[0]?.message;
    if (!msg) throw new Error("Databricks chat returned no message");
    return { role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls };
  } finally {
    clearTimeout(timer);
  }
}

export function parseArguments(call: ToolCall): Record<string, unknown> {
  try {
    const v = JSON.parse(call.function.arguments || "{}");
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
