# Buildloud

Next.js editorial production app for social networks: onboarding captures the brand and its topics,
an "editor-in-chief" plans content series, and the app generates the scripts and places them in a
calendar.

## Quick start

Prerequisites: **Node 20+** and **Docker Desktop** (running).

```bash
npm install
npm run setup
npm run dev
```

`npm run setup` does everything else: it creates `.env` from `.env.example` (with a generated
`AUTH_SECRET`), starts the Postgres database from `docker-compose.yml`, waits for it to respond and
applies the migrations. It is safe to rerun — an existing `.env` is never overwritten.

The app then runs at http://localhost:3000.

### An LLM key is required — OpenAI for now

Without a key, the app starts but onboarding cannot generate anything — so there is nothing to test.
Two lines to fill in `.env`:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

> **Only OpenAI works today.** `LLM_PROVIDER` also accepts `gemini`, `anthropic` and
> `groq`: these providers exist in the code but are not operational, do not rely on them
> to run the app.

Everything else in `.env.example` is optional: without the OAuth keys (TikTok, Instagram, LinkedIn,
GitHub), without Stripe, without R2 storage, the app works — only the features concerned are
inactive or hidden. Without `BREVO_API_KEY`, service emails (forgotten password, security
notices) are written to the server logs instead of being sent: the reset link can be read
directly in the terminal. To send for real (Brevo key, sending domain to authenticate,
`EMAIL_FROM`), follow `docs/SETUP_EMAILS_BREVO.md`. The visual resource library requires R2 + Google Cloud
(`docs/SETUP_RESSOURCES_VISUELLES.md`).

## The database

`docker-compose.yml` runs the **`pgvector/pgvector:pg17`** image, not a bare Postgres image:
migration `0007` creates the `vector` extension (visual library embeddings). The host port
is **5433** so it can coexist with a Postgres already installed on the machine.

```bash
docker compose up -d     # start the database
docker compose down      # stop it (data is kept in a volume)
docker compose down -v   # remove everything, including the data
```

To use an already installed Postgres instead of Docker: it needs the pgvector extension (see
`drizzle/README_PGVECTOR.md`), then just point `DATABASE_URL` at it and run
`npm run db:migrate`.

## Commands

| Command | Effect |
| --- | --- |
| `npm run setup` | First launch: `.env`, Docker database, migrations |
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build / launch |
| `npm run lint` | ESLint |
| `npm run test` | Vitest suite (pure logic, mocked LLM calls, no database required) |
| `npm run db:generate` | Generates a SQL migration from `src/db/schema.ts` |
| `npm run db:migrate` | Applies pending migrations to `DATABASE_URL` |
| `npm run db:studio` | Opens Drizzle Studio to inspect the database |

## Documentation

The documents in `docs/` are written in French.

- `docs/PRODUCT.md` — product vision and features.
- `docs/TECH.md` — stack, data model, endpoints, prompt architecture.
- `docs/DEPLOIEMENT_VPS.md` — production deployment on a VPS (Docker Compose, Caddy, backups).
- `docs/` — the per-project specs (series and roles, editor-in-chief, agentic assistant,
  visual resources, developer onboarding).

## License

Buildloud is distributed under the [Elastic License 2.0](LICENSE).

In short:

- ✅ You may install it, use it (including in a professional setting), modify it and
  redistribute it.
- ❌ You may not offer it to third parties as a hosted or managed service (SaaS).
- ❌ You may not remove or circumvent the license notices.

This summary has no legal value, only the `LICENSE` file is authoritative. For commercial use
as a service, contact alix.chagotpro@gmail.com.

Copyright © 2026 Alix Chagot. "Buildloud" is a trademark of Alix Chagot.
