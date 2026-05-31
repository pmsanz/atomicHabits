# Atomic Identity Habits

A full-stack, dark-themed web application for **identity-based habit tracking**, inspired by James Clear's *Atomic Habits*. Instead of tracking habits in isolation, users first define who they want to become — their identities — and then attach daily habits as evidence of that identity. An AI coach (powered by Ollama) has full context of your progress and helps you reflect and stay consistent.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development (Replit / Node)](#local-development-replit--node)
  - [Docker (Recommended for Self-Hosting)](#docker-recommended-for-self-hosting)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [AI Coach](#ai-coach)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| Feature | Description |
|---|---|
| **Identities** | Define who you want to become ("I am a consistent reader"). Each identity tracks habit count, evidence count, and a 30-day consistency score. |
| **Habits** | Daily/weekly actions that serve as evidence for an identity. Each habit supports a minimum version ("Read 1 page") and an ideal version ("Read 20 pages"), plus a cue (implementation intention). |
| **Habit Stacks** | Pair a new habit with an anchor — "After I make coffee, I will read." |
| **Dashboard** | Today's completion rate, identity evidence reinforced, Never Miss Twice alerts, and a GitHub-style contribution heatmap. |
| **Journal** | Date-tagged entries with mood, freeform writing prompts, and tag-based search. |
| **AI Coach** | Chat with an Ollama-powered coach that has full context: habit data, last 14 days of logs, recent journal entries, and persistent AI memories across sessions. |
| **Insights** | 7-day and 30-day completion rates, best and weakest habits, strongest identity, top journal tags. |
| **Data Export** | One-click CSV export of habits, journal entries, or all data. |
| **Multi-user Auth** | JWT-based authentication — each user's data is fully isolated. |

---

## Tech Stack

### Frontend
- **React 19** + **TypeScript**
- **Vite 7** (build tooling)
- **Tailwind CSS v4** (dark GitHub aesthetic)
- **shadcn/ui** (Radix UI component library)
- **TanStack Query v5** (server state management)
- **react-hook-form** + **Zod** (form validation)
- **wouter** (client-side routing)
- **Recharts** (heatmap and charts)
- **Framer Motion** (animations)

### Backend
- **Node.js 24** + **TypeScript**
- **Express 5**
- **Drizzle ORM** (type-safe SQL)
- **PostgreSQL 16**
- **JWT** (authentication via `jsonwebtoken`)
- **bcryptjs** (password hashing)
- **Pino** (structured logging)
- **esbuild** (production bundle)

### AI
- **Ollama** (local LLM server — model is configurable)
- Context includes: dashboard summary, last 14 days of habit logs, recent journal entries, and persistent AI memories stored in the DB.

### Infrastructure
- **pnpm workspaces** (monorepo)
- **Docker** + **Docker Compose** (self-hosted deployment)
- **nginx** (static file serving + reverse proxy)
- **Orval** (OpenAPI → React Query hooks + Zod schemas codegen)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│                  React SPA (port 80)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   nginx (port 80)                           │
│  • Serves static Vite build from /usr/share/nginx/html      │
│  • Reverse-proxies /api/* → api:8080                        │
│  • SPA fallback: all unmatched routes → index.html          │
└───────────────┬──────────────────────────────────────────────┘
                │ /api/*
                ▼
┌─────────────────────────────────────────────────────────────┐
│              Express API Server (port 8080)                 │
│  Routes: /api/auth  /api/habits  /api/identities            │
│          /api/habit-stacks  /api/habit-logs                 │
│          /api/journal  /api/dashboard  /api/ai              │
│          /api/insights  /api/export                         │
└───────────┬───────────────────────────┬─────────────────────┘
            │                           │
            ▼                           ▼
┌─────────────────────┐   ┌──────────────────────────────────┐
│  PostgreSQL 16      │   │  Ollama (port 11434)             │
│  (via Drizzle ORM)  │   │  Local LLM — default: llama3.2   │
└─────────────────────┘   └──────────────────────────────────┘
```

The monorepo uses a **contract-first** API design: the OpenAPI spec (`lib/api-spec/openapi.yaml`) is the single source of truth. Run `pnpm --filter @workspace/api-spec run codegen` after any spec change to regenerate React Query hooks and Zod validators.

---

## Getting Started

### Prerequisites

- **Docker & Docker Compose** — for the self-hosted path (recommended)
- **Node.js 24** + **pnpm 10** — for local development
- **PostgreSQL 16** — for local development without Docker
- **Ollama** — optional; the AI coach gracefully degrades when unavailable

---

### Local Development (Replit / Node)

```bash
# 1. Install dependencies
pnpm install

# 2. Set environment variables
export DATABASE_URL="postgresql://user:pass@localhost:5432/atomic_habits"
export SESSION_SECRET="your-random-secret"
# Optional AI:
export OLLAMA_BASE_URL="http://localhost:11434"
export OLLAMA_MODEL="llama3.2"

# 3. Push the database schema
pnpm --filter @workspace/db run push

# 4. Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# 5. Start the frontend (separate terminal)
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/atomic-habits run dev
```

The app will be available at `http://localhost:3000` (frontend proxies `/api` to port 8080 in dev mode).

---

### Docker (Recommended for Self-Hosting)

```bash
# 1. Clone the repo
git clone https://github.com/pmsanz/atomicHabits.git
cd atomicHabits

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set SESSION_SECRET to a long random string:
# openssl rand -hex 32

# 3. Build and start all services
docker compose up --build

# App is at http://localhost
```

**What Docker Compose runs:**

| Service | Image | Role |
|---|---|---|
| `postgres` | `postgres:16-alpine` | Database |
| `ollama` | `ollama/ollama:latest` | Local LLM server |
| `ollama-model` | `ollama/ollama:latest` | Pulls the configured model on first boot, then exits |
| `migrate` | Built from `Dockerfile.api` (builder stage) | Runs Drizzle schema push, then exits |
| `api` | Built from `Dockerfile.api` (runner stage) | Express API server |
| `frontend` | Built from `Dockerfile.frontend` | nginx serving the React SPA + /api proxy |

**GPU support (NVIDIA):**
Uncomment the `deploy.resources` block for the `ollama` service in `docker-compose.yml` and ensure the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) is installed on the host.

**Changing the AI model:**
```bash
OLLAMA_MODEL=llama3.1 docker compose up
```
Any model from [ollama.com/library](https://ollama.com/library) can be used.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | — | JWT signing key — use a long random string |
| `OLLAMA_BASE_URL` | ❌ | — | Ollama server URL (e.g. `http://localhost:11434`) |
| `OLLAMA_MODEL` | ❌ | `llama3.2` | Model name to use for AI chat |
| `PORT` | ❌ | `8080` | API server port |
| `NODE_ENV` | ❌ | `development` | Set to `production` for production builds |
| `FRONTEND_PORT` | ❌ | `80` | Host port for the nginx frontend container |

---

## Project Structure

```
atomicHabits/
├── artifacts/
│   ├── api-server/            # Express API server
│   │   ├── src/
│   │   │   ├── index.ts       # Entry point, middleware setup
│   │   │   ├── routes/        # Route handlers (one file per domain)
│   │   │   │   ├── auth.ts
│   │   │   │   ├── habits.ts
│   │   │   │   ├── identities.ts
│   │   │   │   ├── habit-logs.ts
│   │   │   │   ├── habit-stacks.ts
│   │   │   │   ├── journal.ts
│   │   │   │   ├── dashboard.ts
│   │   │   │   ├── ai.ts
│   │   │   │   ├── insights.ts
│   │   │   │   └── export.ts
│   │   │   └── lib/
│   │   │       ├── auth.ts    # JWT helpers, requireAuth middleware
│   │   │       ├── ollama.ts  # Ollama client, context builder
│   │   │       └── csv.ts     # CSV export helpers
│   │   └── build.mjs          # esbuild config
│   │
│   └── atomic-habits/         # React + Vite frontend
│       └── src/
│           ├── pages/         # One file per route
│           │   ├── dashboard.tsx
│           │   ├── habits.tsx
│           │   ├── identities.tsx
│           │   ├── stacks.tsx
│           │   ├── journal.tsx
│           │   ├── ai-coach.tsx
│           │   ├── insights.tsx
│           │   └── settings.tsx
│           ├── components/    # shadcn/ui components
│           └── lib/
│               └── auth-context.tsx  # JWT auth context
│
├── lib/
│   ├── api-spec/              # OpenAPI specification (source of truth)
│   │   └── openapi.yaml
│   ├── api-client-react/      # Generated React Query hooks
│   │   └── src/generated/api.ts
│   ├── api-zod/               # Generated Zod validators
│   │   └── src/generated/api.ts
│   └── db/                    # Drizzle ORM schema + config
│       └── src/schema/
│           ├── users.ts
│           ├── identities.ts
│           ├── habits.ts
│           ├── habit-logs.ts
│           ├── habit-stacks.ts
│           ├── journal-entries.ts
│           └── ai.ts          # AI memories, chat sessions
│
├── docker/
│   └── nginx.conf             # nginx config for the frontend container
├── Dockerfile.api             # Multi-stage build for the API server
├── Dockerfile.frontend        # Multi-stage build for the frontend (nginx)
├── docker-compose.yml         # Full stack orchestration
├── .env.example               # Environment variable template
└── pnpm-workspace.yaml        # pnpm monorepo config
```

---

## API Reference

All endpoints are prefixed with `/api` and require a `Authorization: Bearer <token>` header (except auth routes).

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create a new account |
| `POST` | `/api/auth/login` | Authenticate and receive a JWT |
| `GET` | `/api/auth/me` | Get the current user's profile |

### Identities
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/identities` | List all identities with stats |
| `POST` | `/api/identities` | Create an identity |
| `PUT` | `/api/identities/:id` | Update an identity |
| `DELETE` | `/api/identities/:id` | Delete an identity |

### Habits
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/habits` | List all habits |
| `POST` | `/api/habits` | Create a habit |
| `PUT` | `/api/habits/:id` | Update a habit |
| `DELETE` | `/api/habits/:id` | Delete a habit |

### Habit Logs
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/habit-logs` | List logs (filterable by date range) |
| `POST` | `/api/habit-logs` | Create or update a log (upserts on user+habit+date) |

### Habit Stacks
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/habit-stacks` | List all stacks |
| `POST` | `/api/habit-stacks` | Create a stack |
| `PUT` | `/api/habit-stacks/:id` | Update a stack |
| `DELETE` | `/api/habit-stacks/:id` | Delete a stack |

### Journal
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/journal` | List entries (newest first) |
| `POST` | `/api/journal` | Create or update an entry (upserts on user+date) |
| `PUT` | `/api/journal/:id` | Update a journal entry |
| `DELETE` | `/api/journal/:id` | Delete a journal entry |

### Dashboard
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dashboard/today` | Today's habits, completion %, Never Miss Twice alerts |
| `GET` | `/api/dashboard/heatmap` | Last 365 days of activity for the heatmap |
| `GET` | `/api/dashboard/insights` | 7/30-day stats, best/weakest habits, top tags |

### AI Coach
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/ai/status` | Check if Ollama is available |
| `POST` | `/api/ai/chat` | Send a message, receive a streamed response |
| `GET` | `/api/ai/memories` | List AI memories for the current user |
| `DELETE` | `/api/ai/memories/:id` | Delete an AI memory |

### Export
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/export/habits.csv` | Export habit logs as CSV |
| `GET` | `/api/export/journal.csv` | Export journal entries as CSV |
| `GET` | `/api/export/all.csv` | Export everything as CSV |

---

## Database Schema

```
users              — id, name, email, passwordHash, createdAt
identities         — id, userId, name, description, colorKey
habits             — id, userId, identityId, name, habitType, frequency,
                     minimumVersion, idealVersion, cueType, cueDescription
habit_logs         — id, userId, habitId, date, completed, quantity, notes
                     UNIQUE (userId, habitId, date)
habit_stacks       — id, userId, anchorHabitId, anchorDescription,
                     newHabitId, stackPhrase
journal_entries    — id, userId, date, content, tags, mood
                     UNIQUE (userId, date)
ai_memories        — id, userId, content, createdAt
ai_chat_sessions   — id, userId, messages (JSONB), createdAt
```

---

## AI Coach

The AI coach is powered by Ollama and runs entirely locally — your data never leaves your machine.

**Context injected on every message:**
- Dashboard summary (today's completion rate, active habits)
- Last 14 days of habit log data
- Last 5 journal entries
- All stored AI memories (facts the coach has learned about you across sessions)

**Graceful degradation:** If Ollama is unreachable, `/api/ai/status` returns `{ available: false }` and the frontend displays an informative message instead of erroring.

**Setting up Ollama without Docker:**
```bash
# Install Ollama: https://ollama.com
ollama pull llama3.2
ollama serve
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes — if you modify the OpenAPI spec, run codegen:
   ```bash
   pnpm --filter @workspace/api-spec run codegen
   pnpm run typecheck
   ```
4. Push and open a Pull Request

---

## License

MIT
