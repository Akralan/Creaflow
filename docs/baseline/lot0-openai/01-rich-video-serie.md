# Brief 01-rich-video-serie

> Matière riche (23 docs, MyTwin Leaderboard) · vidéo TikTok · série imposée (Coulisses du Vendredi)

- Plateforme : tiktok
- Type de contenu : video
- Catégorie : Coulisses (8fe7a710-2f88-42ad-aa72-e637ab845b4e)
- Produit : MyTwin Leaderboard
- Série : Coulisses du Vendredi
- Angle imposé : Défi ludique
- Documents de matière injectés : 23

## Message utilisateur assemblé (envoyé au LLM)

```
Marque : MarvelousDev (développement de produits et projets ludiques)
Ton : Utilise le "je" car je suis seul, c'est du personnal branding un peu ces projets. J'aime bien que les scripts et une conclusion
Temps disponible par semaine : 7h
Produit concerné : MyTwin Leaderboard
Matière factuelle disponible sur ce sujet (base-toi dessus en priorité, n'invente rien au-delà). Les passages entourés de [déjà utilisé dans un post précédent]...[/déjà utilisé] ont déjà servi dans un post — évite de les reprendre tels quels, un nouvel angle sur le même fait reste bienvenu :
J'ai commencé à reprendre le contact avec certains des 60 contributeurs de lab : ceux qui font du ML afin de les lancer sur les 2 challenges ouverts : mammography classification et mammography segmentation

---

[validation-challenges.md]
# Validation Challenges

`type: 'validation'` challenges let contributors manually test whether a submitted ML API packaging actually works — drop a file, call the live deployed endpoint, see the raw output, then vote **Fonctionne** or **Défectueux**. Once a submission collects a fixed number of votes, the majority side is paid CP from the validation challenge's own pool; the minority gets nothing. It's a human sanity-check tool, separate from AI scoring.

**Requires:** nothing beyond the base app — no AI, no external credentials. The endpoint being validated must be publicly reachable over HTTP(S).

---

## Why a separate system

Today an `ml` challenge's "API packaging" step is scored purely by AI-grading the packaging *code* (against the code grid, same as any other code submission) — nobody actually calls the deployed model to see if it works. A **validation challenge** adds that missing piece: a human drops a test file, the platform proxies it to the contributor's live endpoint, and shows the model's actual output.

This is deliberately **not** an automated grader. It doesn't touch `evaluation_status`, `evaluation`, or `globalScore` on the source contribution at all — it's a fully separate mechanism with its own CP pool, for a fully separate purpose (does it work?, not how good is the code?).

---

## How it works

A validation challenge is a `challenges` row with `type: 'validation'`, linked 1:1 to an existing `ml` "work challenge" via `source_challenge_id`. It has its own `contribution_points_reward` (CP pool) and its own `cp_per_validation` (fixed CP a validator earns per first-time validation) — both set once at creation and locked afterward, same as an ML challenge's pool/project.

```
Contributor (ML workspace, API packaging step)
  → submits GitHub repo URL, creating the api_packaging contribution

Admin (validation challenge config)
  → picks which api_packaging contribution to expose (traceability — who gets
    credited) and enters the endpoint URL to test at that same moment
       ↓ saved to contributions.live_endpoint_url, creates a validation_targets row

