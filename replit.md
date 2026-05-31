# Atomic Identity Habits

A full-stack identity-based habit tracking app. Users define who they want to become (identities), attach daily habits as evidence of that identity, journal their progress, and get coached by an AI (Ollama).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifacts/atomic-habits) — wouter routing, Tanstack Query, react-hook-form
- API: Express 5 (artifacts/api-server)
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT bearer tokens via SESSION_SECRET; stored in localStorage as `atomic_habits_token`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- AI: Ollama (configurable via OLLAMA_BASE_URL and OLLAMA_MODEL env vars)

## Where things live

- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Generated React hooks: `lib/api-client-react/src/generated/api.ts`
- Generated Zod schemas: `lib/api-zod/src/generated/api.ts`
- DB schema: `lib/db/src/schema/` (one file per table, re-exported from index.ts)
- API routes: `artifacts/api-server/src/routes/` (auth, identities, habits, habit-logs, habit-stacks, journal, dashboard, ai, export)
- Frontend pages: `artifacts/atomic-habits/src/pages/`
- Auth context: `artifacts/atomic-habits/src/lib/auth-context.tsx`
- Custom fetch (auth injection): `lib/api-client-react/src/custom-fetch.ts` — exports `setAuthTokenGetter`

## Architecture decisions

- JWT auth: `SESSION_SECRET` env var used as signing key; tokens expire in 30 days
- Contract-first API: OpenAPI spec is the source of truth; run codegen after any spec change
- Upsert semantics: habit-logs and journal entries upsert by (userId, habitId/date) to prevent duplicates
- AI context building: dashboard data + last 14 days of logs + recent journal + AI memories passed as system context on every chat request
- Ollama: AI coach uses local Ollama; gracefully degrades when unavailable (status endpoint returns `available: false`)

## Product

- **Identities**: Define who you want to become ("I am a consistent reader")
- **Habits**: Daily/weekly actions that provide evidence for an identity; includes minimum/ideal versions, cue-routine-reward framework
- **Habit Stacks**: Pair a new habit after an anchor ("After coffee, I will read")
- **Dashboard**: Today's completion rate, identity evidence reinforced, Never Miss Twice alerts, heatmap
- **Journal**: Date-tagged entries with mood, tags, and writing prompts
- **AI Coach**: Chat with Ollama-powered coach that has full context of your habit data
- **Insights**: 7/30-day rates, best/weakest habits, strongest identity, top journal tags
- **Export**: CSV export of habits, journal, and all data

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing the OpenAPI spec, always run `pnpm --filter @workspace/api-spec run codegen` then `pnpm run typecheck:libs`
- After changing DB schema files, run `pnpm run typecheck:libs` before running `pnpm --filter @workspace/db run push`
- AI chat won't work unless Ollama is running locally; set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` env vars
- The `habit_logs` table has a unique constraint on (user_id, habit_id, date) — the create endpoint upserts automatically

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
