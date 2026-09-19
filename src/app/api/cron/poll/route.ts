import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestAll } from "@/lib/jobs/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled ATS ingest. Triggered by Vercel Cron (which sends
 * `Authorization: Bearer $CRON_SECRET`) or manually with the same header.
 */
function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!provided || provided.length !== secret.length) return false;

  // Constant-time compare so the endpoint does not leak the secret by timing.
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

async function run(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const summary = await ingestAll(createAdminClient());
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, ...summary });
  } catch (err) {
    console.error("[cron/poll] ingest failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "ingest failed" },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
