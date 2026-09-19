# Handoff — Common Ground

Written 2026-09-19 at the end of a long session. Read this first, then `README.md` and `CLAUDE.md`.

## What this is

A hackathon site (Databricks) that helps students land jobs by ranking *people* at their target
companies on the strength of a genuine commonality — a 13-tier ladder, tiers 1 and 6 deliberately
out of scope — and asking, via a gap-driven questionnaire, only for what the resume didn't say.
Founder rule: **anything not on the resume, the website asks for.** Outreach stays fully human;
only resume tailoring is AI-assisted (and that is deprioritised to last).

- Repo: `github.com/romangorkowski-bit/common-ground`, branch `main`, working dir `jobcompass/`
- Stack: Next.js 16.3.5 (App Router, `proxy.ts` not `middleware.ts`), React 19, Tailwind v4, Zod 4,
  Vitest. Design system "Terminal Brutalist" vendored in `design/`, synced by `scripts/sync-design.mjs`.
- Live at **https://common-ground-three-ecru.vercel.app** (the working link — see blockers).
- Checks: `npm run typecheck && npm run lint && npx vitest run && npm run build` — all green at
  `8c49f16` (144 tests, 4 skipped).
- Teammate (Stephen) pushes to the same repo; PR #5 added 1,100 synthetic VT alumni + portraits
  under `databricks/`. Rebase before pushing; no file overlap so far.

## State of things (all pushed)

| Done | Commit |
|---|---|
| Loading bar while a resume is read (indeterminate, per-reader stages) | `484151a` |
| Continue-button bug + searchable multi-selects for companies/roles/majors | `89dc3b1` |
| Landing page: second hero button removed, ladder section removed | `1f5b70d`, `becfd9e` |
| Copy cut across every page; questionnaire help trimmed; openings labelled as sample data | `becfd9e` |
| Dictation is a circular mic at the end of the field (`.tb-mic`, `Dictation`/`MicField`) | `4faffa6` |
| Sign-up handles email-confirmation (no session) case; nav has email + Sign out | `8c49f16` |

Currently runs in **demo mode**: no `.env.local`, so `isSupabaseConfigured()` is false. Demo mode
now has real (in-memory) accounts — see the 2026-09-19 evening session below.

## 2026-09-19 evening session — the five requests below are DONE (uncommitted when written)

| Request | What changed |
|---|---|
| 1. Account before upload | `proxy.ts` gates the protected paths in demo mode too, on a `cg_demo` cookie (`src/lib/session/cookie.ts`). Sign-up/sign-in work without Supabase: `demoStore` holds accounts (scrypt-hashed passwords) and one student each. Landing CTA is "Make an account" when signed out. |
| 2. Questionnaire kept other people's answers | Root cause was the single shared demo student. `demo-store.ts` is per account; `getSession()` reads the cookie; a stale id (after restart) is nobody and the page redirects to sign-in. "Start the questions over" on `/intake` (`restartQuestionsAction`) clears answers for this account only. Test: `demo-store.test.ts`. |
| 3. No company question in intake | `target_companies` removed from `FIELDS`; `THEME_COPY.targets` reworded. The facts key stays and is written from the dashboard. |
| 4. Boxes touching | `.tb-card` padding 20→24; new `.tb-cards` grid (24px gap, 32px at ≥768) and `.tb-stack` in `globals.css`; every card/panel grid uses them. NB `.tb-grid` is TAKEN by the design bundle (an absolute-positioned background) — never reuse that name. |
| 5. Dashboard picks a company | `/dashboard` is a company picker (`src/lib/companies/pool.ts` counts people + openings per employer from the providers). Choosing persists to `target_companies` (`dashboard/actions.ts`) and lands on `/dashboard/[company]`, which ranks only people there, lists its openings, the outstanding questions, and a short "strong ties elsewhere" tail. Person page links back to its company. |
| 6. Logos | `src/lib/companies/registry.ts` (~80 employers, aliases, domains, sectors); `scripts/fetch-logos.ts` vendors PNGs into `public/logos/` + `manifest.json`; `CompanyLogo` shows a monogram when there is none. Google's favicon service is the source; 5 companies have none. |

Checks after: typecheck, lint, 154 tests, `next build` — see the session transcript for the exact output.

## The original request list (kept for context)