Validator (any logged-in contributor, on the validation challenge page)
  → drops a file on an exposed target
    → POST /api/challenges/:id/validate  (multipart: contribution_id, file)
      → server verifies the target is exposed
      → server SSRF-guards the endpoint URL (blocks private/loopback/link-local
        addresses, blocks redirects, enforces a 15s timeout and a 10MB response cap)
      → server proxies the file to the endpoint, returns the raw response
    → client renders the response generically: image/* → <img>, JSON → pretty
      field-by-field viewer (with base64/data-URI image fields shown inline),
      anything else → raw text
  → validator casts a verdict based on what they saw
    → POST /api/challenges/:id/validation-verdicts  { contribution_id, verdict, description }
      → rejects a self-vote (can't vote on your own submission) or a second vote
        from the same validator on the same target
      → once the target has collected `required_validations` verdicts, it
        resolves permanently: majority wins, and every validator on the
        majority side is paid `cp_per_validation` (minority gets nothing)
```

The browser never calls the contributor's deployed endpoint directly — third-party deployments (HuggingFace Spaces, Render, etc.) generally won't have CORS configured for this app's origin, and a client-side "I got a valid response" claim would be unverifiable and would make the CP award trivially spoofable. The server is the one that observes the response, so it's the one that decides whether CP is earned.

## Rewards: fixed, from the validation challenge's own pool

Unlike Slack discussion signals (fixed, but explicitly *outside* the ML pool), validation rewards drain the **validation challenge's own** pool — a validation challenge is a `challenges` row like any other, so it gets its own budget and its own `reward_entries` (`rule_key: 'validation'`).

- Each validation challenge sets `cp_per_validation` (CP per validator, on the winning side) and `required_validations` (an odd number — how many verdicts a target needs before it resolves) once at creation; both are locked afterward.
- CP is paid only once a target resolves — never per individual call. Only validators whose verdict matches the resolved majority get paid; the minority earns nothing, even though they did the same work of testing.
- One `type: 'validation'` contribution per validator per validation challenge aggregates the ledger, mirroring the `type: 'discussion'` pattern used for Slack signals — a chip, not a contribution-list entry.
- Before a target resolves, everyone sees only a blind participation count ("3/5 validations reçues") — never the works/broken split. The challenge's admin/manager is the one exception, seeing the live split for oversight.
- A failed proxied call (timeout, non-2xx, SSRF-blocked, redirect) records no verdict and no quorum progress — the validator can retry.
- A target that never collects enough votes just stays unresolved — no CP paid, no error.
- Repeat testing of an already-resolved target is allowed (useful for sanity-checking again) — it just earns no further CP and doesn't affect the permanent outcome.

---

## Setting it up

1. **Contributor side:** in an `ml` challenge's ML workspace, on the "API Packaging" step, submit the GitHub repo URL — that's what creates the `api_packaging` contribution. There is no endpoint field for the contributor; the deployed endpoint isn't declared here.
2. **Admin/manager side:** create a new challenge with type "Validation", pick the source `ml` challenge (one validation challenge per ML challenge — the API rejects a second one), set the CP pool and CP-per-validation rate. Then, editing the challenge, use the "Validation targets" section: pick an eligible `api_packaging` submission and type its deployed endpoint URL to expose it.
3. **Anyone:** open the validation challenge page, drop a file on an exposed submission, see the output.

---

## Testing locally

The SSRF guard blocks `localhost` and private addresses by design — including when the endpoint and the app are running on the same machine. To test with a model API running locally (e.g. in Docker on `localhost:8080`), set in your local `.env`:

```
VALIDATION_ALLOW_PRIVATE_ENDPOINTS=true
```

This skips the private/loopback block entirely. **Local dev only — never set this in production**; it's the one thing standing between a validator and SSRF. See `packages/config/index.ts` and `packages/services/challenge/ssrf-guard.ts`.

## Limitations (v1)

- Only `ml` challenges' `api_packaging` submissions — no other submission type, and no path to extend this to `code` challenges yet.
- No persisted history: neither the uploaded file nor the API's response is stored anywhere — only that a validation happened (validator, target, timestamp), for CP dedupe and audit.
- No automated or scheduled validation — always a manual, human-triggered drop.
- The SSRF guard resolves the endpoint's hostname once before calling it and blocks redirects, but a DNS-rebinding attacker who changes the record between that check and the actual `fetch` call could still slip through — a known, accepted gap for an internal tool, not something this guard tries to close.
- Metrics/output correctness is exactly whatever the endpoint returns and what validators judge — nothing here verifies the model's output against a ground truth.
- A target that never gets a single successful (2xx) response can never resolve, even if the endpoint is obviously broken — there's no "N technical failures = broken" path.
- No reward or recognition flows to the `api_packaging` contribution's author when their submission resolves `works` — CP in this system stays entirely on the validator side.

---

## Key files

| File | Purpose |
|------|---------|
| `packages/database-service/db/drizzle.ts` | `challenges.source_challenge_id` / `cp_per_validation`, `contributions.live_endpoint_url`, `validation_targets`, `validation_attempts` |
| `packages/database-service/repositories/validationTarget.repo.ts` | CRUD for exposed targets |
| `packages/database-service/repositories/validationAttempt.repo.ts` | Dedup-safe attempt recording (`create` returns `null` on a unique-violation race) |
| `packages/services/challenge/ssrf-guard.ts` | `assertPublicHttpUrl` — blocks private/loopback/link-local/non-http(s) targets |
| `packages/services/challenge/validation-challenge.service.ts` | Orchestrates the proxy call, dedupe, and pool-clamped CP award |
| `apps/leaderboard-client/src/app/api/challenges/route.ts` | Challenge creation, including `type: 'validation'` validation and 1:1 enforcement |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/route.ts` | List exposed targets / eligible submissions, add a target (admin/manager sets `live_endpoint_url` here) |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/[targetId]/route.ts` | Remove a target |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validate/route.ts` | The proxy endpoint contributors hit when dropping a file |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-verdicts/route.ts` | Casts a verdict; resolves the target and pays the majority once quorum is reached |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-rewards/route.ts` | Pool state + per-validator breakdown, admin/manager only |
| `apps/leaderboard-client/src/components/admin/ValidationRewardsPanel.tsx` | Admin: CP pool summary for a validation challenge |
| `apps/leaderboard-client/src/components/admin/ValidationTargetsEditor.tsx` | Admin: pick which submissions to expose |
| `apps/leaderboard-client/src/components/challenges/ValidationChallengeFlow.tsx` | Contributor: dropzone per exposed target |
| `apps/leaderboard-client/src/components/challenges/ValidationOutputViewer.tsx` | Generic image/JSON/text renderer for the API's response |

---

[testing.md]
# Testing

## Unit & integration tests (Vitest)

Tests use **Vitest** with Testing Library for React components.

Run all tests from the repo root:

```bash
npm test
```

Run tests for the Next.js app specifically:

```bash
cd apps/leaderboard-client && npm test
```

Useful variants:

```bash
npm run test:watch      # watch mode (re-runs on file changes)
npm run test:coverage   # generate coverage report
```

Test files live alongside the code they test, typically as `*.test.ts` or `*.spec.ts`.

---

## Ad-hoc integration scripts (`packages/test`)

These are manual test scripts for verifying integrations — they are not Vitest tests. Run them directly with `tsx`:

```bash
# Test the database connection
npx tsx packages/test/test-db-connection.ts

# Test the GitHub connector
npx tsx packages/test/test-github-connector.ts

# Test the Google Drive connector
npx tsx packages/test/test-google-drive-connector.ts
```

> These scripts read from your `.env` file. Some require optional credentials (GitHub token, Google OAuth, OpenAI key).

---

## What to test when contributing

When adding a new feature or fixing a bug:

1. **Add a Vitest test** for any logic that can be tested in isolation (utilities, transformations, validators).
2. **Use the ad-hoc scripts** in `packages/test/` if you're touching a connector, the evaluator, or the database service and want to verify the integration against real credentials.
3. **Run `npm test`** before opening a PR to make sure nothing is broken.

---

[sync-meetings.md]
# Sync Meetings

Sync meetings are team synchronization meetings that are **created directly from the leaderboard app** in Google Workspace, then **automatically analyzed by AI** after they conclude.

**Requires:** Google Workspace service account credentials + `OPENAI_API_KEY`

---

## What it does

1. An admin, or the manager of the challenge's project, creates a sync meeting from the app — this provisions a Google Calendar event with a Google Meet link for the team.
2. The team meets using that Google Meet link.
3. After the meeting, the system (via cron or manual trigger) detects that the meeting has ended and ingests the content.
4. The AI analysis agent processes the meeting and produces a structured report.

---

## Full flow

```
Admin or project manager creates meeting in app
        ↓
Google Calendar event created (via service account)
Google Meet link provisioned
        ↓
Team holds the meeting
        ↓
Cron job: /api/cron/check-meetings
        ↓
MeetingPollingService: detect completed meetings
        ↓
MeetingIngestionService: fetch transcript / content
        ↓
MeetingAnalysisService → sync-meeting-agent (OpenAI)
        ↓
Analysis stored in meeting_analyses table
        ↓
Available in the leaderboard UI
```

---

## AI analysis output

The `packages/sync-meeting-agent` produces a structured analysis with:

- **Summary** — concise overview of what was discussed
- **Decisions** — key decisions made during the meeting
- **Action items** — follow-up tasks with assignees
- **Contribution signals** — who contributed what, useful for the evaluation pipeline

Output is validated with Zod schemas before being stored.

---

## Services involved

| Service | Responsibility |
|---------|----------------|
| `google-calendar.service.ts` | Creates and manages Google Calendar events |
| `google-meet.service.ts` | Provisions Google Meet links |
| `google-auth.service.ts` | Manages Google OAuth2 tokens |
| `sync-meeting.service.ts` | Orchestrates meeting creation (calendar + meet + DB record) |
| `meeting-polling.service.ts` | Periodically checks which meetings have finished |
| `meeting-ingestion.service.ts` | Fetches the meeting content after it ends |
| `meeting-analysis.service.ts` | Calls the sync-meeting-agent and stores results |
| `cron-check-meetings.ts` | Entry point for the cron job |

---

## Database tables

| Table | Purpose |
|-------|---------|
| `sync_meetings` | The meeting record: title, Google Meet link, event ID, status, scheduled time |
| `meeting_participants` | Users invited to / present in the meeting |
| `meeting_analyses` | AI analysis results (summary, decisions, actions, contribution signals) |

---

## Cron job

`GET /api/cron/check-meetings` is the endpoint that drives the polling. It should be called on a schedule (e.g. every 5–15 minutes) by an external cron scheduler.

Secure it with `CRON_SECRET`:
```env
CRON_SECRET=your-secret-value
```

The request must include the header:
```
Authorization: Bearer your-secret-value
```

---

## Hiding the meetings module

An admin can hide the meetings sidebar from challenge pages instance-wide, from the Modules tab in `/contributors/me` — see [`admin-settings.md`](./admin-settings.md). This only affects visibility; meetings can still be created and accessed directly.

---

## Required environment variables

```env
# Google Workspace service account (for creating meetings)
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY=...
GOOGLE_WORKSPACE_ADMIN_EMAIL=...

# Google OAuth (for user-level access)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=...

# AI analysis
OPENAI_API_KEY=...

# Cron security
CRON_SECRET=...
```

---

## Key files

| File | Purpose |
|------|---------|
| `packages/services/sync-meeting/` | All sync meeting services |
| `packages/sync-meeting-agent/meeting-analyzer.ts` | AI analysis agent |
| `packages/sync-meeting-agent/prompts.ts` | System and user prompts for the agent |
| `packages/sync-meeting-agent/schemas.ts` | Zod output validation |
| `apps/leaderboard-client/src/app/api/sync-meetings/` | API routes |
| `apps/leaderboard-client/src/app/api/cron/check-meetings/` | Cron endpoint |

---

[slack-signals.md]
# Slack Contribution Signals

Challenges can reward the collaboration that happens **outside the code** — in the team's Slack channel. A manager defines *contribution signals* (e.g. "Proposed an idea", "Helped a peer") with a fixed CP reward each, links the challenge to a Slack channel, and a daily AI pass detects those signals in new messages and credits the authors automatically.

---

## How it works

```
Vercel cron (daily, 06:00 UTC)
  → GET /api/cron/slack-signals            (Bearer CRON_SECRET)
    → for each active challenge with a Slack config:
        1. fetch new channel messages since the last cursor (conversations.history)
        2. resolve each author to a leaderboard user by email (users.info → users.email)
        3. send challenge + project + participants + signal definitions + messages to GPT-4o
        4. filter the returned detections (unknown signal/user/message → dropped)
        5. write one reward_entries row per detection (rule_key 'slack_signal')
           against a single 'discussion' contribution per participant
        6. advance the cursor (only on success)
```

Every attribution is auditable: the ledger row's `meta` carries the signal, the message `ts`, an excerpt, and the LLM's one-sentence justification — visible through the existing `GET /api/contributions/[id]/rewards` breakdown.

## Setting it up

1. **Connect Slack** — an admin pastes a bot token in the Integrations tab of `/contributors/me`. Scopes and app creation are covered in [`admin-settings.md`](./admin-settings.md#slack). Don't forget to invite the bot to the channel.
2. **Configure the challenge** — in the challenge edit drawer (admins and project managers), the **Discussion signals** section lets you pick the channel and define signals: an icon (from a predefined set), a label, a CP reward, and a written definition. The definition is what the AI matches against — the more precise, the better the detections.
3. **Wait for the cron** (or trigger it manually):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/slack-signals
```

## Rewards: fixed, out of the pool

Unlike task evaluations (pool distributed at close) and ML rules (pool consumed live), signal rewards are **fixed amounts outside the challenge pool**:

- Code challenges: the close-time distribution only touches contributions with an `evaluation` — discussion contributions are never overwritten.
- ML challenges: `MlRewardsService.remainingPool` excludes `slack_signal` ledger rows, so signals never eat the ML budget.
- Profile: signal CP counts in the contributor's total, but not in the challenge "share" bar (which measures the pool).

Each participant gets **one** `type: 'discussion'` contribution per challenge; its `reward` is the ledger aggregate, growing run after run. On the profile it renders as compact chips (one per signal, with its icon, ×count and CP), not as a contribution list. The icon catalogue lives in `apps/leaderboard-client/src/components/ui/signalIcons.tsx` — keys are stored in `challenge_signals.icon`.

## Author resolution

Slack authors are matched to leaderboard users **by email**, before the LLM call: `users.info` gives the Slack profile email, matched case-insensitively against the challenge team's `users.email`. Unresolved authors (different email, not a participant) stay in the context for conversational continuity but are never credited — they are logged in the cron output for diagnosis.

## Idempotence & failure

- The per-challenge cursor (`challenge_slack_configs.last_ts`) only advances after a fully successful run; a failure records `last_error` and leaves the window to be replayed.
- Replays are absorbed by deduplication against the ledger: a (user, signal, message) triple is only ever rewarded once.
- At most ~300 messages are analyzed per run; any excess waits for the next run (the cursor stops at the last analyzed message).

## Limitations (v1)

- Public channels only, and **thread replies are not fetched** (`conversations.history` returns top-level messages; `conversations.replies` support is a future extension).
- One channel per challenge.
- Detection quality depends on the written signal definitions; the prompt instructs the model to stay conservative (no match when in doubt).

## Key files

| File | Purpose |
|------|---------|
| `packages/connectors/implementation/Slack.connector.ts` | Slack Web API: messages, user profiles, channel list, rate-limit retry |
| `packages/slack-signal-agent/` | GPT-4o detection agent — prompt, Zod schemas, post-parse guards |
| `packages/services/slack/slack-signals.service.ts` | Per-challenge ingestion: cursor, resolution, dedup, ledger writes |
| `packages/services/slack/cron-slack-signals.ts` | Loops over configured challenges (one failure doesn't block the rest) |
| `packages/config/slackCredentials.ts` | Encrypted bot token access (DB, falls back to `SLACK_BOT_TOKEN`) |
| `packages/database-service/repositories/challengeSignal.repo.ts` | Signal definitions CRUD |
| `packages/database-service/repositories/challengeSlackConfig.repo.ts` | Channel config + cron cursor |
| `apps/leaderboard-client/src/app/api/cron/slack-signals/route.ts` | Cron entry point |
| `apps/leaderboard-client/src/components/admin/ChallengeSlackSignalsEditor.tsx` | Channel + signals editor in the challenge drawer |
| `apps/leaderboard-client/src/components/contributor/SlackConnectionCard.tsx` | Bot token connection card (Integrations tab) |

---

[project-structure.md]
# Project structure

## Full directory tree

```
leaderboard/
│
├── apps/
│   └── leaderboard-client/           # Next.js 16 app — UI + all API routes
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx         # Root layout (also injects the active theme)
│       │   │   ├── page.tsx           # New curated homepage (about + top 5 + trending challenges)
│       │   │   ├── leaderboard/       # Full leaderboard (moved here from `/`)
│       │   │   ├── about/             # About page
│       │   │   ├── admin/             # Admin section (protected, admin role only)
│       │   │   │   ├── challenges/
│       │   │   │   ├── contributions/
│       │   │   │   ├── evaluation-grids/
│       │   │   │   ├── evaluation-runs/
│       │   │   │   ├── meetings/
│       │   │   │   ├── projects/
│       │   │   │   ├── repos/
│       │   │   │   └── users/
│       │   │   ├── api/               # Next.js Route Handlers (server-side)
│       │   │   │   ├── admin/theme/   # instance-wide theme (admin only)
│       │   │   │   ├── auth/          # refresh, logout (login is handled by google-auth/)
│       │   │   │   ├── challenges/    # CRUD + sync + team + documents + repo-activity + ml-workspace + ml-rewards
│       │   │   │   ├── contributions/ # CRUD by challenge + per-contribution reward ledger
│       │   │   │   ├── contributors/  # current user profile + tasks
│       │   │   │   ├── evaluation-grids/
│       │   │   │   ├── evaluation-runs/ # admin viewer/retry for past evaluation runs
│       │   │   │   ├── github-oauth/  # admin GitHub account connection
│       │   │   │   ├── google-auth/   # OAuth authorize + callback
│       │   │   │   ├── kaggle/        # admin Kaggle account connection
│       │   │   │   ├── leaderboard/   # rankings endpoint
│       │   │   │   ├── modules/       # meetings/onboarding visibility toggles
│       │   │   │   ├── onboarding/    # onboarding progress (+ /all for admins)
│       │   │   │   ├── projects/
│       │   │   │   ├── repos/
│       │   │   │   ├── sync-meetings/
│       │   │   │   ├── tasks/
│       │   │   │   ├── users/
│       │   │   │   ├── cron/          # background jobs (check-meetings)
│       │   │   │   ├── docs/          # Scalar API reference (dev only)
│       │   │   │   └── openapi.json/  # OpenAPI spec (dev only)
│       │   │   ├── challenges/        # challenge listing + detail pages
│       │   │   │   └── [id]/manage/   # project-manager view (mirrors the admin challenge view)
│       │   │   ├── contributors/      # contributor profile pages
│       │   │   ├── sync-meetings/     # meeting detail page
│       │   │   └── tasks/             # task detail page
│       │   ├── components/
│       │   │   ├── admin/             # admin UI components
│       │   │   ├── challenges/        # manager-role popup, challenge cards/filters
│       │   │   ├── home/              # homepage preview sections (leaderboard, trending challenges)
│       │   │   └── contributor/       # contributor-facing components (incl. ThemeSettings, task board)
│       │   ├── lib/
│       │   │   ├── auth.ts            # JWT helpers (sign, verify, cookies)
│       │   │   ├── db.ts              # database client instance
│       │   │   ├── leaderboard.ts     # leaderboard computation
│       │   │   ├── themes.ts          # predefined theme palettes
│       │   │   ├── onboarding-track.ts
│       │   │   ├── otel.ts            # OpenTelemetry setup
│       │   │   ├── types.ts           # shared TypeScript types
│       │   │   ├── validation.ts      # Zod schemas for API inputs
│       │   │   └── server/            # server-only utilities (incl. managerAuth.ts)
│       │   ├── proxy.ts               # route protection (JWT check, Edge runtime — formerly middleware.ts)
│       │   └── instrumentation.ts     # observability init
│       ├── package.json
│       └── next.config.ts
│
├── packages/
│   ├── config/                        # env variable validation (Zod)
│   │   └── index.ts
│   │
│   ├── database-service/              # PostgreSQL schema + repositories
│   │   ├── db/
│   │   │   ├── drizzle.ts             # schema definition (source of truth)
│   │   │   └── mappers.ts             # DB rows ↔ domain entities
│   │   ├── domain/
│   │   │   ├── entities.ts            # TypeScript domain types
│   │   │   └── schemas_zod.ts         # Zod validation schemas
│   │   └── repositories/              # one file per table/domain area
│   │
│   ├── evaluator/                     # AI evaluation + ML reward scoring
│   │   ├── evaluator.ts               # OpenAIAgentEvaluator class
│   │   ├── interfaces.ts
│   │   ├── types.ts
│   │   ├── reward.ts                  # CP reward distribution (code challenges)
│   │   ├── ml-reward.ts               # point scoring for ML challenges (see ml-rewards.md)
│   │   ├── grids/                     # scoring grids (code, model, docs, dataset)
│   │   └── openai/                    # identify + evaluate + merge agents
│   │
│   ├── connectors/                    # external data source connectors
│   │   ├── github/                    # GitHub API (commits, files, repos, activity)
│   │   ├── kaggle/                    # Kaggle datasets/models (metadata, metrics, activity)
│   │   └── google-drive/              # Google Drive file access
│   │
│   ├── services/                      # orchestration and business logic
│   │   ├── challenge.service.ts       # challenge operations
│   │   ├── challenge-context.service.ts
│   │   ├── sync-evaluation.service.ts
│   │   ├── rewards.service.ts
│   │   ├── challenge/
│   │   │   ├── ml-rewards.service.ts  # ML reward orchestration (see ml-rewards.md)
│   │   │   ├── artifactUrl.ts         # URL normalization (reuse detection key)
│   │   │   └── lineage.ts             # reuse/authorship detection
│   │   ├── google-auth.service.ts
│   │   ├── google-calendar.service.ts
│   │   ├── google-meet.service.ts
│   │   ├── evaluation-grid.service.ts
│   │   └── sync-meeting/              # sync meeting orchestration
│   │       ├── sync-meeting.service.ts
│   │       ├── meeting-polling.service.ts
│   │       ├── meeting-ingestion.service.ts
│   │       ├── meeting-analysis.service.ts
│   │       └── cron-check-meetings.ts
│   │
│   ├── provisioner/                   # workspace provisioning
│   │   └── github-branch.provider.ts  # creates GitHub branches for tasks
│   │
│   ├── sync-meeting-agent/            # AI analysis of sync meetings
│   │   ├── meeting-analyzer.ts
│   │   ├── openai/analyze.agent.ts
│   │   ├── schemas.ts
│   │   ├── types.ts
│   │   └── prompts.ts
│   │
│   └── test/                          # ad-hoc test scripts (not Vitest)
│
├── db_data/                           # seed data
│   ├── seed.ts                        # seed script
│   ├── projects.json
│   ├── users.json
│   ├── challenges.json
│   └── contributions.json
│
├── drizzle/                           # generated SQL migrations
├── challenges/                        # team roadmap / brief / spec files (not code)
├── scripts/                           # OS-specific helper scripts
│   ├── prod.sh
│   ├── macos/init.sh
│   └── windows/init.bat
├── docs/                              # this documentation
├── .env.example                       # env variable template
├── drizzle.config.ts                  # Drizzle ORM config
├── package.json                       # root scripts + workspace definition
├── tsconfig.json
└── vercel.json
```

## Where to look for…

| What | Where |
|------|-------|
| Page UI | `apps/leaderboard-client/src/app/**/*.tsx` |
| API endpoints | `apps/leaderboard-client/src/app/api/**/route.ts` |
| Route protection | `apps/leaderboard-client/src/proxy.ts` |
| Auth helpers | `apps/leaderboard-client/src/lib/auth.ts` |
| Project-manager authorization | `apps/leaderboard-client/src/lib/server/managerAuth.ts` |
| DB schema | `packages/database-service/db/drizzle.ts` |
| DB repositories | `packages/database-service/repositories/` |
| Seed data | `db_data/seed.ts` + `db_data/*.json` |
| Drizzle config | `drizzle.config.ts` (root) |
| AI evaluation (code challenges) | `packages/evaluator/` |
| ML challenge rewards | `packages/evaluator/ml-reward.ts` + `packages/services/challenge/` (see [`ml-rewards.md`](./ml-rewards.md)) |
| Google integrations | `packages/services/google-*.service.ts` |
| Meeting analysis | `packages/sync-meeting-agent/` |
| Theme / integrations / module toggles | `packages/database-service/repositories/appSettings.repo.ts` (see [`admin-settings.md`](./admin-settings.md)) |
| Env config | `packages/config/index.ts` |
| Root npm scripts | `package.json` (root) |

---

[packages.md]
# Packages

This monorepo is organized into one app and several packages. Packages are shared libraries — they are not deployed independently, they are imported by the app or by each other.

---

## `apps/leaderboard-client`

**Type:** Next.js 16 application (App Router)
**Role:** The single deployable artifact. Serves the UI and handles all server-side logic via Route Handlers.

Key responsibilities:
- Renders all pages: leaderboard, challenges, contributor profiles, admin panel, onboarding
- Implements all API endpoints under `src/app/api/`
- Handles authentication (Google OAuth login, JWT cookies, middleware protection)
- Integrates with all packages at runtime

---

## `packages/config`

**Required by:** everything
**Purpose:** Validates all environment variables at startup using Zod. If a required variable is missing or malformed, the process fails fast with a clear error message.

Variables it validates:
- `DATABASE_URL` — required
- `JWT_SECRET` — required, must be 32+ characters
- `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` — optional (defaults: `15m` / `7d`)
- `OPENAI_API_KEY` — required in full prod mode
- `GITHUB_TOKEN` — optional (static fallback token)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_OAUTH_REDIRECT_URI` / `GITHUB_TOKEN_ENCRYPTION_KEY` — optional (in-app GitHub OAuth connection, see [`github-setup.md`](./github-setup.md))
- `KAGGLE_USERNAME` / `KAGGLE_KEY` — optional (fallback Kaggle credentials, see [`admin-settings.md`](./admin-settings.md))
- `SLACK_BOT_TOKEN` — optional (fallback Slack bot token, see [`admin-settings.md`](./admin-settings.md))
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_REDIRECT_URI` — required (used for login via Google OAuth)
- Other `GOOGLE_*` — Google Workspace / Drive credentials (optional, for sync meetings and connectors)
- `CRON_SECRET` — optional (secures the meeting-polling cron endpoint)
- `OTEL_*` — observability config (optional)
- `VALIDATION_ALLOW_PRIVATE_ENDPOINTS` — optional, **local dev only** (lets the validation-challenge SSRF guard accept localhost/private endpoints — see [`validation-challenges.md`](./validation-challenges.md))

**Key file:** `packages/config/index.ts`

---

## `packages/database-service`

**Required by:** `leaderboard-client`, `services`
**Purpose:** PostgreSQL schema definition + typed repositories for all database access. This is the only package that talks to the database directly.

What it provides:
- **Schema** (`db/drizzle.ts`) — all table definitions, relations, and enums using Drizzle ORM
- **Mappers** (`db/mappers.ts`) — converts raw DB rows to typed domain entities
- **Domain types** (`domain/entities.ts`) — TypeScript types for all entities
- **Repositories** (`repositories/`) — one repository per domain area, with typed CRUD and query methods

Repositories available:
`project`, `repo`, `challenge`, `challengeRepos`, `challengeTeam`, `challengeDocument`, `challengeSignal`, `challengeSlackConfig`, `user`, `contribution`, `rewardEntry`, `task`, `taskAssignee`, `taskWorkspace`, `evaluationGrids`, `evaluationRuns`, `evaluationRunContributions`, `syncMeeting`, `meetingParticipant`, `meetingAnalysis`, `onboardingProgress`, `refreshToken`, `appSettings`

**Key file:** `packages/database-service/db/drizzle.ts`

---

## `packages/evaluator`

**Optional** — requires `OPENAI_API_KEY`
**Purpose:** AI scoring engine for code challenges, plus the pure scoring functions behind ML challenge rewards.

The evaluator exposes one active agent:
- **Evaluate** (`openai/evaluate.agent.ts`) — scores a contribution against a grid (0–9 per criterion, aggregated to 0–100)

Scoring grids (in `grids/`):
- `code.grid.ts` — technical quality, architecture, security, maintainability, documentation, impact
- `model.grid.ts` — kept but currently unused (see [`ml-rewards.md`](./ml-rewards.md) — Kaggle models are scored from their metric, not by this grid)
- `dataset.grid.ts` — dataset contributions
- `docs.grid.ts` — documentation contributions

Each agent call is wrapped with 3-retry logic (1-second backoff).

`reward.ts` distributes a fixed pool proportionally at challenge close (code challenges). `ml-reward.ts` computes live, absolute point awards for ML challenges (caps, metric normalization, lead bonus, reuse deductions) — see [`ml-rewards.md`](./ml-rewards.md).

> The package also contains `openai/identify.agent.ts` and `openai/merge.agent.ts` from the old challenge-level pipeline — these are **no longer used**.

**Key file:** `packages/evaluator/evaluator.ts` (`OpenAIAgentEvaluator` class)

---

## `packages/connectors`

**Optional** — requires GitHub/Kaggle/Google credentials
**Purpose:** Fetches raw content from external data sources. All connectors implement a common `ExternalConnector` interface.

Available connectors:
- **GitHub** — fetch commits, file contents, repository metadata, and live activity (commits/PRs/reviews/branches) via Octokit
- **Kaggle** — fetch dataset metadata and versioned model metrics (AUC/F1/accuracy) via the Kaggle API
- **Google Drive** — list and read files from a Drive folder via OAuth2
- **Slack** — fetch channel messages (with a `ts` cursor), resolve author profiles/emails, and list public channels via the Slack Web API — see [`slack-signals.md`](./slack-signals.md)

Interface methods: `connect()`, `testConnection()`, `fetchItems()`, `fetchItemContent()`, `fetchRepoActivity()` (GitHub/Kaggle only), `disconnect()`

GitHub, Kaggle and Slack credentials can come from an admin-connected account (encrypted, stored in `app_settings`) or fall back to `.env` — see [`admin-settings.md`](./admin-settings.md).

**Key files:** `packages/connectors/github/`, `packages/connectors/kaggle/`, `packages/connectors/google-drive/`

---

## `packages/services`

**Optional** — orchestrates the optional packages
**Purpose:** Business logic and orchestration that combines database access, connectors, and the evaluator. The app calls these services from Route Handlers rather than calling the lower-level packages directly.

Key services:
- **`task_evaluation/task-evaluation.service.ts`** — main evaluation pipeline: task context → commits → snapshot → score → upsert contribution (code challenges only)
- **`task_evaluation/task-context.service.ts`** — loads the task, its parent challenge, assignees, and workspace branches
- **`challenge.service.ts`** — challenge CRUD and state transitions
- **`rewards.service.ts`** — distributes CP across contributors based on evaluation scores (code challenges)
- **`challenge/ml-rewards.service.ts`** — orchestrates ML challenge scoring and the point ledger; **`challenge/artifactUrl.ts`** and **`challenge/lineage.ts`** support reuse detection — see [`ml-rewards.md`](./ml-rewards.md)
- **`google-auth.service.ts`** — manages Google OAuth2 tokens (used for login and Google integrations)
- **`google-calendar.service.ts`** — creates and manages Google Calendar events
- **`google-meet.service.ts`** — provisions Google Meet links
- **`evaluation-grid.service.ts`** — CRUD for evaluation grids stored in the DB
- **`sync-meeting/`** — full sync meeting lifecycle (creation → polling → ingestion → analysis)
- **`slack/`** — daily Slack signal ingestion: `slack-signals.service.ts` (per-challenge cursor, author resolution, LLM detection, ledger writes) and `cron-slack-signals.ts` (loops over configured challenges) — see [`slack-signals.md`](./slack-signals.md)

> `challenge-context.service.ts` and `sync-evaluation.service.ts` are still in the codebase but are **no longer used** — they belonged to the old challenge-level identify/merge/evaluate pipeline. `webhook.service.ts` also remains but is orphaned: the `POST /api/webhooks/github` route that used to call it has been removed, so nothing in the app invokes it anymore.

---

## `packages/provisioner`

**Optional** — requires `GITHUB_TOKEN`
**Purpose:** Creates workspaces for tasks on external platforms. Currently supports creating GitHub branches for a challenge/task.

```typescript
const result = await provisionChallengeWorkspace({
  challengeIndex: 7,
  challengeTitle: 'My Challenge',
  repoExternalId: 'org/repo',
  repoType: 'github',
});
// Returns: { provider, ref, url, status, meta }
```

**Key file:** `packages/provisioner/github-branch.provider.ts`

---

## `packages/sync-meeting-agent`

**Optional** — requires `OPENAI_API_KEY` + Google Workspace credentials
**Purpose:** AI agent that analyzes the content of a sync meeting. Takes meeting transcript/notes and produces structured output: summary, key decisions, action items, and contribution signals.

Output schema (validated with Zod):
- Summary of the meeting
- List of decisions made
- List of action items with assignees
- Contribution signals extracted (who did what)

**Key file:** `packages/sync-meeting-agent/meeting-analyzer.ts`

---

## `packages/slack-signal-agent`

**Optional** — requires `OPENAI_API_KEY` + a connected Slack bot
**Purpose:** AI agent that detects the contribution signals defined on a challenge inside a batch of Slack messages. Receives the challenge context, the participants (already resolved by email), the signal definitions, and the messages; returns per-message detections attributed to participants.

Output schema (validated with Zod, plus post-parse guards):
- One detection per (signal, message, user) triple: `signal_id`, `user_id`, `message_ts`, `justification`
- Detections with unknown signal/user/message identifiers are dropped

See [`slack-signals.md`](./slack-signals.md) for the full pipeline.

**Key file:** `packages/slack-signal-agent/openai/detect.agent.ts`

---

## `packages/test`

**Development only**
**Purpose:** Ad-hoc scripts for manually testing integrations. Not Vitest tests — these are run directly with `tsx`.

Examples:
```bash
npx tsx packages/test/test-db-connection.ts
npx tsx packages/test/test-github-connector.ts
```

> Some scripts require optional env variables (GitHub, Google, OpenAI).

---

[overview.md]
# Overview

MyTwin Leaderboard is an internal platform for **MyTwin Lab** that tracks contributor work, evaluates it with AI, and distributes rewards — powering a competitive, community leaderboard.

## What it does

1. **Tracks contributions** — every meaningful unit of work (code, docs, datasets, models) is recorded as a contribution linked to a contributor and a challenge.
2. **Evaluates quality with AI** — an OpenAI-powered pipeline scores contributions using structured grids (different grids for code, docs, models, datasets).
3. **Distributes Contribution Points (CP)** — rewards are calculated from evaluation scores and the challenge reward pool, then attributed to contributors.
4. **Shows the leaderboard** — the UI renders rankings, challenge progress, and individual contributor profiles.
5. **Manages sync meetings** — meetings are created directly from the app in Google Workspace, then AI analyzes the recorded content to extract summaries, decisions, and contribution signals.
6. **Onboards new contributors** — a guided mission flow helps new contributors take their first steps (pick a task, evaluate it, validate it).

## Core concepts

| Concept | Description |
|---------|-------------|
| **Project** | A top-level initiative. Contains repositories and challenges, and can have a **manager** — a contributor with elevated access to that project's challenges. |
| **Challenge** | A time-bounded sprint with a reward pool. Work happens inside challenges. A **code** challenge (task-based, GitHub), an **ML** challenge (dataset/model/packaging submissions, GitHub + Kaggle), or a **validation** challenge (manually testing a submitted ML API live — see [`validation-challenges.md`](./validation-challenges.md)). |
| **Task** | A concrete piece of work inside a *code* challenge. Tasks are the primary unit of work there; ML challenges have no tasks. |
| **Contribution** | A recorded unit of output (code commit, doc, dataset, model) attributed to a contributor. |
| **Evaluation** | An AI-generated quality assessment of a contribution — produces a score (0–100) and justification. |
| **CP (Contribution Points)** | Reward currency distributed to contributors. Code challenges split a fixed pool proportionally at close; ML challenges award absolute points live per submission (see [`ml-rewards.md`](./ml-rewards.md)). |
| **Sync Meeting** | A team meeting created from the app in Google Workspace, later analyzed by AI. |
| **Onboarding** | A 5-quest sequence for new contributors to get started with the platform. |

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Frontend & API routes** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Database** | PostgreSQL 14+, Drizzle ORM |
| **Authentication** | Google OAuth (identity provider) + JWT (jose library), HTTP-only cookies |
| **AI / Evaluation** | OpenAI API (Agents) |
| **Google integrations** | Google Workspace (Calendar, Meet), Google Drive (OAuth2) |
| **GitHub integration** | Octokit (commits, repos, branch provisioning, activity feed) — via a static token or an admin-connected OAuth account |
| **Kaggle integration** | Kaggle API (dataset metadata, model version metrics) — for ML challenges |
| **Observability** | OpenTelemetry → Grafana Cloud |
| **Testing** | Vitest, Testing Library |
| **Deployment** | PM2, Next.js production build |

## What this repo is not

- It is **not** a standalone REST API server — the backend logic runs inside Next.js Route Handlers.
- The `challenges/` directory at the root is **not** application code — it contains team roadmap, brief, and spec files for internal planning updates.

---

[onboarding.md]
# Onboarding

The onboarding system guides **new contributors** through a set of missions to get familiar with the platform. It's a lightweight, progressive experience built into the app.

---

## Purpose

When a new contributor joins, they don't immediately have full context on how challenges, tasks, and evaluations work. The onboarding missions provide a structured first experience:

1. Get oriented in the platform
2. Pick a task and work on it
3. Participate in an evaluation
4. Validate your first contribution

---

## How it works

Onboarding progress is tracked per user in a single `onboarding_progress` row — one boolean per quest, flipped to `true` as the contributor completes each step.

The app reads and writes this progress at:
- `GET /api/onboarding` — returns the authenticated user's onboarding state
- `POST /api/onboarding` — marks a quest as completed
- `GET /api/onboarding/all` — admin-only; returns every contributor's progress in one list, for the "Onboarding" tab in `/contributors/me`

Progress is shown in the contributor's own profile page (`/contributors/me`) via the onboarding drawer. An admin can hide this drawer instance-wide from the Modules tab (see [`admin-settings.md`](./admin-settings.md)) — tracking still happens in the background even when the drawer is hidden.

---

## Quests

The onboarding flow is five quests. Each is completed by taking a real action in the app, and each maps to one boolean column on `onboarding_progress`:

| Quest | Column | What the contributor does |
|-------|--------|---------------------------|
| Explore | `clicked_challenge` | Open a challenge for the first time |
| Assign | `assigned_task` | Get assigned to a task |
| Evaluate | `evaluated_contribution` | Have a contribution go through evaluation |
| Validate | `validated_task` | Have a task marked complete |
| Join | `joined_meeting` | Join a sync meeting |

When all five are done, `completed_at` is set and the onboarding drawer stops appearing for that user.

---

## Data model

```
users
  └── onboarding_progress (one row per user)
        ├── user_id
        ├── clicked_challenge: boolean
        ├── assigned_task: boolean
        ├── evaluated_contribution: boolean
        ├── validated_task: boolean
        ├── joined_meeting: boolean
        └── completed_at: timestamp | null
```

**Key files:**
- `packages/database-service/repositories/onboardingProgress.repo.ts`
- `apps/leaderboard-client/src/lib/onboarding-track.ts`
- `apps/leaderboard-client/src/lib/server/onboarding.ts`
- `apps/leaderboard-client/src/app/api/onboarding/route.ts`
- `apps/leaderboard-client/src/app/api/onboarding/all/route.ts`

---

[ml-rewards.md]
# ML Rewards

`type: 'ml'` challenges (datasets, models, packaging work) use a different reward system than regular `type: 'code'` challenges.

**Requires:** `OPENAI_API_KEY` (for code/dataset scoring) + a connected Kaggle account (see [`admin-settings.md`](./admin-settings.md))

---

## Why a separate system

Code challenges distribute a **fixed pool proportionally to scores, once the challenge closes** (see [`evaluation.md`](./evaluation.md)): everyone's share depends on everyone else's score, and nothing is final until the end.

ML challenges need the opposite: contributors submit a dataset, a model, and packaging work as separate steps, and each step should award **points immediately** as it's evaluated — not wait for a challenge close. So ML challenges use a live, event-driven system with its own fixed budget per step, instead of a single end-of-challenge split.

**ML challenges never have tasks.** There is no kanban, no task assignment — contributors submit their work directly through a dedicated ML workspace flow on the challenge page.

---

## The submission flow

An ML challenge has up to four submission slots, each backed by a linked repo:

| Step | What's submitted | How it's scored |
|------|-------------------|------------------|
| Dataset | A Kaggle dataset URL | AI-scored against the dataset grid |
| Model (metric) | A Kaggle model URL | Scored from the model's reported metric (AUC / F1 / accuracy) — no AI call |
| Model (code) | A GitHub repo with the model's training code | AI-scored against the code grid |
| API packaging | A GitHub repo packaging the model as an API | AI-scored against the code grid |

Contributors submit a URL for each step from the challenge's ML workspace view (`PATCH /api/challenges/:id/ml-workspace`). Each submission upserts a contribution and triggers scoring for that step — AI scoring runs asynchronously since it can take longer than a single request.

---

## How points are awarded

Each ML challenge defines its own **reward rules** (a JSON config on `challenges.reward_rules`, editable by admins and project managers when creating or configuring the challenge): a points cap for each step, and how the model's cap splits between "the metric itself" and "the code quality."

- **Dataset / API packaging / model code** — points scale with the AI score (0–100%) against that step's cap.
- **Model metric** — points scale with how far the reported metric is above a configurable baseline (e.g. an AUC of 0.5 — pure chance — earns nothing).
- **Taking the lead** — a bonus is awarded the moment a contributor's model overtakes the previous best on the metric. It fires once per genuine overtake and is never revoked, even if someone else later retakes the lead.

The pool for a challenge is finite: it's set at creation and drains as points are awarded, in the order submissions arrive. If a computed award would exceed what's left in the pool, it's reduced to whatever remains.

### Reusing someone else's dataset or model

If a contributor points their model or packaging step at a dataset or model that someone else already submitted in the same challenge, that's treated as **reuse**, not a duplicate: the reuser doesn't pay the AI-scoring cost again (same artifact, same score), and a share of their new points is redirected to the original author as a "reuse" credit. This can happen repeatedly — every time the reuser's model improves, the original author's share updates too. A contributor's points can never be pushed to zero by reuse deductions; a minimum share is always protected.

### The point ledger

Every award or deduction is recorded as its own row in an append-only ledger (`reward_entries`) rather than updating a running total — so a contribution's reward is always the sum of its ledger rows, and a contributor can see exactly where their points (or someone else's reuse credit) came from. `GET /api/contributions/:id/rewards` returns this breakdown for one contribution; `GET /api/challenges/:id/ml-rewards` returns the pool's overall state (awarded, remaining, and the rules in effect) for a challenge.

The regular leaderboard needs no special handling for this — each ledger entry belongs to a specific contribution, and a contribution's total reward is just the sum of its ledger entries.

> The same ledger also stores Slack discussion signal awards (`rule_key: 'slack_signal'` — see [`slack-signals.md`](./slack-signals.md)). Those are **out of pool**: `remainingPool` excludes them, so signal rewards never drain the ML budget.

---

## Known limitations (v1)

- **Metrics are self-reported.** The model's metric is read from the Kaggle model card, which the contributor writes — nothing currently verifies it independently.
- **Concurrent submissions can race.** Two contributors submitting within the same instant could both be scored against the same "remaining pool" or "current best" snapshot, occasionally causing a small pool overshoot or two people briefly getting credit for the same lead. Self-correcting on the next submission, but not fully locked.

---

## Key files

| File | Purpose |
|------|---------|
| `packages/database-service/domain/mlRewardRules.ts` | Reward rules shape and validation |
| `packages/evaluator/ml-reward.ts` | Pure scoring functions (cap, baseline, lead bonus, reuse deductions) |
| `packages/services/challenge/ml-rewards.service.ts` | Orchestrates scoring + the Kaggle metric read + ledger writes |
| `packages/services/challenge/artifactUrl.ts` | Normalizes submitted URLs (the key used to detect reuse) |
| `packages/services/challenge/lineage.ts` | Determines who originally authored a reused artifact |
| `packages/database-service/repositories/rewardEntry.repo.ts` | Ledger writes, keeps `contributions.reward` in sync |
| `apps/leaderboard-client/src/app/api/challenges/[id]/ml-workspace/route.ts` | Submission endpoint (triggers scoring) |
| `apps/leaderboard-client/src/app/api/challenges/[id]/ml-rewards/route.ts` | Pool state for a challenge |
| `apps/leaderboard-client/src/app/api/contributions/[id]/rewards/route.ts` | Ledger breakdown for one contribution |
| `apps/leaderboard-client/src/components/admin/MlRewardRulesEditor.tsx` | Reward rules editor (challenge creation/config) |

---

[index.md]
# MyTwin Leaderboard — Documentation

Welcome to the technical documentation for the MyTwin Leaderboard monorepo.

## Start here

- **New to the project?** → [`getting-started.md`](./getting-started.md) — local setup, env config, first run
- **Want to understand how everything fits?** → [`architecture.md`](./architecture.md)
- **Looking for a specific feature?** → use the index below

## Core docs

| File | Description |
|------|-------------|
| [`overview.md`](./overview.md) | What the project is, core concepts, and tech stack |
| [`architecture.md`](./architecture.md) | Monorepo structure, data flow, how packages connect |
| [`project-structure.md`](./project-structure.md) | Annotated directory tree — where everything lives |
| [`packages.md`](./packages.md) | What each package does, its role, and key files |
| [`database.md`](./database.md) | PostgreSQL schema, tables, migrations, and seeding |
| [`auth.md`](./auth.md) | Google OAuth login, JWT cookies, roles, and protected routes |
| [`api.md`](./api.md) | High-level overview of all API routes |

## Feature docs

| File | Description |
|------|-------------|
| [`challenges-and-tasks.md`](./challenges-and-tasks.md) | How challenges and tasks work — the core workflow |
| [`evaluation.md`](./evaluation.md) | AI evaluation pipeline, scoring grids, rewards |
| [`ml-rewards.md`](./ml-rewards.md) | Reward rules for ML challenges — live scoring, reuse, and the point ledger |
| [`validation-challenges.md`](./validation-challenges.md) | Manually testing a submitted ML API live — drop a file, see the output, earn CP |
| [`sync-meetings.md`](./sync-meetings.md) | Creating meetings in Google Workspace + AI analysis |
| [`slack-signals.md`](./slack-signals.md) | Slack contribution signals — AI-detected rewards from channel discussions |
| [`onboarding.md`](./onboarding.md) | New contributor onboarding missions |
| [`admin-settings.md`](./admin-settings.md) | Instance-wide theme, GitHub/Kaggle/Slack connections, and module toggles |

## Dev & ops

| File | Description |
|------|-------------|
| [`getting-started.md`](./getting-started.md) | Local development setup |
| [`deployment.md`](./deployment.md) | Production deployment with PM2 |
| [`testing.md`](./testing.md) | Running tests and ad-hoc scripts |

---

> The top-level `README.md` covers the quick-start — these docs go deeper.

---

[google-setup.md]
# Google Cloud & Workspace Setup Guide

Complete step-by-step guide to configure Google services for the Leaderboard application. This covers two distinct features:

- **Google OAuth 2.0 Login** — allows users to sign in with their Google account
- **Google Workspace Connector (Sync Meetings)** — creates Google Calendar events with Meet links, fetches transcripts, and runs AI analysis

Both features use the same Google Cloud project but require different credentials.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create a Google Cloud Project](#2-create-a-google-cloud-project)
3. [Configure the OAuth Consent Screen](#3-configure-the-oauth-consent-screen)
4. [Create OAuth 2.0 Credentials (User Login)](#4-create-oauth-20-credentials-user-login)
5. [Enable Required APIs](#5-enable-required-apis)
6. [Create a Service Account (Sync Meetings)](#6-create-a-service-account-sync-meetings)
7. [Enable Domain-Wide Delegation](#7-enable-domain-wide-delegation)
8. [Mark the Application as Trusted](#8-mark-the-application-as-trusted)
9. [Configure Environment Variables](#9-configure-environment-variables)
10. [Verify the Setup](#10-verify-the-setup)
11. [Production Deployment Checklist](#11-production-deployment-checklist)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

| Requirement | Why |
|---|---|
| A Google Workspace account (any plan) with Super Admin access | Required for domain-wide delegation and admin console settings |
| A verified domain in Google Workspace | The service account impersonates a Workspace user |
| Access to Google Cloud Console | To create the project, credentials, and enable APIs |

> **Note:** A standard Gmail account is not sufficient for the Sync Meetings feature (which requires domain-wide delegation). However, the OAuth Login feature works with any Google account if the consent screen is set to "External".

---

## 2. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Sign in with your Google Workspace Super Admin account
3. Click the project selector (top-left) > **New Project**
4. Enter a project name (e.g. `leaderboard`)
5. Under **Organization**, select your Workspace domain
6. Click **Create**
7. Make sure the new project is selected in the project selector

---

## 3. Configure the OAuth Consent Screen

Before creating credentials, you must configure the consent screen that users will see when logging in.

1. In the Cloud Console, go to **APIs & Services > OAuth consent screen**
2. Choose **User Type**:
   - **Internal** — only users within your Google Workspace organization can log in (recommended for private/corporate use)
   - **External** — anyone with a Google account can log in (required for public-facing apps; requires verification for production)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: your application name
   - **User support email**: your admin email
   - **Developer contact information**: your admin email
5. Click **Save and Continue**
6. On the **Scopes** page, click **Add or Remove Scopes** and add:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
7. Click **Save and Continue**
8. If External: add test users during development (emails of people who can log in before verification)
9. Click **Save and Continue** > **Back to Dashboard**

> **Important:** If you chose "External", your app will be in **Testing** mode. Only users listed as test users can log in. To allow anyone, you must submit for Google verification (required when you have more than 100 users or use sensitive scopes).

---

## 4. Create OAuth 2.0 Credentials (User Login)

These credentials are used for the Google login flow (sign in with Google).

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. **Application type**: Web application
4. **Name**: e.g. `Leaderboard Web Client`
5. **Authorized JavaScript origins**: add your application URLs
   - For local development: `http://localhost:3000`
   - For production: `https://your-app-domain.com`
6. **Authorized redirect URIs**: add the OAuth callback URL
   - For local development: `http://localhost:3000/api/google-auth/callback`
   - For production: `https://your-app-domain.com/api/google-auth/callback`
7. Click **Create**
8. Copy the **Client ID** and **Client Secret** — you will need them for the environment variables:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`

> **Tip:** You can add multiple redirect URIs for different environments (localhost, staging, production).

---

## 5. Enable Required APIs

In your Google Cloud project, go to **APIs & Services > Library** and enable the following APIs:

### Required for OAuth Login
| API | Purpose |
|---|---|
| **Google People API** | Fetch user profile information (name, email) |

### Required for Sync Meetings
| API | Purpose |
|---|---|
| **Google Calendar API** | Create/delete calendar events with Meet links |
| **Google Meet REST API** | Fetch conference records, participants, and transcripts |

To enable each API:
1. Search for the API name in the Library
2. Click on it
3. Click **Enable**

> **Note:** The "Google Meet REST API" is different from the legacy "Google+ Hangouts API". Make sure you enable the correct one — it should say "Google Meet REST API" with version `v2`.

---

## 6. Create a Service Account (Sync Meetings)

The service account is used for server-to-server communication to create Calendar events and fetch Meet data. This is only needed if you want the Sync Meetings feature.

1. Go to **IAM & Admin > Service Accounts**
2. Click **Create Service Account**
3. **Name**: e.g. `sync-meeting-service`
4. **Role**: Project > Editor (or more granular: `roles/calendar.admin` + `roles/meet.viewer`)
5. Click **Done**
6. Click on the newly created service account
7. Go to the **Keys** tab
8. Click **Add Key > Create new key > JSON**
9. Download the JSON file — this is your `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY`

> **If key creation is blocked:** An organization policy (`iam.disableServiceAccountKeyCreation`) may be active. Go to **IAM & Admin > Organization Policies**, find the constraint, and set it to **Allow**.

### What's in the JSON key file

The downloaded file looks like this:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "sync-meeting-service@your-project-id.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

You will set the **entire JSON content** as the `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY` environment variable. The `client_email` value is your `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL`.

---

## 7. Enable Domain-Wide Delegation

Domain-wide delegation allows the service account to impersonate users in your Workspace domain (e.g., to create calendar events on behalf of the admin).

### Step A: Enable delegation on the service account

1. In **IAM & Admin > Service Accounts**, click on your service account
2. Check **Enable Google Workspace Domain-wide Delegation**
3. Note the **Client ID** (numeric, e.g. `123456789012345678901`)

### Step B: Authorize scopes in Google Admin Console

1. Go to [Google Admin Console](https://admin.google.com)
2. Navigate to **Security > Access and data control > API controls**
3. Click **Manage Domain Wide Delegation**
4. Click **Add new**
5. **Client ID**: paste the service account's Client ID from Step A
6. **OAuth scopes**: paste the following (comma-separated, no spaces):
   ```
   https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/meetings.space.readonly
   ```
7. Click **Authorize**

> **Important:** The admin email you set in `GOOGLE_WORKSPACE_ADMIN_EMAIL` must have an active Google Calendar license. This is the user the service account will impersonate when creating events.

---

## 8. Mark the Application as Trusted

This step prevents Google from blocking API calls from the service account.

1. In [Google Admin Console](https://admin.google.com), go to **Security > Access and data control > API controls**
2. Click **Manage third-party app access**
3. Click **Add app > OAuth App Name Or Client ID**
4. Search by the service account's **Client ID**
5. Select the app
6. Set access to **Trusted**
7. Click **Configure** > **Finish**

---

## 9. Configure Environment Variables

Add the following variables to your `.env` file (local development) or to your hosting provider's environment settings (production).

### OAuth Login (required for user authentication)

```env
# From Step 4 — OAuth Client ID and Secret
GOOGLE_OAUTH_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxx

# The callback URL — must match what you set in Step 4
# Local development:
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google-auth/callback
# Production:
# GOOGLE_OAUTH_REDIRECT_URI=https://your-app-domain.com/api/google-auth/callback
```

### Sync Meetings (required for Google Calendar/Meet integration)

```env
# From Step 6 — the entire JSON key content on a single line
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"...","client_id":"..."}

# The service account email (client_email from the JSON key)
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL=sync-meeting-service@your-project-id.iam.gserviceaccount.com

# A Workspace user email with Calendar license — the service account impersonates this user
GOOGLE_WORKSPACE_ADMIN_EMAIL=admin@yourdomain.com
```

### Cron Security (for the meeting polling endpoint)

```env
# Secret token to protect the cron endpoint
CRON_SECRET=a-random-secret-string
```

### Summary of all Google-related variables

| Variable | Feature | Required |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth Login | Yes (for login) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth Login | Yes (for login) |
| `GOOGLE_OAUTH_REDIRECT_URI` | OAuth Login | Yes (for login) |
| `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL` | Sync Meetings | Yes (for meetings) |
| `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY` | Sync Meetings | Yes (for meetings) |
| `GOOGLE_WORKSPACE_ADMIN_EMAIL` | Sync Meetings | Yes (for meetings) |
| `CRON_SECRET` | Sync Meetings | Recommended |

---

## 10. Verify the Setup

### Test OAuth Login

1. Start the application (`npm run dev`)
2. Navigate to the app in your browser
3. Click on the user avatar (top-right) or go to a protected page
4. You should be redirected to Google's login/consent screen
5. After granting access, you should be redirected back to the app and logged in

### Test Sync Meetings

1. Log in as an admin user
2. Go to the admin panel > Sync Meetings
3. Create a new meeting for a challenge with team members
4. Check Google Calendar — a new event with a Meet link should appear
5. After the meeting ends, trigger the cron endpoint:
   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://your-app-domain.com/api/cron/check-meetings
   ```
6. The meeting should transition through statuses: `scheduled` > `completed` > `processed`

---

## 11. Production Deployment Checklist

When deploying to production (e.g. Scalingo, Heroku, Vercel):

- [ ] Set all environment variables listed in [Section 9](#9-configure-environment-variables) in your hosting provider's dashboard
- [ ] Set `NEXT_PUBLIC_APP_URL` to your production URL (e.g. `https://your-app.osc-fr1.scalingo.io`). This is used for post-login redirects — without it, the app may redirect to the container's internal host (e.g. `localhost:29069`) instead of the public URL.
- [ ] Update `GOOGLE_OAUTH_REDIRECT_URI` to your production URL (e.g. `https://your-app.osc-fr1.scalingo.io/api/google-auth/callback`)
- [ ] Add the production URL to **Authorized JavaScript origins** and **Authorized redirect URIs** in the [Google Cloud OAuth credentials](#4-create-oauth-20-credentials-user-login)
- [ ] If using an "External" consent screen, submit for Google verification if you expect more than 100 users
- [ ] Set up a cron job (e.g. Scalingo Scheduler, external cron service) to call `GET /api/cron/check-meetings` every 5-15 minutes with the `CRON_SECRET` as a Bearer token
- [ ] Ensure the `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY` JSON is set as a single line (no newlines except within the `private_key` field which uses `\n`)
- [ ] Verify `GOOGLE_WORKSPACE_ADMIN_EMAIL` has an active Google Workspace license with Calendar enabled

---

## 12. Troubleshooting

### OAuth Login Issues

| Error | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` | The redirect URI in the request doesn't match any URI registered in Cloud Console | Add the exact URI to **Authorized redirect URIs** in your OAuth credentials. Watch for trailing slashes and http vs https. |
| `access_denied` | User is not in the test users list (External consent screen in Testing mode) | Add the user's email to the test users list in the OAuth consent screen settings, or submit for verification. |
| `Google OAuth credentials not configured` | Missing `GOOGLE_OAUTH_CLIENT_ID` or `GOOGLE_OAUTH_CLIENT_SECRET` env vars | Set the variables and restart the application. |
| Login works but user has no access | User was created with `contributor` role | Manually update the user's role to `admin` in the database if needed. |

### Sync Meetings Issues

| Error | Cause | Fix |
|---|---|---|
| `unauthorized_client` when creating a meeting | Domain-wide delegation not configured or scopes not authorized | Follow [Step 7](#7-enable-domain-wide-delegation) again. Double-check the Client ID and scopes. |
| `Not Authorized to access this resource/api` | Google Meet REST API not enabled or scopes insufficient | Enable the API in [Step 5](#5-enable-required-apis) and check the delegation scopes include `meetings.space.readonly`. |
| `GOOGLE_WORKSPACE_ADMIN_EMAIL doesn't have Calendar` | The impersonated user has no Calendar license | Assign a Google Workspace license with Calendar to this user in the Admin Console (Directory > Users). |
| Calendar event created but no Meet link | `conferenceDataVersion` not set | This is handled automatically by the code. If it still happens, verify the Calendar API is enabled. |
| Transcripts empty after meeting | Google Meet transcription was not enabled during the meeting | The meeting organizer (or admin) must enable transcription in Google Meet settings. In Admin Console: **Apps > Google Workspace > Google Meet > Meet settings > Recording & transcripts > Allow transcription**. |
| Service account key JSON parse error | The env var contains malformed JSON or extra escape characters | Ensure the JSON is valid. On some hosting platforms, you may need to base64-encode the key and decode it at runtime. |

### Google Admin Console Navigation

Google frequently changes the Admin Console UI. If you can't find a setting:
- **Domain-wide delegation**: Security > Access and data control > API controls > Manage Domain Wide Delegation
- **Third-party app trust**: Security > Access and data control > API controls > Manage third-party app access
- **Meet transcription settings**: Apps > Google Workspace > Google Meet > Meet settings
- **User licenses**: Directory > Users > click user > Licenses

---

## Architecture Reference

For a deeper understanding of how the application uses these Google services:

```
OAuth Login Flow:
  Browser → /api/google-auth/authorize → Google Consent Screen
         → /api/google-auth/callback  → JWT tokens issued → User logged in

Sync Meetings Flow:
  Admin creates meeting → Service Account creates Calendar event + Meet link
  Cron polls endpoint   → Google Meet API returns conference record
  Ingestion             → Fetches participants + transcripts via Meet API
  Analysis              → OpenAI analyzes transcript → Results stored in DB
```

**Services involved:**
- `packages/services/google-workspace/google-auth.service.ts` — OAuth login
- `packages/services/google-workspace/google-calendar.service.ts` — Calendar events (Service Account)
- `packages/services/google-workspace/google-meet.service.ts` — Meet records & transcripts (Service Account)
- `packages/config/index.ts` — Environment variable validation

---

[github-setup.md]
# GitHub Setup Guide

Complete step-by-step guide to configure GitHub for the Leaderboard application. There are two ways to give the app a GitHub token, and you only need one:

- **Static token (`.env`)** — a Fine-Grained Personal Access Token set as `GITHUB_TOKEN`. Simple, works everywhere, but shared by the whole instance and must be rotated manually.
- **In-app OAuth connection (recommended)** — an admin connects a GitHub organization account from the UI (`/contributors/me` → Appearance tab). The resulting token is encrypted and stored in the database, and can be swapped or disconnected without touching server config. See [`admin-settings.md`](./admin-settings.md) for how it behaves; this guide covers registering the GitHub OAuth App it needs.

If both are configured, the app prefers the in-app connection and only falls back to `GITHUB_TOKEN` when nothing is connected.

> **Note:** an earlier version of this app also processed GitHub webhooks to auto-evaluate merged PRs. That webhook route has since been removed — there is no `/api/webhooks/github` endpoint anymore, and `GITHUB_WEBHOOK_SECRET` is no longer used. If you configured a webhook for this app previously, you can safely delete it.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Option A — Fine-Grained Personal Access Token](#2-option-a--fine-grained-personal-access-token)
3. [Option B — In-App OAuth Connection](#3-option-b--in-app-oauth-connection)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Verify the Setup](#5-verify-the-setup)
6. [Production Deployment Checklist](#6-production-deployment-checklist)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

| Requirement | Why |
|---|---|
| A GitHub account with admin access to the target repositories/organization | Required to create tokens with sufficient permissions, and (for the OAuth option) to authorize the org |
| The target repository (or organization) already exists on GitHub | The connector reads commits and manages branches on existing repos |

---

## 2. Option A — Fine-Grained Personal Access Token

Use this if you want a single static token for the whole instance, configured once via `.env`.

### Step A: Navigate to token creation

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**

### Step B: Configure the token

1. **Token name**: e.g. `leaderboard-connector`
2. **Expiration**: choose a duration (90 days recommended; set a reminder to rotate)
3. **Description**: e.g. `Token for Leaderboard app — commits, branches`

### Step C: Set repository access

| Option | When to use |
| ------ | ----------- |
| **All repositories** | If the app needs access to all current and future repos in your account/organization |
| **Only select repositories** | If you want to restrict access to specific repos (max 50). Recommended for security |

### Step D: Set repository permissions

Click **+ Add permissions** under the **Repositories** tab and enable:

| Permission | Access level | Why |
| ---------- | ------------ | --- |
| **Contents** | **Read and write** | Read commits, file contents, tree structures, and create git references (branches) |
| **Metadata** | **Read-only** (required, auto-selected) | Access repository metadata (name, default branch, etc.) |
| **Administration** | **Read and write** | Update branch protection rules (restrict push access per user). Required for task assignment |

> **Warning:** If Contents or Administration is **Read-only**, branch creation will fail with `Resource not accessible by personal access token` when assigning a task. Both must be **Read and write**.

### Step E: Generate and copy the token

1. Click **Generate token**
2. **Copy the token immediately** — it will not be shown again. This is your `GITHUB_TOKEN`.

---

## 3. Option B — In-App OAuth Connection

Use this if you want admins to connect/disconnect GitHub accounts from the UI, without editing server config. This is a one-time setup per instance; each admin's "Connect GitHub Account" click afterwards is self-service.

### Step A: Register a GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. Fill in:

| Field | Value |
|-------|-------|
| Homepage URL | `http://localhost:3000` (or your production URL) |
| Authorization callback URL | `http://localhost:3000/api/github-oauth/callback` (or your production URL + the same path) |

3. Click **Register application**
4. Copy the **Client ID**, then click **Generate a new client secret** and copy it too

### Step B: Generate an encryption key

The token is encrypted before being stored in the database — generate a key for that:

```bash
openssl rand -hex 32
```

### Step C: Add to `.env`

```env
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/github-oauth/callback
GITHUB_TOKEN_ENCRYPTION_KEY=<output of openssl rand -hex 32>
```

Copy to `apps/leaderboard-client/.env.local` as well.

### Step D: Connect via the UI

Log in as an admin → `/contributors/me` → **Appearance** tab → **Connect GitHub Account**. GitHub will ask you to authorize the app. The account must be an **owner or admin of a GitHub organization** — personal accounts without an org are rejected with a clear error.

---

## 4. Configure Environment Variables

### Static token option

```env
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### OAuth connection option

```env
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/github-oauth/callback
GITHUB_TOKEN_ENCRYPTION_KEY=<64 hex chars>
```

Both sets of variables are optional at startup — the app runs fine with neither (GitHub-backed features simply won't have a token), and you can set up one, the other, or both.

---

## 5. Verify the Setup

### Test the Connector (either option)

1. Start the application (`npm run dev`)
2. Log in as an admin
3. Create a new challenge and link a GitHub repository (format: `owner/repo`)
4. Run a sync, or open the challenge's activity view — the application should fetch commits from the repository

### Test the OAuth Connection specifically

1. Log in as an admin, go to `/contributors/me` → Appearance
2. Click **Connect GitHub Account**, authorize on GitHub
3. You should be redirected back with the connection showing as active (org name, masked token, connected-by)
4. Click **Disconnect** — connectors should fall back to `GITHUB_TOKEN` (or fail gracefully if that isn't set either)

### Test the Branch Provisioner (optional)

1. Assign a task on a challenge with a linked GitHub repo
2. The application should automatically create a new branch on the GitHub repository
3. Verify the branch exists on GitHub

---

## 6. Production Deployment Checklist

- [ ] Set `GITHUB_TOKEN` (if using the static option) in your hosting provider's environment variables
- [ ] Or: set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_OAUTH_REDIRECT_URI` / `GITHUB_TOKEN_ENCRYPTION_KEY` (if using the OAuth option), with the redirect URI pointing at your production domain, and register that same URL as the OAuth App's callback URL on GitHub
- [ ] Ensure the PAT (if used) has not expired — set a calendar reminder for rotation
- [ ] If using "Only select repositories" for the PAT, ensure all repos linked to challenges are included
- [ ] Verify the `Administration` permission is granted if you use the branch provisioner

---

## 7. Troubleshooting

### Connector Issues

| Error | Cause | Fix |
| ----- | ----- | --- |
| `Failed to connect to GitHub repo owner/repo` | Invalid token or repo not accessible | Verify the active token (OAuth connection or `GITHUB_TOKEN`) is valid and has access to the repository |
| `Bad credentials` (401) | Token is invalid or revoked | Generate a new PAT, or reconnect via the OAuth flow |
| `Not Found` (404) | Repository doesn't exist or token lacks access | Check the repo exists and is included in the token's access scope |
| `Resource not accessible by personal access token` (403) | Missing permission on the PAT | Edit the token on GitHub and add the required permission (see [Step 2D](#2-option-a--fine-grained-personal-access-token)) |
| Branch creation fails | Missing `Administration` permission | Edit the PAT and grant **Administration: Read and write** |

### OAuth Connection Issues

| Error (`?github_error=`) | Cause | Fix |
| ------------------------- | ----- | --- |
| `no_org_admin` | The connected account has no organization where it's an admin/owner | Use an account that owns or administers a GitHub organization |
| `csrf` | The connection attempt expired or the state didn't match | Retry the "Connect GitHub Account" flow from scratch |
| `exchange_failed` | GitHub rejected the code exchange | Check `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are correct and not expired |
| Decryption fails after reconnecting on a new environment | `GITHUB_TOKEN_ENCRYPTION_KEY` changed or is missing | The key must stay the same across restarts/deploys — a changed key can't decrypt previously stored tokens; disconnect and reconnect in that case |

### Token Rotation

1. Create a new token (Option A, [Step 2](#2-option-a--fine-grained-personal-access-token)) or simply reconnect via the UI (Option B)
2. If using the static option, update `GITHUB_TOKEN` and restart the application

---

## Architecture Reference

```
Connector Flow:
  Admin creates challenge  → Links GitHub repo (owner/repo)
  Sync / activity view     → active token (DB connection, else GITHUB_TOKEN) authenticates via Octokit
  Commits fetched          → repos.listCommits() with date/author filters
  Activity fetched         → commits + PRs + PR reviews + branches, merged into a timeline

Branch Provisioner Flow:
  Task assigned            → git.getRef() on base branch
                            → git.createRef() creates new branch
                            → repos.updateBranchProtection() restricts push access

OAuth Connection Flow:
  Admin clicks Connect      → GET /api/github-oauth/authorize → GitHub consent screen
  GitHub authorizes         → GET /api/github-oauth/callback
                            → validates org admin/owner membership
                            → encrypts token, stores in app_settings
  Admin clicks Disconnect   → DELETE /api/github-oauth/connection → falls back to .env
```

**Key files:**

- `packages/connectors/github/` — commit/activity fetching & file content
- `packages/provisioner/github-branch.provider.ts` — branch creation & protection
- `packages/connectors/registry.ts` — connector factory (maps repo type `github` to the connector)
- `packages/config/githubToken.ts` — token resolution (DB connection, falls back to `.env`)
- `apps/leaderboard-client/src/app/api/github-oauth/` — OAuth authorize/callback/status/connection routes
- `packages/config/index.ts` — environment variable validation

---

[getting-started.md]
# Getting started

This guide covers setting up the project locally from scratch.

**Prerequisites:**
- Node.js 18+
- PostgreSQL 14+

---

## 1. Clone and install dependencies

```bash
git clone <repo-url>
cd leaderboard
npm install
```

---

## 2. Create a PostgreSQL database

Start PostgreSQL and create a database and user:

```sql
CREATE USER leaderboard_user WITH PASSWORD 'leaderboard_password';
CREATE DATABASE mytwin_leaderboard OWNER leaderboard_user;
```

---

## 3. Configure environment variables

Create a `.env` file at the **repo root**:

```env
# Required
DATABASE_URL=postgresql://leaderboard_user:leaderboard_password@localhost:5432/mytwin_leaderboard
JWT_SECRET=replace-with-a-32+character-secret-at-least

# Required — Google OAuth (used for login)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google-auth/callback

# Optional — only needed for AI evaluation
OPENAI_API_KEY=

# Optional — only needed for GitHub integration (static token option — see github-setup.md)
GITHUB_TOKEN=

# Optional — only needed for the in-app GitHub OAuth connection (see github-setup.md)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/github-oauth/callback
GITHUB_TOKEN_ENCRYPTION_KEY=

# Optional — only needed for Kaggle (ML challenges) if not connected via the UI
KAGGLE_USERNAME=
KAGGLE_KEY=

# Optional — only needed for Google Drive connector
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_FOLDER_ID=

# Optional — only needed for sync meetings (Google Workspace)
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY=
GOOGLE_WORKSPACE_ADMIN_EMAIL=

# Optional — secures the meeting-polling cron endpoint
CRON_SECRET=

# Optional — observability (Grafana Cloud)
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_EXPORTER_OTLP_HEADERS=
OTEL_SERVICE_NAME=leaderboard-api
```

Then copy it for the Next.js app (which reads from `.env.local`):

```bash
# macOS / Linux
cp .env apps/leaderboard-client/.env.local

# Windows (PowerShell)
Copy-Item .env apps/leaderboard-client/.env.local
```

> The root `.env` is used by Drizzle (schema push) and the seed script. The `apps/leaderboard-client/.env.local` is used by Next.js at runtime. Both must exist.

---

## 4. Initialize the database schema

Run the init script for your OS:

```bash
# macOS / Linux
npm run init:macos

# Windows
npm run init:windows
```

Or manually:

```bash
npm run db:push
```

This pushes the Drizzle schema to your local database.

---

## 5. Seed initial data

```bash
npm run populate-db
```

This inserts the starter projects, users, challenges, and contributions from `db_data/*.json`.

> **Warning:** This is destructive — it deletes existing rows first. Don't run it against a database with real data you want to keep.

---

## 6. Start the development server

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Invalid environment configuration: JWT_SECRET…` | Make sure `JWT_SECRET` is at least 32 characters in your `.env` |
| Drizzle or seed can't connect | Check that Postgres is running, `DATABASE_URL` is correct, and the DB/user exist |
| API calls fail but app starts | Make sure you copied `.env` to `apps/leaderboard-client/.env.local` |
| `next build` fails with missing `OPENAI_API_KEY` | Use `npm run prod:min` for production, or set the key in `.env` |

---

## Useful commands

```bash
npm run dev            # Start Next.js dev server
npm run db:push        # Apply schema changes to local DB
npm run db:studio      # Open Drizzle Studio (DB browser)
npm run populate-db    # Reset + seed the database
npm test               # Run all tests
```

See [`deployment.md`](./deployment.md) for production setup.

---

[evaluation.md]
# Evaluation

The evaluation system uses OpenAI agents to automatically score a contributor's work on a task and compute their Contribution Point (CP) reward.

**Package:** `packages/services/task_evaluation` + `packages/evaluator`
**Requires:** `OPENAI_API_KEY` + `GITHUB_TOKEN`

---

## Overview

Evaluation is **task-scoped** — one evaluation per contributor per task. Since the contributor and task are already known, there is no identification or deduplication step. The pipeline goes directly from context to score.

Triggered via: `POST /api/tasks/:id/evaluate`

Can be called by an admin or the contributor assigned to the task.

> This pipeline only applies to `type: 'code'` challenges — tasks only exist on code challenges. `type: 'ml'` challenges (datasets, models, packaging) use a separate, live reward system with no AI-scored "evaluation run" step in the same sense — see [`ml-rewards.md`](./ml-rewards.md).

---

## Pipeline

```
POST /api/tasks/:id/evaluate
        ↓
TaskEvaluationService.evaluateTask({ taskId, userId })
        ↓
1. TaskContextService     → load task, parent challenge, workspace branches
        ↓
2. ConnectorsOrchestrator → connect to each workspace (e.g. GitHub branch)
        ↓
3. fetch commits          → up to 100 commits across all workspaces
        ↓
4. SnapshotService        → build aggregated code snapshot from commits
        ↓
5. EvaluationGridRegistry → load the grid matching the task type
        ↓
6. OpenAIAgentEvaluator   → score the contribution against the grid
        ↓
7. ContributionRepository → upsert: create contribution or update existing one
        ↓
8. RunLogger              → log the evaluation run result
```

**Upsert logic:** if a contribution already exists for `(task_id, user_id)`, it is updated with the new evaluation. Otherwise a new contribution record is created. This means running evaluation multiple times on the same task is safe — it just refreshes the score.

---

## What the evaluator scores

The `OpenAIAgentEvaluator.evaluate()` method takes:
- The contribution metadata (title, type, description, commit SHAs)
- A code snapshot (the actual diff/file contents from the branch commits)
- The evaluation grid for the task type

It produces an `Evaluation` object with:
- `scores` — per-criterion scores (0–9 each)
- `globalScore` — final weighted score (0–100)

---

## Evaluation grids

Grids define the scoring criteria. The grid used is selected automatically based on `task.type`.

| Task type | Grid |
|-----------|------|
| `code` | Technical quality, architecture, security, maintainability, documentation, impact |
| `model` | Model architecture, training quality, performance metrics, reproducibility |
| `dataset` | Data quality, coverage, labeling accuracy, documentation |
| `docs` | Completeness, clarity, accuracy, structure |

Grids can also be defined and stored in the database via the admin panel (`/admin/evaluation-grids`), and are loaded at runtime by `DatabaseGridProvider`.

### Scoring scale

Each criterion is scored 0–9:

| Score | Meaning |
|-------|---------|
| 8–9 | Exceptional — reference quality |
| 5–7 | Good — production-ready with minor improvements |
| 2–4 | Acceptable — needs revision |
| 0–1 | Problematic — major issues |

The `globalScore` (0–100) is a weighted average across all criteria.

---

## Reward distribution

After evaluation, CP rewards are computed from the contribution score and the challenge's reward pool. Distribution logic lives in `packages/evaluator/reward.ts`.

Formula: `contributor_reward = (contributor_score / total_challenge_scores) × reward_pool`

The result is written to `contributions.reward`.

---

## Reviewing past evaluation runs

Every sync/evaluation triggers an `evaluation_runs` record (trigger type, time window, status, error details if it failed). Admins can browse and retry these from the admin panel:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/evaluation-runs` | List runs, filterable by challenge and status. Admin. |
| `GET` | `/api/evaluation-runs/:id` | Get a single run's detail. |
| `DELETE` | `/api/evaluation-runs/:id` | Delete a run record. |
| `POST` | `/api/evaluation-runs/:id/retry` | Re-run the evaluation for that run's challenge. Admin. |

---

## Key files

| File | Purpose |
|------|---------|
| `packages/services/task_evaluation/task-evaluation.service.ts` | Main pipeline — orchestrates context, snapshot, evaluation, upsert |
| `packages/services/task_evaluation/task-context.service.ts` | Loads task, challenge, assignees, and workspace branches |
| `packages/evaluator/evaluator.ts` | `OpenAIAgentEvaluator` — calls the OpenAI scoring agent |
| `packages/evaluator/openai/evaluate.agent.ts` | The OpenAI agent that produces scores |
| `packages/evaluator/grids/` | Built-in grid definitions (code, model, dataset, docs) |
| `packages/evaluator/reward.ts` | CP reward distribution logic |
| `packages/services/evaluation-grid.service.ts` | CRUD for database-stored grids |
| `packages/services/database-grid-provider.ts` | Fetches the active grid from the DB at runtime |
| `apps/leaderboard-client/src/app/api/tasks/[id]/evaluate/route.ts` | API endpoint that triggers evaluation |

---

> **Note on the old challenge-level pipeline:** The codebase still contains `packages/services/challenge/sync-evaluation.service.ts` and `packages/evaluator/openai/identify.agent.ts` / `merge.agent.ts`. These are **no longer used** — the challenge-level identify/merge/evaluate flow has been replaced by task-level evaluation via `TaskEvaluationService`.

---

[deployment.md]
# Deployment

The app is deployed as a single Next.js process managed by **PM2** on a VPS.

---

## Prerequisites

- Node.js 18+ installed on the server
- PM2 installed globally: `npm install -g pm2`
- PostgreSQL running and accessible
- A `.env` file at the repo root with all required variables set

---

## Two production modes

The optional packages (evaluator, connectors, sync meetings) require API keys. If those keys are not available, the build will fail. To handle this, there are two production modes:

| Mode | Command | When to use |
|------|---------|-------------|
| **Full** | `npm run prod:full` | You have all API keys (`OPENAI_API_KEY`, Google credentials, etc.) |
| **Minimal** | `npm run prod:min` | You only need the UI + database. No AI, no connectors. |

`prod:min` injects placeholder values for optional env vars so `next build` doesn't crash, then runs the app without those features active.

---

## Deploy steps

From the repo root on the server:

```bash
# Full mode (all features enabled)
npm run prod:full

# Or minimal mode (UI + DB only)
npm run prod:min
```

This runs:
1. `npm install` (installs dependencies)
2. `next build` (builds the Next.js app)
3. `pm2 start` (starts the process via PM2)

**Default port:** `3014`
Override with: `PORT=8080 npm run prod:full`

**PM2 app name:** `leaderboard-client`

---

## PM2 management commands

```bash
npm run prod:status    # Check if the process is running
npm run prod:logs      # Stream logs
npm run prod:restart   # Restart the app (after a code update)
npm run prod:stop      # Stop the process
npm run prod:delete    # Remove the process from PM2
```

---

## Updating the app

```bash
git pull
npm run prod:restart   # or prod:full / prod:min to rebuild
```

If you changed the database schema:

```bash
npm run db:push        # Apply schema changes before restarting
npm run prod:restart
```

---

## Nginx reverse proxy

Point your domain to the VPS, then proxy to the local Next.js process:

```nginx
server {
    server_name lab.my-twin.io;

    location / {
        proxy_pass http://127.0.0.1:3014;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable HTTPS with Certbot: `certbot --nginx -d lab.my-twin.io`

---

## Environment variables for production

The `.env` at the repo root is read by both Drizzle and the Next.js build. The `apps/leaderboard-client/.env.local` should also be set (or symlinked):

```bash
cp .env apps/leaderboard-client/.env.local
```

Required in production:
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-32+-character-secret
NODE_ENV=production
```

Required for full mode:
```env
OPENAI_API_KEY=...
GITHUB_TOKEN=...
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY=...
GOOGLE_WORKSPACE_ADMIN_EMAIL=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=...
CRON_SECRET=...
```

Optional, only if you want the in-app GitHub OAuth connection, Kaggle-backed ML challenges, or Slack contribution signals (see [`admin-settings.md`](./admin-settings.md)):
```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_OAUTH_REDIRECT_URI=...
GITHUB_TOKEN_ENCRYPTION_KEY=...
KAGGLE_USERNAME=...
KAGGLE_KEY=...
SLACK_BOT_TOKEN=...
```

---

## Cron jobs

Two endpoints must be hit on a schedule, both secured by `Authorization: Bearer $CRON_SECRET`:

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/check-meetings` | every minute | Detect completed meetings and trigger analysis |
| `/api/cron/slack-signals` | daily | Detect Slack contribution signals (see [`slack-signals.md`](./slack-signals.md)) |

On **Vercel**, `vercel.json` declares both crons and nothing else is needed. On **Scalingo / PM2**, there is no built-in scheduler: use the Scalingo Scheduler addon, a system crontab, or an external service (e.g. cron-job.org) to `curl` the endpoints:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/slack-signals
```

---

## Observability

The app is instrumented with OpenTelemetry. Traces are exported to Grafana Cloud if configured:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-eu-west-2.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-instance_id:api_token>
OTEL_SERVICE_NAME=leaderboard-api
```

These are optional — the app runs fine without them.

---

[database.md]
# Database

The project uses **PostgreSQL 14+** with **Drizzle ORM** for schema definition and queries.

- Schema source of truth: `packages/database-service/db/drizzle.ts`
- Drizzle config: `drizzle.config.ts` (root)
- Generated migrations: `drizzle/`

---

## Common commands

All run from the repo root:

```bash
# Push the current schema to your local database (use this in development)
npm run db:push

# Generate a migration file from schema changes
npm run db:generate

# Open Drizzle Studio (browser UI to inspect your DB)
npm run db:studio

# Wipe and re-seed the database with initial data
npm run populate-db
```

---

## Schema overview

The schema is divided into seven domains. All IDs are UUIDs generated by the database.

### Users & Auth

| Table | Purpose |
|-------|---------|
| `users` | Contributors. Key columns: `uuid`, `email`, `full_name`, `google_user_id` (linked Google account), `github_username`, `role` (free-text; only `admin` and `contributor` are ever set), `avatar_url`, `created_at`. There is no "manager" role — see below. |
| `refresh_tokens` | Stores hashed refresh tokens linked to a user. Used for JWT token rotation. |
| `onboarding_progress` | One row per user: five boolean quest flags + `completed_at`. See [`onboarding.md`](./onboarding.md). |

### Projects & Repositories

| Table | Purpose |
|-------|---------|
| `projects` | Top-level initiatives. Columns: `uuid`, `title`, `description`, `created_at`, `manager_id` (nullable FK → `users.uuid` — the contributor who manages this project's challenges; see [`auth.md`](./auth.md#project-managers-not-a-role)) |
| `repos` | External repositories. Columns: `uuid`, `project_id`, `title`, `type` (`github` / `kaggle_dataset` / `kaggle_model`), `external_repo_id` (e.g. `owner/repo` or `owner/slug`) |

### Challenges & Teams

| Table | Purpose |
|-------|---------|
| `challenges` | Time-bounded sprints. Columns: `uuid`, `index` (sequential display number), `project_id`, `title`, `description`, `roadmap`, `status`, `type` (`code`, `ml`, or `validation`, default `code`), `start_date` / `end_date` (both optional — a challenge can have no dates), `contribution_points_reward` (the reward pool), `completion`, `reward_rules` (JSON, `ml` challenges only — see [`ml-rewards.md`](./ml-rewards.md)), `source_challenge_id` (`validation` challenges only — the linked `ml` challenge, 1:1), `cp_per_validation` (`validation` challenges only — CP per first-time validation, see [`validation-challenges.md`](./validation-challenges.md)) |
| `challenge_repos` | M:N link between challenges and repos. Also stores the repo's `role` in an ML flow (`dataset` / `model` / `model_code` / `api`) and workspace provisioning metadata (branch, URL, status). |
| `challenge_teams` | M:N link between challenges and users (team membership). |
| `challenge_documents` | Small markdown notes attached to a challenge. Columns: `uuid`, `challenge_id`, `filename` (must end in `.md`), `content` (raw text, max 500KB), `uploaded_by`. Not a file-upload system — content is stored as text in Postgres. |
| `challenge_signals` | Discussion contribution signals defined per challenge (detected by AI in Slack messages). Columns: `uuid`, `challenge_id`, `label`, `description` (the written definition sent to the LLM), `reward_cp` (fixed CP per detection), `icon` (key from the predefined lucide icon set), `position`. See [`slack-signals.md`](./slack-signals.md). |
| `challenge_slack_configs` | One row max per challenge: the watched Slack channel + the ingestion cron's operational state. Columns: `challenge_id` (PK), `channel_id`, `channel_name`, `last_ts` (Slack ts cursor, stored as string), `last_run_at`, `last_error`. |

### Tasks

Tasks only exist for `type: 'code'` challenges — `ml` challenges never have tasks (see [`ml-rewards.md`](./ml-rewards.md#constraint-ml-challenges-never-have-tasks)).

| Table | Purpose |
|-------|---------|
| `tasks` | Concrete units of work inside a code challenge. Columns: `uuid`, `challenge_id`, `repo_id`, `parent_task_id`, `title`, `description`, `type` (`solo` / `concurrent`), `status` (`todo` / `done` only — the contributor-facing kanban shows a third "in progress" column, but that state is derived from whether the task has an assignee, not stored) |
| `task_assignees` | Who is assigned to a task (M:N users ↔ tasks). |
| `task_workspaces` | Provisioned workspace for a task (e.g. a GitHub branch). |

### Contributions & Evaluation

| Table | Purpose |
|-------|---------|
| `contributions` | A recorded unit of work. Columns: `uuid`, `challenge_id`, `user_id`, `task_id` (null for ML contributions), `type`, `title`, `description`, `tags` (JSON string array), `evaluation` (JSON), `evaluation_status` (`pending` / `running` / `done` / `failed` / `skipped_reuse`), `artifact_url` (normalized submission URL, used to detect reuse between contributors on ML challenges), `live_endpoint_url` (`api_packaging` contributions only — deployed endpoint URL, see [`validation-challenges.md`](./validation-challenges.md)), `reward`, `submitted_at` |
| `reward_entries` | Append-only ledger of point awards — one row per award or deduction. Used by `ml` challenges (see [`ml-rewards.md`](./ml-rewards.md)), by Slack discussion signals (`rule_key: 'slack_signal'`, out of pool — see [`slack-signals.md`](./slack-signals.md)), and by validation challenges (`rule_key: 'validation'`, drains the validation challenge's own pool — see [`validation-challenges.md`](./validation-challenges.md)). |
| `validation_targets` | Which `api_packaging` contributions are exposed on a `validation` challenge. Columns: `uuid`, `validation_challenge_id`, `contribution_id`, `position`. |
| `validation_attempts` | One row the first time a validator successfully validates a given target — dedupes the CP award. Columns: `uuid`, `validation_challenge_id`, `contribution_id`, `validator_user_id`. No file or response body is stored. |
| `evaluation_grids` | Scoring grid templates. Columns: `id`, `name`, `type`, `version`, `is_active` |
| `evaluation_grid_categories` | Categories within a grid (e.g. "Architecture", "Security"). Includes `weight`. |
| `evaluation_grid_subcriteria` | Detailed criteria within a category with scoring guides. |
| `evaluation_runs` | A record of one evaluation run on a challenge (trigger type, time window, status, error info). Viewable and retriable by admins — see [`evaluation.md`](./evaluation.md). |
| `evaluation_run_contributions` | Individual contribution results from a run. |

### Sync Meetings

| Table | Purpose |
|-------|---------|
| `sync_meetings` | A meeting created from the app. Columns: `id`, `challenge_id`, `title`, `google_meet_link`, `google_event_id`, `scheduled_at`, `status` |
| `meeting_participants` | Users invited to / present in a meeting. |
| `meeting_analyses` | AI analysis output for a meeting: summary, decisions, actions, contribution signals. |

### App Settings

| Table | Purpose |
|-------|---------|
| `app_settings` | Singleton row (`id = 1`) holding instance-wide admin settings: active theme (`theme_key`, optional custom `primary_color` / `background_color`, `theme_mode`), module visibility toggles (`modules_meetings_enabled`, `modules_onboarding_enabled`), and the encrypted GitHub/Kaggle/Slack/OpenAI connection state. See [`admin-settings.md`](./admin-settings.md). |

---

## Key relationships

```
projects ──< repos
projects ──< challenges
projects >── users (manager_id, optional)
challenges ──< challenge_repos >── repos
challenges ──< challenge_teams >── users
challenges ──< tasks
challenges ──< challenge_documents
challenges ──< challenge_signals
challenges ─── challenge_slack_configs (1:0..1)
tasks ──< task_assignees >── users
tasks ──< task_workspaces
challenges ──< contributions
contributions >── users
contributions ──< reward_entries
challenges ──< reward_entries
challenges ─── challenges (source_challenge_id, validation → ml, 1:1)
challenges ──< validation_targets >── contributions
challenges ──< validation_attempts >── contributions
validation_attempts >── users
challenges ──< evaluation_runs
evaluation_runs ──< evaluation_run_contributions
challenges ──< sync_meetings
sync_meetings ──< meeting_participants >── users
sync_meetings ──< meeting_analyses
users ──< onboarding_progress
users ──< refresh_tokens
```

---

## Seeding the database

The seed script clears all tables (in dependency order) and re-inserts data from JSON files:

```bash
npm run populate-db
```

Data files:
- `db_data/projects.json`
- `db_data/users.json`
- `db_data/challenges.json`
- `db_data/contributions.json`

> **Warning:** This is destructive — it deletes existing rows. UUIDs are regenerated on each run.

---

## Migrations

Drizzle generates SQL migration files in `drizzle/` when you run `npm run db:generate`. In practice, `npm run db:push` (which pushes the schema directly without generating a migration file) is the primary workflow during development.

If you change the schema in `packages/database-service/db/drizzle.ts`, always run `npm run db:push` to apply the changes to your local database before testing.

---

[challenges-and-tasks.md]
# Challenges and Tasks

## Overview

**Challenges** are time-bounded sprints attached to a project. They define the scope, reward pool (CP), and — optionally — a timeline for a period of work. Dates are optional: a challenge can be created with no `start_date`/`end_date` at all.

**Tasks** are the primary unit of work inside a `type: 'code'` challenge. Everything a contributor does is tied to a task — not directly to a challenge. The challenge is the container; the task is where the actual work happens.

### Challenge types

A challenge has a `type`: `code` (the default), `ml`, or `validation`.

- **`code`** challenges work as described in this document — tasks, assignees, workspaces, and the task-evaluation pipeline in [`evaluation.md`](./evaluation.md).
- **`ml`** challenges are for dataset/model/packaging work. They have **no tasks at all** — contributors submit directly through a dedicated ML workspace flow, scored and rewarded live. See [`ml-rewards.md`](./ml-rewards.md) for that entire flow; it does not follow the task-based model described below.
- **`validation`** challenges have no tasks and no repos of their own — they link 1:1 to an existing `ml` challenge (`source_challenge_id`) and let contributors manually test its submitted API packagings by dropping a file and seeing the live output. See [`validation-challenges.md`](./validation-challenges.md).

---

## Challenge lifecycle

```
draft → active → closed
```

| Status | Description |
|--------|-------------|
| `draft` | Challenge created but not yet started. Team can be set up, repos linked. |
| `active` | Work is happening. Contributors can join, tasks can be assigned and worked on. |
| `closed` | Challenge is over. Evaluation may still be triggered to finalize scores and distribute rewards. |

A challenge is closed via `POST /api/challenges/:id/close`.

---

## What a challenge contains

- **Team** — contributors assigned to the challenge (`challenge_teams` table)
- **Repos** — repositories linked to the challenge (`challenge_repos` table): GitHub for code challenges, GitHub and/or Kaggle for ML challenges — each with an optional workspace (e.g. a branch)
- **Tasks** — concrete work items, code challenges only (see below)
- **Contributions** — recorded units of output, generated by the evaluation pipeline or added manually
- **Documents** — small markdown notes attached to the challenge (`challenge_documents` table) — write-ups, decisions, links, not a general file-upload system
- **Sync Meetings** — team meetings created from the app for this challenge
- **Repo activity** — a live, on-demand view of each linked repo's recent activity (GitHub commits/PRs/reviews, or Kaggle dataset/model info), fetched from the external API rather than stored
- **Discussion signals** — an optional Slack channel plus a set of AI-detected contribution signals with fixed CP rewards, configured from the edit drawer (both `code` and `ml` challenges) — see [`slack-signals.md`](./slack-signals.md)

---

## Tasks

A task represents a concrete, assignable unit of work inside a challenge.

### Task fields

| Field | Description |
|-------|-------------|
| `title` | Short description of what needs to be done |
| `description` | Detailed instructions |
| `type` | `solo` or `concurrent` |
| `status` | Stored as `todo` / `done` only. The contributor-facing kanban board shows a third "In Progress" column, but that's derived on the fly from whether the task has an assignee — it isn't a stored value. |
| `challenge_id` | The parent challenge |

### Task assignees

Tasks can be assigned to one or more contributors. Assignments are tracked in `task_assignees`.

### Task workspaces

When a task is provisioned, a workspace is created (e.g. a GitHub branch) and linked to the task via `task_workspaces`. This gives contributors a dedicated place to do their work.

Workspace provisioning is handled by `packages/provisioner`.

---

## Admin workflow (typical)

1. **Create a challenge** in the admin panel — set title, description, project, type (`code` or `ml`), reward pool, and optionally dates.
2. **Link repos** — attach the relevant GitHub repositories (or Kaggle dataset/model repos for an `ml` challenge).
3. **Add team members** — assign contributors to the challenge.
4. **Create tasks** — code challenges only: break down the work into individual tasks with clear descriptions and types.
5. **Assign tasks** — assign tasks to specific contributors.
6. **Provision workspaces** — create a GitHub branch per task so each contributor has a dedicated workspace.
7. **Monitor progress** — track task statuses as contributors work, using the interactive task board.
8. **Trigger evaluation** — once work is done on a task, call `POST /api/tasks/:id/evaluate`. This scores the contributor's work on that task's branch and creates or updates their contribution record. See [`evaluation.md`](./evaluation.md).
9. **Close the challenge** — finalize and distribute rewards.

### Project managers

An admin can designate a contributor as the **manager** of a project (`/admin/projects`). That contributor then gets a management view for all of that project's challenges — edit details/status, create meetings, manage documents and repos — without needing the admin role or access to `/admin/**`. See [`auth.md`](./auth.md#project-managers-not-a-role) for exactly what a manager can and cannot do.

---

## Contributor workflow

1. **Join a challenge** via `POST /api/challenges/:id/join` (or be added by an admin).
2. **Pick up a task** — find an unassigned or assigned task from the challenge's task list.
3. **Do the work** in the task's workspace (e.g. the GitHub branch).
4. **Task is evaluated** — an admin or the assignee triggers `POST /api/tasks/:id/evaluate`, which scores the work on that task's branch.
5. **Earn CP** — once the challenge closes, rewards are distributed based on evaluation scores across all of a contributor's tasks in that challenge.

---

## Linking tasks to contributions

Contributions are recorded units of evaluated output. For a code challenge, calling `POST /api/tasks/:id/evaluate` on a task scores the assigned contributor's work and upserts their `contributions` row for that task — see [`evaluation.md`](./evaluation.md). For an ML challenge, a contribution is created directly from the ML workspace submission flow instead (no task involved) — see [`ml-rewards.md`](./ml-rewards.md).

The task structure guides what work happens; the contribution record is the evaluated artifact.

---

## Data model

```
projects (manager_id → users, optional)
  └── challenges (type: code | ml)
        ├── challenge_teams  → users
        ├── challenge_repos  → repos
        ├── challenge_documents
        ├── tasks (code challenges only)
        │     ├── task_assignees → users
        │     └── task_workspaces
        ├── contributions    → users
        └── sync_meetings
```

**Key files:**
- `packages/database-service/repositories/challenge.repo.ts`
- `packages/database-service/repositories/task.repo.ts`
- `packages/database-service/repositories/challengeTeam.repo.ts`
- `packages/database-service/repositories/taskWorkspace.repo.ts`
- `apps/leaderboard-client/src/lib/server/managerAuth.ts` — resolves project-manager authorization
- `apps/leaderboard-client/src/app/challenges/[id]/manage/` — the manager view (mirrors the admin challenge view)
- `apps/leaderboard-client/src/app/api/challenges/`
- `apps/leaderboard-client/src/app/api/tasks/`

---

[auth.md]
# Authentication

The app uses **Google OAuth** as the identity provider. After Google verifies the user, the app issues its own **JWT tokens stored as HTTP-only cookies** for subsequent requests. There is no password login.

---

## How login works

```
1. User clicks "Sign in with Google"
2. Browser redirects to GET /api/google-auth/authorize
3. Server redirects to Google's OAuth consent screen
4. User authenticates with Google
5. Google redirects back to GET /api/google-auth/callback?code=...
6. Server exchanges the code for a Google access token
7. Server fetches the user's Google profile (email, name, google_user_id)
8. Server finds or creates the user in the database:
   - If user exists by google_user_id → log in
   - If user exists by email → link Google account and log in
   - Otherwise → create new user (role: contributor) + init onboarding
9. Server issues JWT access + refresh tokens as HTTP-only cookies
10. User is redirected to the app
```

---

## JWT tokens

After Google OAuth completes, all subsequent requests are authenticated via JWT cookies — Google is not contacted again on each request.

| Cookie | Lifetime | Purpose |
|--------|----------|---------|
| `access_token` | 15 minutes | Authenticates each API request |
| `refresh_token` | 7 days | Used to get a new access token without re-logging in |

JWT payload contains: `userId`, `email`, `role`.

Refresh tokens are also stored **hashed** in the `refresh_tokens` table. On refresh, the old token is invalidated and a new pair is issued (token rotation).

---

## Token refresh

When the access token expires, the client calls `POST /api/auth/refresh`. The server:
1. Reads the `refresh_token` cookie
2. Verifies the JWT signature
3. Invalidates all existing refresh tokens for the user
4. Issues a new `access_token` + `refresh_token` pair

---

## Logout

`POST /api/auth/logout` clears both cookies and invalidates all refresh tokens for the user in the database.

---

## Route protection

The proxy at `apps/leaderboard-client/src/proxy.ts` (Next.js middleware, runs at the Edge) checks the `access_token` cookie on every request.

| Path | Who can access |
|------|----------------|
| `/admin/**` | `admin` role only |
| `/contributors/me` | `admin` or `contributor` |
| `/challenges/**` | `admin` or `contributor` |
| `/api/google-auth/**` | Public (OAuth flow) |
| `/api/auth/refresh` | Cookie (any authenticated user) |
| `/api/auth/logout` | Cookie (any authenticated user) |
| `GET /api/**` (most) | Public or authenticated depending on route |
| `POST/PUT/DELETE /api/**` | Generally requires `admin` role, with a few named exceptions (self-assigning a task, joining a challenge, submitting ML work, editing your own profile, and the project-manager actions below) |

Since the proxy runs at the Edge, it cannot query the database — it only checks the JWT (role, user ID). Anything that depends on database state (e.g. "is this user the manager of this project?") is checked inside the route handler itself, not the proxy.

---

## Roles

Roles are stored in `users.role` and set when the user is created. There are only two:

| Role | Description |
|------|-------------|
| `admin` | Full access — manage challenges, tasks, contributions, users, evaluation grids, trigger evaluations, app-wide settings (theme, integrations, module toggles) |
| `contributor` | View leaderboard and profile, participate in onboarding, work on tasks |

New users registered via Google OAuth get the `contributor` role by default. Admins must be promoted manually in the database.

### Project managers (not a role)

A contributor can additionally be set as the **manager** of one or more projects (`projects.manager_id`, assigned by an admin in `/admin/projects`). This is a per-project relationship, not a value of `users.role` — a manager's `role` stays `contributor`.

Being the manager of a project's parent grants extra access to that project's challenges, without admin access anywhere else:

- Edit challenge details and status
- Create sync meetings
- Add/remove challenge documents
- Create or update repos linked to their project

Managers cannot open `/admin/**`, create or delete challenges, or manage users. They access their challenges through a dedicated `/challenges/[id]/manage` view (separate from the public `/challenges/[id]` page contributors see). See [`challenges-and-tasks.md`](./challenges-and-tasks.md) for how this fits into the challenge workflow.

---

## Required environment variables

```env
# JWT (always required)
JWT_SECRET=your-32+-character-secret-key
JWT_ACCESS_EXPIRY=15m        # optional, default: 15m
JWT_REFRESH_EXPIRY=7d        # optional, default: 7d

# Google OAuth (required for login)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google-auth/callback
```

`JWT_SECRET` must be **at least 32 characters**. The app will refuse to start with a shorter secret (enforced by `packages/config`).

---

## Key files

| File | Purpose |
|------|---------|
| `apps/leaderboard-client/src/lib/auth.ts` | JWT sign/verify helpers, cookie helpers |
| `apps/leaderboard-client/src/proxy.ts` | Route protection (Next.js middleware, Edge runtime) |
| `apps/leaderboard-client/src/lib/server/managerAuth.ts` | `isManagerOfChallenge()` — resolves project-manager status for a route handler |
| `apps/leaderboard-client/src/app/api/google-auth/authorize/route.ts` | Redirects to Google consent screen |
| `apps/leaderboard-client/src/app/api/google-auth/callback/route.ts` | Handles OAuth callback, creates/links user, issues JWT |
| `apps/leaderboard-client/src/app/api/auth/refresh/route.ts` | Token refresh handler |
| `apps/leaderboard-client/src/app/api/auth/logout/route.ts` | Logout handler |
| `packages/services/google-workspace/google-auth.service.ts` | Google OAuth client (getAuthUrl, getTokensFromCode, getUserInfo) |
| `packages/database-service/repositories/refresh-token.repo.ts` | Refresh token DB operations |

---

[architecture.md]
# Architecture

## Repository layout

This is a monorepo managed with npm workspaces. It has two top-level zones:

- **`apps/`** — deployable applications
- **`packages/`** — shared libraries consumed by apps and each other

```
leaderboard/
├── apps/
│   └── leaderboard-client/   ← Next.js app (the only deployed app)
└── packages/
    ├── config/               ← env validation (required by all)
    ├── database-service/     ← Drizzle ORM + repositories (required by all)
    ├── evaluator/            ← AI scoring pipeline (optional)
    ├── connectors/           ← GitHub + Google Drive (optional)
    ├── services/             ← orchestration logic (optional)
    ├── provisioner/          ← workspace provisioning (optional)
    ├── sync-meeting-agent/   ← meeting AI analysis (optional)
    └── test/                 ← ad-hoc test scripts
```

## How the pieces connect

The Next.js app is the single entry point for both the UI and the server-side logic. There is no separate API server — everything runs inside Next.js Route Handlers.

```mermaid
flowchart LR
  Browser -->|HTTP| NextApp["leaderboard-client\n(Next.js)"]
  NextApp -->|Route Handlers| Config["packages/config"]
  NextApp -->|Route Handlers| DB["packages/database-service\n(Drizzle + Repositories)"]
  DB --> Postgres[(PostgreSQL)]
  NextApp -->|optional| Services["packages/services"]
  NextApp -->|optional| Evaluator["packages/evaluator\n(OpenAI)"]
  NextApp -->|optional| Connectors["packages/connectors\n(GitHub / Google Drive)"]
  Services --> Evaluator
  Services --> Connectors
  Services --> DB
```

**Required at runtime:** `config` + `database-service`
**Optional (need API keys):** `evaluator`, `connectors`, `services`, `provisioner`, `sync-meeting-agent`

## Data flow — task evaluation pipeline

Evaluation is **task-scoped**: one contributor, one task, one evaluation run. The contributor and task are already known so there is no identification or deduplication step.

```mermaid
flowchart TD
  A["POST /api/tasks/:id/evaluate"] --> B["TaskEvaluationService"]
  B --> C["TaskContextService: load task + challenge + workspace branches"]
  C --> D["ConnectorsOrchestrator: connect to GitHub branch(es)"]
  D --> E["fetch commits (up to 100)"]
  E --> F["SnapshotService: build aggregated code snapshot"]
  F --> G["EvaluationGridRegistry: load grid for task type"]
  G --> H["OpenAIAgentEvaluator: score against grid"]
  H --> I["ContributionRepository: upsert contribution + score"]
  I --> J["RunLogger: log evaluation run"]
  I --> K["leaderboard UI updated"]
```

> The codebase still contains `sync-evaluation.service.ts` and the `identify` / `merge` agents from the old challenge-level pipeline — these are **no longer used**.

## Authentication flow

Login is via **Google OAuth** — there is no password login. After Google verifies the user, the app issues its own JWT cookies for all subsequent requests.

```mermaid
sequenceDiagram
  Browser->>+API: GET /api/google-auth/authorize
  API-->>-Browser: redirect to Google consent screen
  Browser->>+Google: user authenticates
  Google-->>-Browser: redirect to /api/google-auth/callback?code=...
  Browser->>+API: GET /api/google-auth/callback
  API->>Google: exchange code for tokens + fetch user info
  API->>DB: find or create user by google_user_id / email
  API-->>-Browser: Set-Cookie: access_token + refresh_token (HTTP-only)
  Browser->>+API: any protected request (cookie auto-sent)
  API->>API: middleware verifies JWT
  API-->>-Browser: response
  Browser->>+API: POST /api/auth/refresh (when access_token expired)
  API->>DB: verify + rotate refresh_token
  API-->>-Browser: new access_token cookie
```

## Sync meeting flow

```mermaid
flowchart LR
  App["Leaderboard App"] -->|create| Meet["Google Meet / Calendar\n(via Workspace service account)"]
  Meet -->|meeting happens| Recording["Meeting recording / transcript"]
  App -->|cron or manual trigger| Agent["sync-meeting-agent\n(OpenAI)"]
  Recording --> Agent
  Agent -->|store| DB["database-service\n(meeting_analyses table)"]
```

## Key design decisions

- **No separate API server.** All backend logic lives in Next.js Route Handlers. This simplifies deployment to a single PM2 process.
- **Optional packages.** The evaluator, connectors, services, and provisioner are all opt-in. The app runs fine with only `config` + `database-service`. This is why there are two prod modes (`prod:full` vs `prod:min`).
- **Drizzle over raw SQL.** The schema is defined in TypeScript (`packages/database-service/db/drizzle.ts`) and pushed to Postgres with `npm run db:push`. Migrations are generated but the primary workflow is schema-push in development.
- **Tasks as the unit of work — for code challenges.** Challenges are containers; tasks are where the actual work happens. The old challenge service is no longer used.
- **Two reward pipelines, split by challenge type.** `type: 'code'` challenges use the task-evaluation pipeline above and split a fixed pool proportionally at close. `type: 'ml'` challenges have no tasks — contributors submit datasets/models/packaging directly, scored and rewarded live, point by point. See [`ml-rewards.md`](./ml-rewards.md).
- **Project managers instead of a third role.** Rather than adding a `manager` value to `users.role`, elevated per-project access is modeled as a nullable FK (`projects.manager_id`). Role-based checks stay binary (`admin` / `contributor`); manager checks are a separate, project-scoped lookup. See [`auth.md`](./auth.md#project-managers-not-a-role).

---

[api.md]
# API

All API endpoints are implemented as **Next.js Route Handlers** under `apps/leaderboard-client/src/app/api/`. There is no separate API server.

All request bodies are JSON. All responses are JSON. Authentication is via HTTP-only JWT cookies (see [`auth.md`](./auth.md)).

---

## Auth

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/google-auth/authorize` | Start the Google OAuth flow — redirects to Google's consent screen. | Public |
| `GET` | `/api/google-auth/callback` | OAuth callback — exchanges code for tokens, finds or creates user, sets JWT cookies. | Public |
| `POST` | `/api/auth/refresh` | Exchange a valid refresh token for a new access token. | Cookie |
| `POST` | `/api/auth/logout` | Clear auth cookies and revoke all refresh tokens for the user. | Cookie |

---

## Users

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/users` | List all users. | Authenticated |
| `POST` | `/api/users` | Create a user. | Admin |
| `GET` | `/api/users/:id` | Get a user by ID. | Authenticated |
| `PATCH` | `/api/users/:id` | Update a user (e.g. role). | Admin |
| `DELETE` | `/api/users/:id` | Delete a user. | Admin |

---

## Current user

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/contributors/me` | Get the authenticated user's profile and stats. | Contributor+ |
| `GET` | `/api/contributors/me/tasks` | Get tasks assigned to the authenticated user. | Contributor+ |

---

## Leaderboard

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/leaderboard` | Get the ranked leaderboard with contributor scores and CP. | Public |

---

## Challenges

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/challenges` | List all challenges. Pass `?managed=true` to instead list all challenges (including drafts) belonging to projects the current user manages. | Public (managed filter requires auth) |
| `POST` | `/api/challenges` | Create a challenge. | Admin or project manager |
| `GET` | `/api/challenges/:id` | Get a challenge by ID. | Public |
| `PUT` | `/api/challenges/:id` | Update a challenge. | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id` | Delete a challenge. | Admin |
| `POST` | `/api/challenges/:id/close` | Close a challenge (set status to closed). | Admin |
| `GET` | `/api/challenges/:id/context` | Get the full context for evaluation (commits, notes). | Admin |
| `POST` | `/api/challenges/:id/join` | Join a challenge as a contributor. | Contributor+ |
| `GET` | `/api/challenges/:id/repos` | Get repos linked to a challenge. | Public |
| `GET` | `/api/challenges/:id/repo-activity` | Live activity for each linked repo — GitHub commits/PRs/reviews, or Kaggle dataset/model info. Fetched on demand, not cached. | Admin/manager pages |
| `POST` | `/api/challenges/:id/sync` | Trigger the AI evaluation sync for a challenge. | Admin |
| `GET` | `/api/challenges/:id/team` | Get team members of a challenge. | Public |
| `PUT` | `/api/challenges/:id/team/:userId` | Add/update a team member. | Admin |
| `GET` | `/api/challenges/:id/documents` | List a challenge's markdown documents. | Public |
| `POST` | `/api/challenges/:id/documents` | Add a `.md` document (max 500KB). | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id/documents/:docId` | Delete a document. | Admin or manager of its project |
| `GET` | `/api/challenges/:id/ml-workspace` | Get each contributor's submitted artifact URLs for an ML challenge. | Public |
| `PATCH` | `/api/challenges/:id/ml-workspace` | Submit/clear an artifact URL for one ML step (dataset, model, model code, or API packaging). Triggers scoring. | Contributor (self) |
| `GET` | `/api/challenges/:id/ml-rewards` | Pool state for an ML challenge (awarded, remaining, rules, per-user breakdown). | Public |
| `GET` | `/api/challenges/:id/signals` | List the challenge's discussion contribution signals. See [`slack-signals.md`](./slack-signals.md). | Public |
| `POST` | `/api/challenges/:id/signals` | Define a signal (label, description, CP reward, icon). | Admin or manager of its project |
| `PUT` | `/api/challenges/:id/signals/:signalId` | Update a signal. | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id/signals/:signalId` | Delete a signal. | Admin or manager of its project |
| `GET` | `/api/challenges/:id/slack-config` | Get the challenge's watched Slack channel + last run state. | Admin or manager of its project |
| `PUT` | `/api/challenges/:id/slack-config` | Set the watched Slack channel. | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id/slack-config` | Stop watching the channel. | Admin or manager of its project |

---

## Tasks

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/tasks` | List all tasks (optionally filtered by challenge). | Public |
| `POST` | `/api/tasks` | Create a task. | Admin |
| `GET` | `/api/tasks/:id` | Get a task by ID. | Public |
| `PUT` | `/api/tasks/:id` | Update a task. | Admin |
| `DELETE` | `/api/tasks/:id` | Delete a task. | Admin |
| `GET` | `/api/tasks/:id/details` | Get full task details including assignees and workspaces. | Public |
| `POST` | `/api/tasks/:id/assign` | Assign a contributor to a task. | Admin |
| `GET` | `/api/tasks/:id/assignees` | List assignees for a task. | Public |
| `POST` | `/api/tasks/:id/complete` | Mark a task as complete. | Admin or assignee |
| `POST` | `/api/tasks/:id/evaluate` | Trigger AI evaluation for the task. Scores the contributor's work on the task's workspace branch and upserts a contribution record. See [`evaluation.md`](./evaluation.md). | Admin or assignee |

---

## Contributions

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/contributions` | List contributions. | Public |
| `POST` | `/api/contributions` | Create a contribution. | Admin |
| `GET` | `/api/contributions/challenge/:id` | Get all contributions for a specific challenge. | Public |
| `GET` | `/api/contributions/:id/rewards` | Ledger breakdown of a contribution's points (ML awards, reuse credits/deductions, Slack signals). See [`ml-rewards.md`](./ml-rewards.md). | Public |

---

## Evaluation Grids

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/evaluation-grids` | List all evaluation grids. | Admin |
| `POST` | `/api/evaluation-grids` | Create a grid. | Admin |
| `GET` | `/api/evaluation-grids/:id` | Get a grid by ID. | Admin |
| `PUT` | `/api/evaluation-grids/:id` | Update a grid. | Admin |
| `DELETE` | `/api/evaluation-grids/:id` | Delete a grid. | Admin |
| `GET` | `/api/evaluation-grids/:id/categories` | Get categories for a grid. | Admin |

## Evaluation Runs

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/evaluation-runs` | List evaluation runs, filterable by challenge and status. | Admin |
| `GET` | `/api/evaluation-runs/:id` | Get a single run's detail. | Admin |
| `DELETE` | `/api/evaluation-runs/:id` | Delete a run record. | Admin |
| `POST` | `/api/evaluation-runs/:id/retry` | Re-run evaluation for that run's challenge. | Admin |

---

## Projects & Repos

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/projects` | List all projects. | Public |
| `POST` | `/api/projects` | Create a project. | Admin |
| `GET` | `/api/projects/:id` | Get a project by ID. | Public |
| `PUT` | `/api/projects/:id` | Update a project (including assigning a manager). | Admin |
| `GET` | `/api/repos` | List all repositories. | Public |
| `POST` | `/api/repos` | Register a repository. | Admin or manager of its project |
| `GET` | `/api/repos/:id` | Get a repo by ID. | Public |
| `GET` | `/api/repos/:id/challenges` | List challenges linked to a repo. | Public |
| `GET` | `/api/repos/:id/workspaces` | List task workspaces provisioned on a repo. | Public |
| `GET` | `/api/repos/challenge-repos` | Get challenge↔repo links (with joined repo data). | Public |

---

## Sync Meetings

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/sync-meetings` | List sync meetings. | Contributor+ |
| `POST` | `/api/sync-meetings` | Create a sync meeting in Google Workspace. | Admin or manager of the challenge's project |
| `GET` | `/api/sync-meetings/:id` | Get a meeting by ID. | Contributor+ |
| `GET` | `/api/sync-meetings/:id/analysis` | Get the AI analysis for a meeting. | Contributor+ |
| `GET` | `/api/sync-meetings/:id/participants` | List a meeting's participants. | Contributor+ |

---

## Onboarding

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/onboarding` | Get the authenticated user's onboarding progress. | Contributor+ |
| `POST` | `/api/onboarding` | Update onboarding mission progress. | Contributor+ |
| `GET` | `/api/onboarding/all` | List every contributor's onboarding progress. | Admin |

---

## Admin settings

See [`admin-settings.md`](./admin-settings.md) for what each of these controls.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `PATCH` | `/api/admin/theme` | Update the instance-wide theme. | Admin |
| `GET` | `/api/modules` | Get module visibility flags (meetings, onboarding). | Public |
| `PATCH` | `/api/modules` | Update module visibility flags. | Admin |
| `GET` | `/api/github-oauth/authorize` | Start the GitHub OAuth connection flow. | Admin |
| `GET` | `/api/github-oauth/callback` | OAuth callback — validates org admin/owner status, stores encrypted token. | Admin |
| `GET` | `/api/github-oauth/status` | Get GitHub connection state (never the token). | Admin |
| `DELETE` | `/api/github-oauth/connection` | Disconnect GitHub — falls back to `.env` `GITHUB_TOKEN`. | Admin |
| `GET` | `/api/kaggle/status` | Get Kaggle connection state. | Public |
| `POST` | `/api/kaggle/connection` | Connect a Kaggle account (verifies credentials, stores them encrypted). | Admin |
| `DELETE` | `/api/kaggle/connection` | Disconnect Kaggle — falls back to `.env` credentials. | Admin |
| `GET` | `/api/slack/status` | Get Slack connection state (and workspace name). | Public |
| `POST` | `/api/slack/connection` | Connect a Slack bot (verifies the token via `auth.test`, stores it encrypted). | Admin |
| `DELETE` | `/api/slack/connection` | Disconnect Slack — falls back to `.env` `SLACK_BOT_TOKEN`. | Admin |
| `GET` | `/api/slack/channels` | List public channels visible to the bot (for the challenge channel picker). | Admin or project manager |
| `GET` | `/api/openai/status` | Get OpenAI connection state. | Public |
| `POST` | `/api/openai/connection` | Connect an OpenAI API key (verified live, stored encrypted). | Admin |
| `DELETE` | `/api/openai/connection` | Disconnect OpenAI — falls back to `.env` `OPENAI_API_KEY`. | Admin |

---

## Cron

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/cron/check-meetings` | Polls for completed meetings and triggers analysis. Secured by `CRON_SECRET` header. | Cron secret |
| `GET` | `/api/cron/slack-signals` | Daily pass over each configured challenge's Slack channel: AI signal detection + CP awards. See [`slack-signals.md`](./slack-signals.md). | Cron secret |

These endpoints are designed to be called by an external cron scheduler (e.g. Vercel Cron, a server cron job). Set `CRON_SECRET` in your env and pass it as an `Authorization` header.

---

## Interactive API reference (development only)

In development, `GET /api/docs` serves a browsable API reference (via Scalar) generated from `src/app/api/openapi.yaml`, with `GET /api/openapi.json` as its backing spec. Both return `404` outside of `NODE_ENV=development` — this is a local exploration aid, not a production feature.

---

[admin-settings.md]
# Admin Settings

A handful of instance-wide settings — appearance, external integrations, and feature toggles — are controlled by admins from the **Appearance** and **Modules** tabs on their own profile page (`/contributors/me`). All of them are stored in a single singleton database row (`app_settings`, `id = 1`) and take effect immediately for every user.

---

## Appearance: theme

Admins can pick a predefined color theme for the whole app (e.g. Blue, Purple, Green, Orange, Red, Teal). The choice is stored in `app_settings.theme_key` and read on every page load — the root layout injects the theme's colors as CSS variables server-side, so the change applies to every visitor on their next request, with no client-side flicker or per-user preference.

- `PATCH /api/admin/theme` — admin-only, sets `theme_key` (and optionally custom `primary_color` / `background_color` hex overrides, and `theme_mode`: `dark` or `light`).
- There is no per-user override — one theme for the whole instance.

---

## Integrations: GitHub, Kaggle, Slack & OpenAI

All integrations follow the same pattern: instead of relying solely on a static token in `.env`, an admin connects an account from the UI. The credential is encrypted (AES-256-GCM) and stored in `app_settings`; the encryption key itself never enters the database. Connectors automatically prefer the database credential and fall back to the `.env` value if nothing is connected.

### GitHub

Connecting a GitHub org account replaces the static `GITHUB_TOKEN` for all connector operations (commits, file contents, branch provisioning).

1. Admin clicks **Connect GitHub Account** in the Appearance tab.
2. `GET /api/github-oauth/authorize` redirects to GitHub's OAuth consent screen.
3. `GET /api/github-oauth/callback` exchanges the code for a token, then checks that the authorizing account is an **owner or admin of a GitHub organization** — personal accounts without an org membership are rejected with a clear error.
4. The token is encrypted and stored (`app_settings.github_token_enc` / `github_token_iv` / `github_org` / `github_connected_at` / `github_connected_by`).
5. `DELETE /api/github-oauth/connection` disconnects — connectors immediately revert to the `.env` `GITHUB_TOKEN`.
6. `GET /api/github-oauth/status` reports connection state (never the token itself).

Setting up the OAuth App itself (client ID/secret, callback URL) is covered in [`github-setup.md`](./github-setup.md).

### Kaggle

Kaggle datasets and models are used by `type: 'ml'` challenges (see [`ml-rewards.md`](./ml-rewards.md)). Connecting a Kaggle account lets the app read dataset metadata and model version metrics on the admin's behalf.

- `POST /api/kaggle/connection` (admin-only) — takes a Kaggle username + API key, verifies them live against Kaggle's API, then encrypts and stores them (`app_settings.kaggle_username` / `kaggle_key_enc` / `kaggle_key_iv` / `kaggle_connected_at` / `kaggle_connected_by`).
- `DELETE /api/kaggle/connection` — disconnects, falling back to the `KAGGLE_USERNAME` / `KAGGLE_KEY` env vars if set.
- `GET /api/kaggle/status` — public, returns whether a Kaggle connection is active.

### Slack

Slack powers **discussion contribution signals**: challenges can watch a channel and reward predefined signals detected by AI in the daily conversation (see [`slack-signals.md`](./slack-signals.md)).

Setting up the bot:

1. Create a Slack app on <https://api.slack.com/apps> for your workspace.
2. Under **OAuth & Permissions**, add the bot scopes `channels:read`, `channels:history`, `users:read` and `users:read.email`, then install the app to the workspace.
3. Copy the **Bot User OAuth Token** (`xoxb-…`) and paste it in the Slack card of the Integrations tab.
4. Invite the bot to every channel you want to track (`/invite @your-bot`).

Routes:

- `POST /api/slack/connection` (admin-only) — takes the bot token, verifies it live against Slack's `auth.test` (which also captures the workspace name), then encrypts and stores it (`app_settings.slack_token_enc` / `slack_token_iv` / `slack_team_name` / `slack_connected_at` / `slack_connected_by`).
- `DELETE /api/slack/connection` — disconnects, falling back to the `SLACK_BOT_TOKEN` env var if set.
- `GET /api/slack/status` — public, returns whether a Slack connection is active (and the workspace name).
- `GET /api/slack/channels` (admin/manager) — lists public, non-archived channels for the channel picker in the challenge edit drawer.

### OpenAI

The OpenAI key powers every AI feature: contribution evaluation, meeting analysis and Slack signal detection. Connecting it from the UI replaces the `OPENAI_API_KEY` env var — all agents resolve the key at call time (`getOpenAIApiKey()`), so a key pasted in the UI takes effect without a restart.

- `POST /api/openai/connection` (admin-only) — takes an API key, verifies it live against OpenAI's `/v1/models`, then encrypts and stores it (`app_settings.openai_key_enc` / `openai_key_iv` / `openai_connected_at` / `openai_connected_by`).
- `DELETE /api/openai/connection` — disconnects, falling back to the `OPENAI_API_KEY` env var if set.
- `GET /api/openai/status` — public, returns whether an OpenAI key is connected (never the key).

---

## Modules: feature toggles

Two optional UI features can be turned off instance-wide from the **Modules** tab, without touching any code or env var:

| Toggle | Effect when off |
|--------|------------------|
| Meetings | The meetings sidebar is hidden from challenge pages for contributors and managers. |
| Onboarding | The onboarding drawer is hidden for all non-admin users. |

Turning a module off only hides the UI — onboarding progress keeps being tracked in the background either way, and admin pages are never affected by these flags.

- `GET /api/modules` — public, returns `{ meetings_enabled, onboarding_enabled }`.
- `PATCH /api/modules` — admin-only, updates either flag.

A related admin-only view, the **Onboarding** tab, lists every contributor's onboarding progress (5 quests) regardless of whether the module is enabled for others — backed by `GET /api/onboarding/all`. See [`onboarding.md`](./onboarding.md).

---

## Key files

| File | Purpose |
|------|---------|
| `packages/database-service/repositories/appSettings.repo.ts` | Singleton read/update for `app_settings` |
| `packages/config/githubToken.ts` | AES-256-GCM encrypt/decrypt + `getGithubToken()` (DB, falls back to `.env`) |
| `packages/config/kaggleCredentials.ts` | Same pattern for Kaggle credentials |
| `packages/config/slackCredentials.ts` | Same pattern for the Slack bot token |
| `packages/config/openaiCredentials.ts` | Same pattern for the OpenAI API key |
| `apps/leaderboard-client/src/lib/themes.ts` | Predefined theme palette definitions |
| `apps/leaderboard-client/src/app/api/admin/theme/route.ts` | Theme update endpoint |
| `apps/leaderboard-client/src/app/api/github-oauth/` | GitHub OAuth connect/disconnect/status routes |
| `apps/leaderboard-client/src/app/api/kaggle/` | Kaggle connect/disconnect/status routes |
| `apps/leaderboard-client/src/app/api/slack/` | Slack connect/disconnect/status/channels routes |
| `apps/leaderboard-client/src/app/api/openai/` | OpenAI connect/disconnect/status routes |
| `apps/leaderboard-client/src/app/api/modules/route.ts` | Module toggle read/update |
| `apps/leaderboard-client/src/app/api/onboarding/all/route.ts` | Admin view of all contributors' onboarding progress |

---

[README.md]
# MyTwin Leaderboard

An AI agent that tracks each contribution, evaluates work quality, and automatically distributes rewards to MyTwin Lab contributors — powering a community, competitive leaderboard.

## Getting Started (local development)

### Prerequisites

- Node.js **18+**
- PostgreSQL **14+**

### 1) Install dependencies

From the repo root:

```bash
npm install
```

### 2) Create a local PostgreSQL database

Create a DB and a user (names are up to you). Example:

```sql
CREATE USER leaderboard_user WITH PASSWORD 'leaderboard_password';
CREATE DATABASE mytwin_leaderboard OWNER leaderboard_user;
```

Make sure PostgreSQL is running.

### 3) Create environment files

This repo runs commands from **two working directories**:

- Repo root (Drizzle, seed script)
- `apps/leaderboard-client` (Next.js dev server)

Create a root `.env` file:

```env
# Required
DATABASE_URL=postgresql://leaderboard_user:leaderboard_password@localhost:5432/mytwin_leaderboard
JWT_SECRET=replace-with-a-32+char-secret-at-least

# Required — Google OAuth (used for login, see docs/google-setup.md)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google-auth/callback

# Optional (only needed for connectors / evaluator / API usage)
OPENAI_API_KEY=
GITHUB_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_REDIRECT_URI=
GOOGLE_FOLDER_ID=

# Optional — only needed for ML challenges (Kaggle), see docs/admin-settings.md
KAGGLE_USERNAME=
KAGGLE_KEY=
```

See [`docs/getting-started.md`](./docs/getting-started.md) for the full list of optional env vars (GitHub OAuth connection, sync meetings, observability).

Then copy it for the Next.js app:

```bash
cp .env apps/leaderboard-client/.env.local
```

On Windows (PowerShell):

```powershell
Copy-Item .env apps/leaderboard-client/.env.local
```

### 4) Initialize DB schema (Drizzle) + install app deps

Run the init script for your OS (from repo root):

For Macos and Linux:

```bash
npm run init:macos
```

For Windows:

```bash
npm run init:windows
```

If you prefer manual steps, the essential commands are:

```bash
npm run db:push
```

### 5) Reset + seed the database with initial data

This will delete existing rows and re-insert the JSON data from `db_data/*.json`:

```bash
npm run populate-db
```

### 6) Start the app

```bash
npm run dev
```

The app is a Next.js project in `apps/leaderboard-client`.

## Deployment (production)

This repo includes production scripts to build and run the Next.js app using **PM2**.

### Prerequisites

- A `.env` file at the **repo root** (same one used by Drizzle/seed)
- PM2 is installed **globally on the VPS** (commands use `pm2`)
- `NEXT_PUBLIC_APP_URL` set to the public URL of the app (e.g. `https://your-app.osc-fr1.scalingo.io`). Required so that post-login redirects go to the correct host instead of the container's internal address.

### Two production run modes (recommended)

This repo contains optional “backend integrations” (evaluator via OpenAI + connectors via GitHub/Google Drive).
They are executed **inside the Next.js server runtime** (API routes / server code), not as separate daemons.

So in production you can choose between:

- **Full prod**: everything enabled → requires real API keys in `.env`
- **Minimal prod**: client + DB only → does **not** require API keys (the script sets placeholders so `next build` won’t crash)

### Build + run with PM2

From the repo root:

```bash
npm run prod:full
```

Minimal mode (useful when you only need the UI + DB access):

```bash
npm run prod:min
```

Defaults:

- **Port**: `3014` (override with `PORT=xxxx npm run prod`)
- **App name (PM2)**: `leaderboard-client`

### Useful PM2 commands

```bash
npm run prod:status
npm run prod:logs
npm run prod:restart
npm run prod:stop
npm run prod:delete
```

### Nginx reverse-proxy (example)

Point your subdomain (e.g. `lab.my-twin.io`) to the VPS, then proxy to the local Next.js server:

```nginx
server {
  server_name lab.my-twin.io;

  location / {
    proxy_pass http://127.0.0.1:3014;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## GitHub OAuth Connection (admin)

Admins can connect a GitHub organization account directly from the UI — replacing the static `GITHUB_TOKEN` in `.env` with an encrypted token stored in the database. This enables repository operations (branches, commits, PRs) without touching server config.

### Setup

**1. Register a GitHub OAuth App**

Go to [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**.

| Field | Value |
|-------|-------|
| Homepage URL | `http://localhost:3000` (or your production URL) |
| Authorization callback URL | `http://localhost:3000/api/github-oauth/callback` |

Copy the **Client ID** and generate a **Client Secret**.

**2. Generate an encryption key**

```bash
openssl rand -hex 32
```

**3. Add to `.env`**

```env
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/github-oauth/callback
GITHUB_TOKEN_ENCRYPTION_KEY=<output of openssl rand -hex 32>
```

Copy to `apps/leaderboard-client/.env.local` as well.

**4. Connect via the UI**

Log in as an admin → `/contributors/me` → **Appearance** tab → **Connect GitHub Account**.

GitHub will ask you to authorize the app. The account must be an **owner or admin of a GitHub organization** — personal accounts without an org are rejected with a clear error message.

### How it works

- The OAuth token is encrypted with **AES-256-GCM** before being stored in the `app_settings` table. The encryption key never enters the database.
- All connectors (`ConnectorRegistry`) automatically use the database token when available, falling back to `GITHUB_TOKEN` in `.env` if not connected.
- Admins can disconnect at any time from the same Appearance tab; connectors immediately revert to the `.env` fallback.
- The token is never returned raw in any API response.

Kaggle accounts (used for ML challenges) can be connected the same way, from the same Appearance tab. See [`docs/admin-settings.md`](./docs/admin-settings.md) for both, and [`docs/github-setup.md`](./docs/github-setup.md) for registering the GitHub OAuth App itself.

## Troubleshooting

- **“Invalid environment configuration: JWT_SECRET …”**: set `JWT_SECRET` to **32+ characters** (see `packages/config/index.ts`).
- **Drizzle / seed can’t connect**: check `DATABASE_URL`, that Postgres is running, and the DB/user exist.
- **App starts but API calls fail**: ensure you copied `.env` to `apps/leaderboard-client/.env.local` so Next.js can read it.
- **`next build` fails with “Missing credentials … OPENAI_API_KEY”**: use `npm run prod:min` (or set `OPENAI_API_KEY` in `.env`).

## More documentation

See `docs/index.md` for architecture, packages, database, auth, workflow, and testing notes.

Le champ "usedExcerpts" de l'outil est obligatoire : renseigne-le toujours avec les passages copiés mot pour mot que tu as effectivement utilisés (jamais une reformulation), même un seul suffit s'il n'y en a qu'un.
Plateforme cible : tiktok. TikTok : format vertical court (15-60 secondes), rythme rapide, hook visuel fort dans les 3 premières secondes, ton spontané et brut, hashtags larges + niche.
Catégorie de contenu visée : Coulisses. Partager les processus de création, les outils, les sprints et les anecdotes de l’équipe MarvelousDev pour humaniser la marque.
Série récurrente à respecter (identité et angle de la série — directive forte) : Coulisses du Vendredi — Le vendredi, on partage un aperçu de nos sprints : outils du jour, anecdotes d’équipe, décisions clés et leçons apprises, le tout dans un ton convivial et transparent.
Angle à adopter pour ce script (structure/format de hook à respecter) : Défi ludique — Lancez un challenge lié au produit ou à la technologie, présentez les règles, montrez les premières tentatives et révélez le résultat final pour engager le spectateur dès le départ.
Type de contenu : video. Format vidéo : pense l'accroche (visuel, texte à l'écran et audio séparément) et un découpage en plans filmables avec le matériel disponible.
Génère le contenu via l'outil fourni, en respectant strictement son format.
```

## Sortie brute générée (OpenAI)

```json
{
  "contentType": "video",
  "title": "Coulisses du Vendredi — Le défi ML de MyTwin Leaderboard",
  "caption": "Coulisses du Vendredi chez MarvelousDev 🎬 Aujourd’hui, je lance un défi autour de MyTwin Leaderboard : reprendre contact avec les contributeurs qui font du ML pour les inviter à se lancer sur deux challenges ouverts — mammography classification et mammography segmentation. Tu commencerais par lequel ?",
  "hashtags": [
    "#TikTokTech",
    "#Coulisses",
    "#BuildInPublic",
    "#MachineLearning",
    "#ML",
    "#AI",
    "#DataScience",
    "#Mammography",
    "#MarvelousDev",
    "#MyTwinLeaderboard"
  ],
  "usedExcerpts": [
    "J'ai commencé à reprendre le contact avec certains des 60 contributeurs de lab : ceux qui font du ML afin de les lancer sur les 2 challenges ouverts : mammography classification et mammography segmentation"
  ],
  "hookVisual": "Face caméra, je pose deux cartes ou feuilles devant l’objectif : « classification » et « segmentation », puis je lance un chronomètre sur mon téléphone.",
  "hookText": "Défi du vendredi : qui va se lancer sur les 2 challenges ML ?",
  "hookAudio": "« Aujourd’hui, je me lance un défi : relancer les contributeurs ML autour de deux challenges ouverts. »",
  "storyboard": [
    {
      "planNumber": 1,
      "description": "Plan vertical très serré sur les deux feuilles « mammography classification » et « mammography segmentation ». J’ajoute un chronomètre à l’écran pour créer l’urgence."
    },
    {
      "planNumber": 2,
      "description": "Face caméra, ton spontané : « Les règles sont simples : je reprends contact avec certains contributeurs de nos 60 contributeurs de lab, en priorité ceux qui font du ML. »"
    },
    {
      "planNumber": 3,
      "description": "Capture d’écran ou plan de mon ordinateur pendant que je prépare les messages de prise de contact. Flouter les noms et informations privées si nécessaire."
    },
    {
      "planNumber": 4,
      "description": "Je montre successivement les deux challenges ouverts à l’écran : « mammography classification » puis « mammography segmentation », avec une transition rapide entre les deux."
    },
    {
      "planNumber": 5,
      "description": "Montage de mes premières tentatives : je rédige un message, je relis la liste des contributeurs ML, puis je reviens sur les deux challenges. Ajouter des sons de clics ou de notification."
    },
    {
      "planNumber": 6,
      "description": "Retour face caméra pour le résultat final : « Le vrai résultat du jour, c’est que la relance est lancée. Maintenant, j’attends de voir qui va relever le défi. »"
    },
    {
      "planNumber": 7,
      "description": "Conclusion avec les deux intitulés affichés côte à côte. Je dis : « Et toi, tu commencerais par la classification ou la segmentation ? Dis-le-moi en commentaire. »"
    }
  ],
  "soundRecommendation": "Utiliser un audio TikTok dynamique et rythmé, avec un volume bas sous la voix. Ajouter un effet de compte à rebours ou de chronomètre au début, puis des sons de clics pendant les plans d’écran."
}
```
