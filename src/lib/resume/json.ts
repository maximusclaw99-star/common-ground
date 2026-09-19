/**
 * Pulls a JSON object out of a chat model's reply.
 *
 * Claude with a zod output format returns parsed JSON and nothing else. Llama
 * 3.3 70B through `ai_query` returns a string, and instruction-following at
 * that size is good but not perfect: it fences the JSON, or prefaces it with
 * "Here is the profile:", or adds a closing remark. Rather than fail the
 * upload on a stray sentence, find the outermost balanced object and parse it.
 *
 * Brace counting is string-aware; a resume full of braces inside quoted values
 * would defeat a naive lastIndexOf('}').
 */
export function extractJsonObject(raw: string): unknown {
  const text = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();

  const start = text.indexOf("{");
  if (start === -1) throw new SyntaxError("no JSON object in the model's reply");

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { if (inString) escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new SyntaxError("the model's JSON object was never closed");
}
