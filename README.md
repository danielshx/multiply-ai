# Multiply — Swarm Outreach Engine

> 25 personalized AI sales agents in parallel. Each researches its lead, switches mode (Cold → Warm → Hot → Human-Handoff) live, and learns across calls.

Built for the **HappyRobot × TUM.ai** challenge as **Idea 1**. Hero demo = "Live Swarm": the system calls all 5 team members live during the 3-min pitch (5 calls).....

## Where things live

| What | Where |‚‚
|---|---|
| **Planning, demo script, scoring, ideas, HR docs mirror** | `../HappyRobot-TumAI/` (the brain repo) |
| **Product code (this repo)** | here |
| **HR workflows** | clicked together in the HR editor at `platform.eu.happyrobot.ai`, exported into `happyrobot/` |

Read these in the brain repo first:
- `README.md` lines 30–116 — Idea 1 spec
- `README.md` lines 116–240 — Live Swarm demo concept
- `planning/03-architecture.md` — system overview + data flows
- `planning/05-happyrobot-workflows.md` — node-by-node HR blueprints
- `planning/06-ui-screens.md` — UI screens
- `reference/api-cheatsheet.md` — HR endpoints

## Status

**Skeleton only.** All route handlers return 501. All components are stubs. Plan: `~/.claude/plans/ich-habe-hier-ein-quiet-pebble.md`.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres + Realtime) · HappyRobot (EU) · HR Twin DB (workflow dump) · Vercel.

## Run locally (after install)

```bash
cp .env.example .env.local   # fill in keys
npm install
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test:e2e`.