1. **Account before upload.** Require sign-up/sign-in before `/onboarding/upload`. `proxy.ts`
   already redirects protected paths when Supabase is configured; in demo mode every route is open.
   Decide whether demo mode should still gate (probably yes, with a lightweight cookie identity)
   or whether this simply lands with Supabase (see blocker 3).
2. **Questionnaire keeps information / restarts.** Cause: `demoStore` is a single module-level
   object shared by every visitor and every request; answers persist until the server restarts and
   are visible to whoever loads next. On Vercel, cold starts wipe it. Real fix = per-user storage
   (Supabase) or, at minimum, a per-browser cookie-scoped demo store. Also check `safeIndex`
   clamping in `intake-flow.tsx` and that `/intake` doesn't reshuffle steps mid-flow.
3. **Don't ask target companies in the first part.** The first steps should only be about the
   person. `target_companies` is `required` + `minAnswers: 3` in `src/lib/intake/fields.ts` and
   `groupIntoSteps` puts every required gap on step 1. Move company choice out of the questionnaire
   to the dashboard (request 5); make `target_companies` not required / not asked in intake.
4. **Boxes touching.** Panels/cards need clear space between them. Look at `.tb-panel`, `.tb-card`,
   the grids in `dashboard/page.tsx`, `jobs/page.tsx`, `person-card.tsx`, `opening-row.tsx`, and
   the intake field spacing in `intake-flow.tsx`. Verify in the browser at ~800px and ~1280px.
5. **Dashboard flow.** After the questionnaire → dashboard. On the dashboard the user **picks the
   company** they want to apply to, and only then sees people to network with at that company.
   Today `/dashboard` ranks people across all `target_companies` at once. Needs a company picker
   (persist the selection) and a per-company people list; `getPeopleProvider().getPeople({companies})`
   already takes a company list.

Do 3 and 5 together — they are one change (company choice moves from intake to dashboard).

## Blockers only the user can clear

1. **Vercel Deployment Protection is still ON** for the project (`ssoProtection:
   all_except_custom_domains`). `common-ground-commongroud.vercel.app` and the `-git-main-` URL
   redirect to Vercel login; **`common-ground-three-ecru.vercel.app` works** — share that one.
   Turning it off: Vercel → project → Settings → Deployment Protection → toggle "Require Log In"
   off → Save (their Save hadn't persisted last time). Vercel CLI is logged in locally
   (`npx vercel@latest`, team `commongroud`, project id `prj_Ferou2JMubl9VdBP2gPAoWM5KFAV`); the
   setting can be cleared via `PATCH /v9/projects/{id}` with `ssoProtection: null` **only with the
   user's explicit yes**.
2. **Teammate's GitHub username** was never supplied (for collaborator invite). Also: Hobby plan
   blocks Vercel builds for commits authored by non-owners on private repos — every Stephen push
   needs a Roman-authored commit on top to deploy.
3. **Supabase never created.** All account code exists; needs a project, the three migrations in
   `supabase/migrations/` run in order, and `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` set in `.env.local` and Vercel. README "Turning on accounts" has
   the steps. Recommend turning off email confirmation for the demo. The user may paste the URL
   and anon key into chat; the service-role key they set themselves.
4. **Databricks credentials never set** (`DATABRICKS_HOST`, `DATABRICKS_WAREHOUSE_ID`,
   `DATABRICKS_TOKEN`). The resume reader (`src/lib/resume/databricks.ts`, `ai_query` on
   `databricks-meta-llama-3-3-70b-instruct`) has never run against the live warehouse.

## Things learned the hard way (don't re-learn)

- React 19 lint: no ref writes during render, no setState in effects, no conditional hooks →
  `useSyncExternalStore` for clocks/support detection; split components instead of early returns
  above hooks.
- Enter in the browser-automation tool doesn't reach the Combobox; dispatch a `keydown` via JS or
  click the option row (`onMouseDown`, not `onClick` — blur closes the list first).
- `@layer components` loses to unlayered CSS; `getComputedStyle` reads can be stale right after an
  attribute change.
- Resume text goes to SQL only as a **bound parameter**, never concatenated.
- No secrets have ever been committed (history scanned). `.env.example` is force-included in git.
- The generated design outputs (`public/tb/bundle.js`, `src/styles/tb-bundle.generated.css`) are
  **committed** — a clean clone failed to build when they were gitignored.
- Don't invent readings: the design system's rule is that a fabricated number makes the page "a
  costume". Progress is indeterminate for that reason.
- Commit trailer in use: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Verify UI in the browser before and after; revert every probe and `grep` for leftovers.
