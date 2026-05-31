---
name: Atomic Identity Habits architecture
description: Key decisions and quirks for the Atomic Identity Habits project
---

## Auth
- JWT signed with `SESSION_SECRET` env var; tokens expire 30d; stored in localStorage as `atomic_habits_token`
- `requireAuth` middleware in `artifacts/api-server/src/lib/auth.ts` — attaches `userId` and `userEmail` to `AuthRequest`
- Frontend injects token via `setAuthTokenGetter` from `@workspace/api-client-react` (not a deep path import)

## DB
- After adding new schema files, always run `pnpm run typecheck:libs` before typecheck — otherwise leaf packages can't see new exports
- `habit_logs` table has unique constraint on (user_id, habit_id, date) — create endpoint upserts
- Journal entries upsert by (userId, date) — same pattern

## OpenAPI / Codegen
- After any spec change: `pnpm --filter @workspace/api-spec run codegen` then `pnpm run typecheck:libs`
- Codegen collision fix: ChatMessageInput / ChatReply naming (not AiChatInput/AiChatResponse) to avoid TS2308

## AI
- Ollama client in `artifacts/api-server/src/lib/ollama.ts` — gracefully returns false on healthCheck when unavailable
- Full user context (habits, identities, logs, journal, memories) injected as system prompt on every chat call
- Proposed actions returned as `<action>{json}</action>` block in AI response; stripped before display, sent to client as `proposedAction`

**Why:** Ollama is run locally by the user; the app must degrade gracefully when it's not present.
