# PRD: ProductHive

> **Status:** DRAFT v1.0 — Rebuild specification
> **Date:** 2026-08-12
> **Purpose:** Specification for rebuilding ProductHive as a standalone product in a clean repository, carrying forward the proven assets from the `Verno/website/producthive-main` prototype.

---

## 0. HOW TO USE THIS DOCUMENT

This PRD is written for a **rebuild**, not a greenfield project. A working prototype exists (~7,000 LOC) and roughly 40% of it is worth keeping verbatim. Section 20 ("Carry-Over Inventory") lists exactly which files to copy and which to leave behind.

**Assumptions are flagged inline with `[ASSUMPTION]`.** Every one of them is a decision the author should confirm before Sprint 1.

---

## 1. EXECUTIVE SUMMARY

**Product vision.** ProductHive turns a one-sentence product idea into a production-grade Product Requirements Document and a running application, by simulating a full software team — eight specialist AI agents that debate the idea, converge on a spec, and then build it in a live browser sandbox.

**Problem being solved.** Getting from "I have an idea" to "I have a spec an engineer can build from" takes a product team days to weeks. Single-shot LLM prompting produces PRDs that are generic, internally inconsistent, and silent on the things that actually sink projects — pricing, threat models, compliance, and acceptance criteria. Nobody argues with a single LLM.

**Proposed solution.** A multi-agent debate engine. Eight agents with genuinely opposed incentives (an analyst who wants revenue, a security engineer who wants to block features, a QA engineer who rejects vague criteria) argue across two rounds. A Product Manager agent resolves the disagreements into a consensus, and the consensus — not the original prompt — is what the PRD is generated from. A second pipeline takes that spec and generates a running React application with a self-healing build loop.

**Target market.** Solo founders, indie hackers, agencies scoping client work, and student/junior teams who need to produce credible specification documents. [ASSUMPTION] Initial wedge is the "credible PRD fast" use case rather than the codegen use case, because codegen is a red ocean (Lovable, Bolt, v0) while structured multi-agent PRD generation is not.

**KPIs for v1.**

| KPI | Baseline | Target (6 months post-launch) | Measurement |
|---|---|---|---|
| Signup → first completed PRD | — | ≥ 60% | Funnel event on `job.status = completed` |
| PRD run completion rate (no error/timeout) | ~unmeasured, est. 70% | ≥ 95% | `completed / (completed + failed)` |
| Median PRD generation wall-clock time | ~4–6 min | ≤ 3 min | `job.completed_at − job.created_at` |
| Free → paid conversion | 0% (no billing) | ≥ 3% | Stripe subscription events |
| 7-day retention (returns and starts 2nd project) | — | ≥ 25% | Distinct users with ≥2 projects in 7d |

---

## 2. PROBLEM STATEMENT

**Current pain points.**

1. **Specification is the bottleneck, not code.** AI codegen has collapsed the cost of writing code but not the cost of deciding *what* to write. Teams now generate applications faster than they can specify them, and the resulting apps drift.
2. **Single-agent PRDs are agreeable and shallow.** One LLM asked to write a PRD will happily produce nineteen headings of plausible-sounding text with no internal tension. It will not tell you your pricing model is incoherent, because nothing in the prompt makes it adversarial.
3. **The expensive omissions are systematic.** Across LLM-generated specs, the reliably missing pieces are: concrete pricing with tier limits, threat models, compliance scope (and explicit *out*-of-scope statements), testable acceptance criteria, and honest risk registers. These are exactly the sections that cost the most to add later.

**Who is affected and how severely.** A solo founder or a 3-person student team without a product manager. For them the cost of a bad spec is not "a slow sprint" — it is building the wrong thing for a semester or a funding runway.

**Cost of the problem.** [ASSUMPTION] Estimated 3–10 working days of a product manager's time per initial product spec, or the equivalent in rework when the spec is skipped entirely.

**Why existing solutions fail.**

| Solution | Why it falls short |
|---|---|
| ChatGPT / Claude direct prompting | No structure enforcement, no adversarial pressure, no persistence, output quality varies per prompt skill |
| Notion / Confluence PRD templates | Structure without content — the blank page problem remains |
| Lovable, Bolt, v0 | Excellent at code, treat specification as a throwaway prompt |
| Linear, Jira | Track work after it's specified; do not help produce the spec |

**Differentiation.** ProductHive is the only one of these that makes the *disagreement* the product. The debate transcript is a deliverable in its own right — it shows the user *why* each decision was made, which is what makes the PRD defensible to a supervisor, a client, or an investor.

---

## 3. USER PERSONAS

### Persona 1 — Hamza, the Final-Year Student

- **Role / context:** CS undergraduate, 4-person FYP team, no PM, no industry experience.
- **Goals:** Produce a specification document his supervisor will accept as rigorous; avoid a mid-semester pivot.
- **Motivations:** Grade, portfolio, not looking unprepared at the defense.
- **Pain points:** Doesn't know what a real PRD contains; templates found online are either trivial or 80-page enterprise artifacts.
- **Technical proficiency:** High (writes code) / Low (product process).
- **Budget authority:** ~$0–15/month personal spend. Will use a free tier.
- **Key story:** *As a student team lead, I want a PRD that includes a threat model and a risk register, so that my supervisor sees the project has been thought through beyond the happy path.*

### Persona 2 — Ayesha, the Solo Founder

- **Role / context:** Non-technical or semi-technical founder, pre-seed, validating an idea.
- **Goals:** Turn a pitch into something a contract developer can quote against, and an investor can read.
- **Motivations:** Speed, credibility, not paying an agency $5k for a discovery phase.
- **Pain points:** Developers keep asking clarifying questions she hasn't thought about; each round trip costs days.
- **Technical proficiency:** Medium.
- **Budget authority:** Full, $50–200/month.
- **Key story:** *As a founder, I want to export a PRD as a PDF I can send to a contractor, so that I get an accurate fixed-price quote instead of hourly billing against an ambiguous scope.*

### Persona 3 — Bilal, the Agency Lead

- **Role / context:** Runs a 6-person dev shop, scopes 2–4 new client projects a month.
- **Goals:** Compress the unpaid discovery phase; produce consistent scoping documents across the team.
- **Motivations:** Margin. Unpaid scoping is pure cost.
- **Pain points:** Every scoping doc looks different depending on who wrote it; juniors miss compliance and security entirely.
- **Technical proficiency:** High.
- **Budget authority:** Full, $200–500/month, needs team seats.
- **Key story:** *As an agency lead, I want every scoping document to include the same nineteen sections regardless of who ran it, so that my proposals are consistent and I stop losing money on missed scope.*

---

## 4. GOALS, NON-GOALS & CONSTRAINTS

### Goals

| # | Goal | Measurable outcome |
|---|---|---|
| G1 | A PRD run always finishes or fails cleanly, never hangs | ≥ 95% terminal-state rate; zero runs stuck >15 min |
| G2 | A run survives tab close, refresh, and device change | 100% of in-flight jobs resumable from any session |
| G3 | Users can pay us | Stripe checkout live, quota enforced server-side |
| G4 | PRD content is grounded in the user's actual topic | 0 occurrences of off-topic domain leakage (see §18 R1) |
| G5 | Projects are shareable | Public read-only project URL |

### Non-Goals (v1)

| Non-goal | Why |
|---|---|
| Real-time multiplayer editing of the PRD | High complexity, no validated demand. Deferred to Phase 3. |
| Deploying generated apps to production hosting | Sandpack preview is sufficient for validation; hosting adds infra, abuse surface, and cost. |
| Supporting non-React codegen stacks | The prompt library, the validator, and the Sandpack preview are all React-specific. Widening this multiplies QA cost with no revenue signal. |
| Voice input | Present in the prototype via Web Speech API, Chrome-only, low usage. Cut from v1 core; may return as a nicety. |
| Jira integration | Prototype has UI fields but zero implementation. Do not ship a settings panel for a feature that does not exist. |
| A VSCode extension | Explicitly out of scope. This is the product being separated *from*. |

### Constraints

- **Technical:** Serverless function timeouts (Vercel: 60s hobby / 300s Pro) make in-request agent orchestration impossible. This constraint drives the entire architecture in §6.
- **Business:** [ASSUMPTION] Solo developer, part-time. Every architectural choice must favour operational simplicity over scale. Nothing that needs babysitting.
- **Cost:** LLM inference is the dominant variable cost. Free tier must be metered server-side or it is an unbounded liability.
- **Regulatory:** GDPR applies (user accounts, email, EU visitors). HIPAA does not — see §11.

---

## 5. BUSINESS STRATEGY

### Pricing model

| Tier | Price | PRD runs / mo | Codegen runs / mo | Models | Other |
|---|---|---|---|---|---|
| **Free** | $0 | 3 | 1 | Groq (Llama 3.3 70B) only | Public projects only, ProductHive branding on exports |
| **Pro** | $19/mo | 50 | 25 | All, incl. frontier models | Private projects, PDF/DOCX export, no branding |
| **Team** | $79/mo | 250 pooled | 100 pooled | All | 5 seats, shared project workspace |
| **BYO Key** | $0 | Unlimited | Unlimited | Any, user's own key | User supplies API key; we meter nothing and store nothing |

**Rationale.** The BYO-Key tier converts the prototype's current (and only) behaviour into a deliberate free-forever tier for technical users. It costs us nothing in inference, it keeps the power-user segment happy, and it removes the pressure to make the metered free tier generous.

**Free-tier abuse prevention.**
- Server-side quota enforcement in Postgres, checked before job enqueue — never client-side.
- 1 concurrent job per user, enforced by a unique partial index on `jobs(user_id) WHERE status IN ('queued','running')`.
- Email verification required before first run.
- Rate limit: 10 job-creation requests per hour per user, 30 per hour per IP.
- Free tier is hard-pinned to the cheapest provider. A free user can never trigger a frontier-model call on our key.

### Competitive landscape

| Competitor | Category | Their strength | Our differentiation |
|---|---|---|---|
| Lovable | AI app builder | Best-in-class codegen and polish | They prompt-to-app; we spec-to-app with a defensible document |
| Bolt.new | AI app builder | Full-stack, WebContainers, fast | No specification artifact at all |
| v0 by Vercel | UI generation | Component quality | Scope is components, not products |
| ChatPRD | AI PRD writing | Direct competitor, PM-focused | Single agent, no debate, no codegen path |
| Notion AI | Doc assistant | Distribution | Generic assistance inside a doc, no domain structure |

**Moat.** Three layers, in increasing durability: (1) the tuned prompt library — copyable but non-trivial to re-tune; (2) the debate transcript as an artifact — a UX and format bet competitors have not made; (3) accumulated PRD corpus enabling future fine-tuning and quality benchmarking. [ASSUMPTION] Layer 3 requires explicit user opt-in and is a Phase 3 concern.

### Go-to-market

| Phase | Dates | Goal | Channel |
|---|---|---|---|
| Alpha | Sep 2026 | 20 users, quality feedback on PRD output | Direct outreach, university cohort, FYP peers |
| Beta | Oct–Nov 2026 | 250 users, validate free→paid conversion | Product Hunt, r/SaaS, Indie Hackers, X build-in-public |
| GA | Dec 2026 | Billing live, 500 users | Content marketing: publish real PRDs as SEO artifacts |

**Path to revenue.** [ASSUMPTION] These figures are illustrative planning targets, not forecasts. At $19/mo Pro and a 3% conversion rate, 10,000 registered users yields ~$5.7k MRR. This is a realistic ceiling for a solo-operated product in year one and is *not* a path to $1M ARR without a team-tier motion or a step change in distribution. Stating this honestly now prevents building infrastructure for a scale that will not arrive.

---

## 6. TECHNICAL ARCHITECTURE

### The central architectural decision

The prototype runs all 18 sequential LLM calls of a debate **inside a single HTTP response**, streaming SSE as it goes. This is the root cause of its two worst failure modes: platform timeout kills long runs, and closing the tab destroys the work with no recovery.

**v1 inverts this.** Jobs are rows in Postgres. A long-lived worker process executes them. Progress is written to a `job_events` table and pushed to the browser by Supabase Realtime. The browser is a *subscriber*, never the owner of the computation.

This eliminates the timeout constraint entirely, makes runs resumable by construction, and gives us an audit trail for free.

```
Browser (Next.js, Vercel)
  │
  ├── POST /api/jobs ──────────► Next.js Route Handler
  │                                • authenticate (Supabase JWT)
  │                                • check quota + concurrency
  │                                • INSERT INTO jobs (status='queued')
  │                                • return { jobId }  ◄── returns in <200ms
  │
  └── subscribe ──────────────► Supabase Realtime
                                  ▲
                                  │ (postgres_changes on job_events)
                                  │
Worker (Node, Railway/Fly, always-on)
  • poll: SELECT ... FROM jobs WHERE status='queued'
          FOR UPDATE SKIP LOCKED LIMIT 1
  • run orchestrator (8 agents × 2 rounds → consensus → PRD → security pass)
  • INSERT INTO job_events after every agent turn
  • UPDATE jobs SET status='completed', result=...
       │
       └──► LLM providers (Groq / OpenAI / Google / Anthropic / …)
```

**Why `FOR UPDATE SKIP LOCKED` and not Redis/BullMQ.** The prototype's `package.json` already declares `bullmq` and `ioredis` for an architecture that was never built. A Postgres-backed queue removes an entire piece of infrastructure, and at the expected job volume (< 1,000/day) the performance difference is irrelevant. Add Redis when there is a measured reason to, not before.

### Tech stack

| Layer | Choice | Version | Justification |
|---|---|---|---|
| Framework | Next.js (App Router) | 15.x | Carried from prototype; RSC + route handlers |
| UI | React | 19.x | Carried |
| Styling | Tailwind CSS | 3.4.x | Carried; entire component library depends on it |
| Animation | framer-motion | 11.x | Carried; used throughout landing + workspace |
| Icons | lucide-react | 0.468+ | Carried |
| Auth / DB / Realtime | Supabase | latest | One dependency covers auth, Postgres, Realtime, storage |
| Worker runtime | Node | 20 LTS | Long-running process, no serverless timeout |
| Worker host | Railway or Fly.io | — | [ASSUMPTION] Railway for simplicity; ~$5/mo |
| Sandbox preview | @codesandbox/sandpack-react | 2.20+ | Carried; the self-healing loop is built on it |
| Billing | Stripe | — | Checkout + Customer Portal, no custom billing UI |
| Validation | zod | 3.x | Carried; already used for PRD schema validation |
| Web host | Vercel | — | Next.js native |

**Explicitly removed from the dependency tree:** `bullmq`, `ioredis`, `@langchain/core`, `@langchain/google-vertexai`, `@google-cloud/aiplatform`, `date-fns`, `tsx`. All present in the prototype's `package.json`; none are imported by any prototype source file.

**Environment strategy.** `dev` (local + Supabase local), `staging` (Vercel preview + separate Supabase project), `prod`. Worker deployed per-environment with its own queue scope.

**Observability.** [ASSUMPTION] Sentry for errors (free tier sufficient), Supabase built-in logs for DB, structured JSON logging from the worker with `job_id` on every line. Alert on: worker heartbeat missing > 2 min, `jobs` stuck in `running` > 15 min, error rate > 5% over 15 min.

**Backup & DR.** Supabase automated daily backups. **RPO:** 24h. **RTO:** 4h. Acceptable because no data is irreplaceable — a lost PRD can be regenerated.

---

## 7. API SPECIFICATION

All routes are Next.js Route Handlers under `/api`. Auth is a Supabase JWT in `Authorization: Bearer <token>`, except where noted.

| Method | Path | Auth | Rate limit | Description |
|---|---|---|---|---|
| `POST` | `/api/jobs` | Required | 10/hr/user | Create a PRD or codegen job; returns immediately |
| `GET` | `/api/jobs/:id` | Required (owner or public project) | 60/min | Job status + result |
| `GET` | `/api/jobs/:id/events` | Required | 60/min | Full event history — used to rehydrate a reconnecting client |
| `POST` | `/api/jobs/:id/cancel` | Required (owner) | 20/hr | Cancel a queued or running job |
| `GET` | `/api/projects` | Required | 60/min | List caller's projects |
| `GET` | `/api/projects/:id` | Optional if `visibility='public'` | 120/min | Project detail incl. PRD + files |
| `PATCH` | `/api/projects/:id` | Required (owner) | 60/min | Rename, change visibility |
| `DELETE` | `/api/projects/:id` | Required (owner) | 20/hr | Soft delete |
| `POST` | `/api/projects/:id/export` | Required | 10/hr | Export PRD as `pdf` \| `docx` \| `md` |
| `GET` | `/api/models` | Public | 120/min | Available models, filtered by caller's tier |
| `POST` | `/api/billing/checkout` | Required | 10/hr | Create Stripe Checkout session |
| `POST` | `/api/billing/webhook` | Stripe signature | — | Subscription lifecycle events |

### `POST /api/jobs`

**Request**
```json
{
  "kind": "prd" | "codegen" | "heal",
  "topic": "string, 10–2000 chars",
  "projectType": "Full Stack App | Mobile App | Landing Page | Dashboard | Portfolio",
  "mode": "debate" | "fast" | "plan",
  "modelId": "string, optional — must be permitted for caller's tier",
  "projectId": "uuid, optional — omit to create a new project",
  "byoKey": { "provider": "string", "apiKey": "string" }
}
```

**Response `202 Accepted`**
```json
{ "jobId": "uuid", "projectId": "uuid", "status": "queued", "queuePosition": 2 }
```

**`byoKey` handling is a hard security requirement.** When present it is held in memory for the duration of the request, passed to the worker through an encrypted single-use row (`job_secrets`, deleted on job completion), and **never** written to `jobs`, `job_events`, logs, or Sentry breadcrumbs. See §12.

### Error format

All errors return this shape:
```json
{ "error": { "code": "QUOTA_EXCEEDED", "message": "Human readable", "details": {} } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Authenticated but not the owner |
| `QUOTA_EXCEEDED` | 402 | Monthly run limit reached — response includes upgrade URL |
| `CONCURRENCY_LIMIT` | 409 | A job is already running for this user |
| `MODEL_NOT_PERMITTED` | 403 | Requested model is above the caller's tier |
| `VALIDATION_FAILED` | 400 | zod schema rejection; `details` carries field errors |
| `PROVIDER_ERROR` | 502 | Upstream LLM failed after all retries |
| `RATE_LIMITED` | 429 | Includes `Retry-After` header |

### Realtime channel

Client subscribes to `postgres_changes` on `job_events` filtered by `job_id`. Event payloads carry the same discriminated-union shape the prototype's SSE already uses (`agent-thinking`, `agent-response`, `consensus`, `phase`, `file-start`, `file-complete`, `prd-complete`, `codegen-complete`, `error`, `done`) — this is deliberate, so the existing chat components port with minimal change.

**Versioning.** URL-path versioning deferred; v1 is unversioned. Introduce `/api/v2` only on a breaking change.

---

## 8. DATA MODEL

```sql
-- Managed by Supabase Auth
-- auth.users (id uuid PK, email text, ...)

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  tier          text not null default 'free'
                  check (tier in ('free','pro','team','byo')),
  stripe_customer_id text unique,
  runs_used_this_period  int not null default 0,
  period_started_at      timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  name          text not null,
  topic         text not null,
  project_type  text not null,
  visibility    text not null default 'private'
                  check (visibility in ('private','public')),
  prd_markdown  text,
  prd_sections  jsonb,          -- PRDSection[] — title, content, complianceFlags
  files         jsonb,          -- GeneratedFile[] — path, content, language
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index projects_owner_idx on projects(owner_id) where deleted_at is null;
create index projects_public_idx on projects(visibility) where visibility = 'public';

create table jobs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  kind          text not null check (kind in ('prd','codegen','heal')),
  mode          text not null check (mode in ('debate','fast','plan')),
  model_id      text,
  provider      text,
  status        text not null default 'queued'
                  check (status in ('queued','running','completed','failed','cancelled')),
  progress      int not null default 0,
  error         text,
  result        jsonb,
  attempts      int not null default 0,
  locked_at     timestamptz,       -- worker lease; reclaim if older than 15 min
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz
);
create index jobs_queue_idx on jobs(status, created_at) where status = 'queued';
-- Enforces 1 concurrent job per user at the database level
create unique index jobs_one_active_per_user
  on jobs(user_id) where status in ('queued','running');

create table job_events (
  id            bigserial primary key,
  job_id        uuid not null references jobs(id) on delete cascade,
  seq           int not null,      -- monotonic per job; enables gap-free replay
  type          text not null,     -- 'agent-response' | 'phase' | 'file-complete' | ...
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);
create unique index job_events_job_seq_idx on job_events(job_id, seq);

-- Single-use encrypted BYO keys. Never joined into any user-facing query.
create table job_secrets (
  job_id        uuid primary key references jobs(id) on delete cascade,
  provider      text not null,
  api_key_enc   bytea not null,    -- pgsodium / vault encrypted
  created_at    timestamptz not null default now()
);
```

**Row Level Security is mandatory on every table.** Default deny. Owners read/write their own rows; anonymous users may read `projects` where `visibility = 'public' and deleted_at is null`. `job_secrets` has **no** RLS policy for the `authenticated` role at all — it is reachable only by the worker's service role.

**Data flow.** `POST /api/jobs` writes `projects` (if new) + `jobs` + optionally `job_secrets` in one transaction → worker claims the job under `SKIP LOCKED` → worker appends to `job_events` per agent turn → Realtime pushes each insert to the subscribed browser → worker writes final `projects.prd_markdown` and `jobs.result`, deletes `job_secrets`.

---

## 9. CORE FEATURES & FUNCTIONAL REQUIREMENTS

### F1 — Multi-Agent PRD Debate

Eight agents (Analyst, Architect, UX, Developer, PM, QA, Tech Writer, Security) argue over two rounds; a PM agent converges; a PRD is generated from the consensus; a compliance pass annotates it.

**Functional requirements**
- FR1.1 The system **SHALL** run each agent's turn as a discrete LLM call and persist the result to `job_events` before starting the next.
- FR1.2 The system **SHALL** build each agent's prompt from the topic, its role brief, and the last 6 messages of debate history.
- FR1.3 Agent role briefs **SHALL** be domain-neutral and **SHALL NOT** reference any product domain absent from the user's topic. *(This closes the prototype's most visible defect — see §18 R1.)*
- FR1.4 The PRD generation step **SHALL** validate its output against a zod schema and **SHALL** retry once with a correction prompt on failure.
- FR1.5 On second validation failure the system **SHALL** persist the consensus text as a single-section PRD and mark the job `completed` with a `degraded: true` flag, rather than failing outright.
- FR1.6 The system **SHALL** write a `job_events` row within 45 seconds of the previous one, or the job is considered stalled.

**Acceptance criteria**
- **Given** a topic of "a recipe sharing app for home cooks", **when** the debate completes, **then** no section of the PRD mentions security-scanning vendors, penetration testing, or vulnerability scanning as product features.
- **Given** a running job, **when** the user closes the tab and reopens the project 3 minutes later, **then** the UI displays every agent message emitted during the absence, in order, with no gaps.
- **Given** the LLM returns malformed JSON twice, **when** the PRD step completes, **then** the job status is `completed` with `degraded: true` and the user sees the consensus text.

**Edge cases:** provider 429 (fall back through the model chain, then fail with `PROVIDER_ERROR`); worker crash mid-run (lease expires after 15 min, job requeued, `attempts` incremented, hard-fail at 3); topic in a non-English language [ASSUMPTION] pass through unchanged, no special handling in v1.

### F2 — Fast Track & Plan Modes

Single-call alternatives to the full debate: `fast` produces the 19-section PRD directly; `plan` produces a 6-section architecture and sprint plan.

- FR2.1 Fast mode **SHALL** complete in a single LLM call and **SHALL** target ≤ 45s wall clock.
- FR2.2 Both modes **SHALL** reuse the same section spec and validation path as F1.

### F3 — Code Generation with Self-Healing Preview

Architecture planning → per-file generation → static validation → Sandpack live preview → runtime error capture → automated repair.

- FR3.1 The system **SHALL** generate files in dependency order (priority-sorted) and stream each completed file to the client.
- FR3.2 Before rendering, the system **SHALL** statically validate each generated file for: leftover markdown fences, unbalanced braces, barrel re-exports, apparent truncation, and imports of non-existent files.
- FR3.3 On a Sandpack runtime error the system **SHALL** attempt automated repair at most 3 times, then **SHALL** roll back to the last known-good snapshot.
- FR3.4 The system **SHALL** retain at most 5 snapshots per project.

**Acceptance criteria**
- **Given** a generated project that throws on render, **when** self-healing runs, **then** either the preview renders within 3 attempts or the UI shows "Reverted to last stable version" and a working preview.

### F4 — Accounts, Projects & Persistence

- FR4.1 All project state **SHALL** persist server-side. `localStorage` **SHALL NOT** be the system of record for anything. *(Direct replacement of the prototype's `producthive-files-${query}` scheme.)*
- FR4.2 A project **SHALL** be addressable by a stable URL that survives topic edits.
- FR4.3 Public projects **SHALL** be readable without authentication.

### F5 — Quota & Billing

- FR5.1 Quota **SHALL** be checked server-side before enqueue and **SHALL NOT** be inferable or bypassable from the client.
- FR5.2 The system **SHALL** reject a model request above the caller's tier with `MODEL_NOT_PERMITTED`.
- FR5.3 `runs_used_this_period` **SHALL** reset on the Stripe billing period boundary, or monthly from `period_started_at` for free users.

### F6 — Export

- FR6.1 The system **SHALL** export a PRD as Markdown, PDF, and DOCX.
- FR6.2 Free-tier exports **SHALL** carry a ProductHive footer.

---

## 10. UX & DESIGN REQUIREMENTS

### Key screens

| Screen | Purpose | Carried from prototype? |
|---|---|---|
| Landing | Hero, honeycomb background, main input | Yes — near-verbatim |
| Main input | Topic, project type tabs, mode picker, model picker, settings | Yes — minus Jira fields, plus auth state |
| Workspace (PRD) | Left: debate transcript. Right: live PRD viewer | Yes |
| Workspace (Dev) | Left: dev chat. Right: file tree / editor / Sandpack preview | Yes |
| Dashboard | Project list, status, quota meter | **New** |
| Auth | Sign in / sign up | **New** |
| Pricing | Tier comparison, Stripe checkout | Partly — UI exists, checkout is new |
| Public project | Read-only shared PRD | **New** |

### Core user flow

```
Landing → type topic → pick type + mode → Submit
   → [if unauthenticated] sign-in modal, topic preserved
   → POST /api/jobs → redirect to /p/{projectId}
   → workspace subscribes to Realtime, renders agent turns as they land
   → PRD complete → viewer populated → export / share / continue to Develop
```

**The topic must survive the auth interruption.** Losing a typed prompt at the sign-in wall is the single most costly UX failure in this funnel.

### The five states

Every panel specifies all five: **Default** (empty prompt), **Loading** (agent-by-agent skeleton, never a full-screen spinner — the streaming *is* the value), **Empty** (no projects → guided first-run), **Error** (inline, with the actual provider message and a retry), **Mobile** (< 768px: panels become tabs, not a squeezed split view).

**Accessibility:** WCAG 2.1 AA. Specifically — the workspace's dark palette (`#0E0E10` / `#18181B` / white at 30–50% opacity) fails contrast in several places in the prototype and must be re-checked; all `text-white/30` usage needs auditing. Agent identity must not be conveyed by colour alone — always pair with the agent's name.

**Localization:** English only in v1. Copy externalized to a single module so that adding locales later is not a refactor. No RTL support in v1.

**Responsive breakpoints:** 640 / 768 / 1024 / 1280.

**Design system.** Carry the prototype's Tailwind theme and honeycomb/amber identity (`#DD830A` → `#F59E0B`). [ASSUMPTION] Adopt shadcn/ui for primitives (dialog, dropdown, toast) rather than the prototype's hand-rolled popovers, which currently reimplement outside-click handling per component.

---

## 11. DATA HANDLING & PRIVACY

### Data classification

| Class | Examples | Handling |
|---|---|---|
| Public | Public projects, PRD content marked public | CDN-cacheable |
| Internal | Job events, debate transcripts | Owner-only via RLS |
| Confidential | Email, Stripe customer ID | Encrypted at rest, never logged |
| Restricted | BYO API keys | Encrypted, single-use, never logged, deleted on job completion |

**Encryption.** AES-256 at rest (Supabase default). TLS 1.3 minimum in transit. BYO keys additionally encrypted at the column level via pgsodium.

**Retention.**

| Data | Retention |
|---|---|
| Projects & PRDs | Until user deletion; soft-deleted rows purged after 30 days |
| Job events | 90 days, then pruned |
| BYO API keys | Duration of one job, then hard-deleted |
| Auth logs | 90 days (Supabase default) |

### GDPR implementation checklist

- [ ] Lawful basis documented: contract (service delivery) + consent (marketing email only)
- [ ] Consent recorded with timestamp and policy version at signup
- [ ] Right of access — self-serve JSON export of all user data
- [ ] Right to erasure — account deletion cascades via `on delete cascade`, completes within 30 days
- [ ] Right to portability — PRD export in Markdown covers the substantive content
- [ ] DPA in place with Supabase, Vercel, Stripe, and each LLM provider used on our key
- [ ] Privacy policy names every subprocessor
- [ ] DPIA — [ASSUMPTION] not required; no large-scale special-category processing, no automated decisions with legal effect. Revisit if this changes.
- [ ] Cookie banner — required only if analytics beyond strictly-necessary are added. Prefer a cookieless analytics provider and avoid the banner entirely.

**HIPAA: explicitly out of scope. No PHI is collected, processed, transmitted, or stored. HIPAA is not applicable.** Stated explicitly to prevent the compliance-flagging pass from generating false positives on innocuous words such as "health" in a user's topic — a live defect in the prototype (§18 R2).

**SOC 2 / PCI-DSS.** SOC 2 not pursued in v1. PCI-DSS scope avoided entirely by delegating all card handling to Stripe Checkout; no card data ever reaches our infrastructure.

**Data residency.** [ASSUMPTION] Single region (EU or US — pick one and state it in the privacy policy). No multi-region guarantees in v1.

---

## 12. SECURITY & THREAT MODEL

### STRIDE enumeration

| Component | Threat | Mitigation |
|---|---|---|
| Auth | **S**poofing — session theft | Supabase JWT, httpOnly cookies, short-lived access tokens with refresh rotation |
| Job API | **T**ampering — client forges quota or tier | All quota/tier checks server-side against `profiles`; client value never trusted |
| Job API | **R**epudiation — disputed usage | `jobs` rows are the immutable usage ledger; billing reconciles against them |
| BYO keys | **I**nformation disclosure — key leaks to logs or another user | Column-encrypted, single-use, no RLS grant to `authenticated`, explicit Sentry scrubbing rule, deleted on completion |
| Worker | **D**enial of service — job flooding | Per-user concurrency of 1 via DB unique index; per-IP and per-user rate limits; hard tier quotas |
| PRD viewer | **E**levation / stored XSS — LLM output rendered as HTML | Render Markdown through a sanitizing pipeline with an allowlist. **Never** `dangerouslySetInnerHTML` on model output. |
| Sandpack preview | Generated code executes in the user's browser | Sandpack's sandboxed iframe; no access to parent origin, no credentials forwarded |
| Public projects | Unintended exposure | `visibility` defaults to `private`; the share action requires an explicit confirmation |

**Prompt injection.** A user's topic flows into eight agent prompts. It cannot reach our infrastructure — there is no tool use and no code execution on our side — but it *can* steer output. Accepted risk for v1; the blast radius is the user's own document. Mitigation deferred: strip instruction-like patterns from the topic before interpolation.

**Auth & authorization model.**

| Role | Permissions |
|---|---|
| `anon` | Read public projects only |
| `authenticated` | Full CRUD on own rows via RLS |
| `service_role` (worker only) | Full access; key never leaves the worker environment |

**Secret management.** All provider keys in the worker's environment (Railway/Fly secrets), never in the Next.js client bundle, never in `NEXT_PUBLIC_*`. A pre-commit secret scan is mandatory. Note: the prototype's `.env` is correctly gitignored and untracked — preserve this.

**Vulnerability disclosure.** `security.txt` at the domain root with a contact address; 90-day coordinated disclosure window.

**Penetration testing.** [ASSUMPTION] No paid pentest in v1. Before GA, run an authenticated OWASP ZAP baseline scan and manually verify every RLS policy with a second test account — the highest-value check for a Supabase application, since a missing RLS policy is a total data breach.

---

## 13. BILLING & SUBSCRIPTION MANAGEMENT

**Provider:** Stripe. Checkout for acquisition, Customer Portal for all self-service management. No custom billing UI is built.

**Lifecycle**

| Event | Handling |
|---|---|
| Create | Checkout session → `checkout.session.completed` webhook → set `profiles.tier`, `stripe_customer_id` |
| Upgrade | Stripe prorates automatically; tier applied on `customer.subscription.updated` |
| Downgrade | Takes effect at period end; tier changes on the same webhook |
| Cancel | Access retained until `current_period_end`; then tier → `free` |
| Payment failure | Stripe Smart Retries; on `invoice.payment_failed` show an in-app banner; on final failure tier → `free`, projects retained read-only |

**Quota reset** is driven by `invoice.paid` for subscribers (aligning quota to the true billing period) and by a nightly job comparing `period_started_at` for free users.

**Webhook integrity:** signature verification is mandatory; handlers must be idempotent, keyed on Stripe event ID, because Stripe retries.

**Invoices** are served entirely by the Stripe Customer Portal. We store no invoice data.

---

## 14. SUCCESS METRICS & ACCEPTANCE CRITERIA

### KPIs

| KPI | Baseline | Target | Method |
|---|---|---|---|
| API p95 response (non-job routes) | unmeasured | < 200 ms | Vercel Analytics |
| `POST /api/jobs` p95 | ~4–6 min (blocking, prototype) | < 500 ms | Route instrumentation |
| PRD debate wall-clock, p50 | ~4–6 min | ≤ 3 min | `completed_at − created_at` |
| Job success rate | est. 70% | ≥ 95% | Status aggregation |
| Client error rate (5xx) | unmeasured | < 1% | Sentry |
| Realtime event delivery loss | n/a | 0 gaps in `seq` | Client-side sequence check |

**Critical distinction, carried forward from the prototype's own QA rules:** UI/API latency (< 200 ms p95) is a *separate* target from job execution duration (minutes). The architecture in §6 exists specifically so these two numbers are no longer coupled.

### Definition of done for MVP

1. A signed-in user runs a debate, closes the tab, returns from a different device, and sees the completed PRD.
2. A free user is blocked at their 4th run of the month by a server-side check, and sees an upgrade path.
3. A user pays via Stripe and their tier updates without manual intervention.
4. A generated app renders in Sandpack, and an induced runtime error self-heals or cleanly rolls back.
5. A PRD for a non-technical topic contains zero references to security-scanning vendors.
6. RLS verified: account B cannot read account A's private project by direct ID.

**Load testing.** [ASSUMPTION] Target 50 concurrent users, 20 concurrent jobs, before GA. Verify the worker's job-claim query does not degrade and that Realtime fan-out holds. This is a modest target chosen to match realistic early traffic; revisit at 1,000 users.

---

## 15. ROADMAP & RELEASE PLAN

| Phase | Window | Scope | Owner | Dependencies | Launch criteria |
|---|---|---|---|---|---|
| **P0 — Foundation** | Aug 2026, wks 1–2 | New repo. Next.js 15 scaffold. Port landing, workspace shells, and the prompt library from the prototype (§20). Purge phantom dependencies. Extract the triplicated `callLLM` into `lib/llm/`. De-hardcode the agent role briefs. | Solo | None | `tsc --noEmit` clean; landing renders; a debate runs end-to-end against Groq, in-request, as a smoke test |
| **P1 — MVP** | Sep 2026, wks 3–6 | Supabase auth + schema + RLS. Worker process with the Postgres queue. Realtime event streaming. Rewire both workspaces to subscribe rather than own the stream. Dashboard. Project persistence replacing localStorage. | Solo | P0 | DoD items 1 and 6 pass. **This is the Alpha gate.** |
| **P2 — Commercial** | Oct–Nov 2026, wks 7–12 | Stripe Checkout + Portal + webhooks. Server-side quota and tier gating. Export (MD/PDF/DOCX). Public project sharing. Sentry + alerting. Markdown sanitization. Accessibility audit. | Solo | P1 | DoD items 2, 3, 5 pass. **Beta gate.** |
| **P3 — Depth** | Dec 2026 → | Team seats. PRD editing and regeneration of a single section. GitHub push for generated code. Debate transcript as a shareable artifact. Model quality benchmarking. | Solo | P2 | GA |

**Known blockers.** P1 depends on choosing and provisioning a worker host — do this in week 1, not week 3, because a Railway/Fly deployment loop is the kind of thing that eats an unexpected two days. P2 depends on a Stripe account with tax configuration, which has a real-world verification lead time.

---

## 16. SLA, SUPPORT & OPERATIONS

**Uptime target:** 99.5% monthly for the web app, measured by external HTTP checks at 1-minute intervals. Deliberately *not* 99.9% — a solo-operated product should not promise what it cannot staff.

| Severity | Definition | Response (Free) | Response (Pro/Team) |
|---|---|---|---|
| P0 | Site down, or data loss | Best effort | 4h |
| P1 | Jobs failing globally, billing broken | Best effort | 8h |
| P2 | Feature degraded, workaround exists | Best effort | 2 business days |
| P3 | Cosmetic, question | Community | 5 business days |

**Support channels:** Free — GitHub Discussions. Pro/Team — email.

**On-call:** none. Alerting routes to a phone push notification; response is best-effort outside working hours and the SLA table reflects this honestly.

**Runbooks required before GA:** worker down; jobs stuck in `running`; provider outage (how to force-switch the default model); Stripe webhook backlog; restore from Supabase backup.

---

## 17. TEST PLAN & QA STRATEGY

| Type | Scope | Coverage target | Tool |
|---|---|---|---|
| Unit | Prompt builders, PRD parsing/validation, patch application, quota arithmetic | ≥ 80% on `lib/` | Vitest |
| Integration | Route handlers against a local Supabase, incl. every RLS policy | 100% of routes; 100% of RLS policies | Vitest + Supabase local |
| E2E | Signup → debate → PRD → export; codegen → self-heal | 5 critical paths | Playwright |
| LLM output | Golden-topic suite: 10 diverse topics asserted for section completeness and domain-leak absence | 10 topics, run pre-release | Custom harness |
| Load | 50 concurrent users / 20 concurrent jobs | Pass before GA | k6 |
| Security | RLS verification with a second account; ZAP baseline | Pass before GA | Manual + ZAP |

**The golden-topic suite is the highest-leverage test in this table.** Prompt regressions are invisible to type checking and unit tests, and prompt changes are the change type most likely to break quality. Ten fixed topics — one deliberately non-technical (a recipe app), one health-adjacent (to verify the HIPAA false-positive fix), one security-domain (to verify legitimate security content still works) — asserted after every prompt edit.

**Test environments.** Local Supabase for integration; a dedicated staging Supabase project for E2E; never against production.

**Regression approach.** Every fixed defect from §18 gets a test before the fix is merged.

---

## 18. RISKS & MITIGATIONS

### Inherited defects (confirmed present in the prototype — must not be carried forward)

| ID | Defect | Evidence | Fix |
|---|---|---|---|
| **R1** | Agent role briefs hardcode a security-scanner domain (Snyk, Burp Suite, ZAP, "scan bombing", domain-ownership verification), leaking into unrelated PRDs | `app/api/debate/route.ts` — `AGENT_SPECIFICS` | Rewrite briefs domain-neutrally; add golden-topic test |
| **R2** | Compliance pass keyword-matches on words like "health" and "email", producing spurious GDPR/HIPAA flags | `app/api/debate/route.ts` — `applySecurityPass` | Replace substring matching with an LLM-judged relevance pass, or scope keywords to declared data types |
| **R3** | `POST /api/prd/start` is called on every landing-page submit; the route does not exist and the 404 is silently swallowed | `components/landing/MainInput.tsx` | Superseded by `POST /api/jobs` |
| **R4** | `useJobStream` targets `/api/jobs/:id/stream`, which does not exist — entire hook is dead | `lib/hooks/useJobStream.ts` | Delete; replaced by Realtime subscription |
| **R5** | UI states "Keys are stored in your browser only and never sent to our servers" — keys are POSTed to our own routes on every request | `components/landing/MainInput.tsx` | Correct the copy to describe actual handling per §11, or move to a true client-direct call |
| **R6** | Rules-of-Hooks violation: conditional `return` precedes `useState` | `components/workspace/WorkspaceLayout.tsx` | Split into two routed components |
| **R7** | `callLLM` (~120 lines) triplicated across the debate, codegen, and heal routes; provider list duplicated in four places | 3 route files + 2 components | Single `lib/llm/client.ts`, single `lib/llm/providers.ts` |
| **R8** | The 19-section PRD spec (~2,000 words) is copy-pasted twice within one file | `app/api/debate/route.ts` | Single exported constant |
| **R9** | `package.json` declares bullmq, ioredis, langchain, vertexai, octokit — none imported anywhere | `package.json` | Purge |
| **R10** | Model catalogue contains truncated/invalid IDs (`meta-llama/llama-4-scout-17b-16e-i...`) and a hardcoded, now-dated Anthropic model | `app/api/models/route.ts`, all three routes | Rebuild catalogue; verify every ID against provider docs at build time |

### Forward risks

| Risk | P | I | Owner | Mitigation | Contingency |
|---|---|---|---|---|---|
| Scope creep — rebuilding everything at once instead of shipping P1 | **H** | **H** | Author | Phase gates in §15 are hard gates; P1 ships without billing | Cut P2 scope to Stripe-only |
| LLM cost overrun on the metered free tier | M | H | Author | Free tier pinned to cheapest provider; hard server-side quotas; daily spend alert | Reduce free tier to 1 run; push users to BYO-Key |
| Provider API instability or deprecation | M | M | Author | Provider abstraction in `lib/llm/`; multi-provider fallback chain already proven in the prototype | Switch default provider via env var, no deploy |
| Worker host becomes a single point of failure | M | H | Author | Job lease expiry auto-requeues; health-check alerting | Jobs queue harmlessly in Postgres until the worker returns — no data loss |
| Missing RLS policy exposes user data | L | **H** | Author | RLS default-deny; 100% policy test coverage; second-account manual verification | Immediate policy patch; breach notification within 72h per GDPR Art. 33 |
| Solo-developer bus factor / FYP timeline collision | **H** | M | Author | Phases sized for part-time work; nothing in P0/P1 requires more than one person | Ship P1 as the FYP deliverable; P2+ post-submission |
| Commoditization — a major player ships multi-agent PRD generation | M | H | Author | Move fast on the debate-transcript artifact, which is the least copyable part | Reposition toward the agency/team segment |

---

## 19. OPEN QUESTIONS & DECISIONS LOG

### Open questions

| # | Question | Owner | Due |
|---|---|---|---|
| Q1 | Is ProductHive a separate product from Verno, or its web front end? Affects branding, repo, and whether the extension survives. | Author | Before P0 |
| Q2 | Railway vs. Fly.io vs. a Render background worker? | Author | P0 week 1 |
| Q3 | Data residency — EU or US? Must be fixed before the privacy policy is written. | Author | Before P2 |
| Q4 | Is $19 the right Pro price, or is $29 better given inference cost? Needs a cost-per-run measurement first. | Author | Before P2 |
| Q5 | Should the debate transcript be public by default on shared projects? It is the most distinctive artifact, but it exposes prompt engineering. | Author | Before P3 |

### Decisions made

| Decision | Rationale |
|---|---|
| Rebuild in a new repository rather than refactoring in place | The prototype is buried two levels deep inside a VSCode extension repo it no longer relates to. Extraction cost is low; the coupling cost is ongoing. |
| Postgres-backed queue, not Redis/BullMQ | One less service. At < 1,000 jobs/day the performance difference is irrelevant, and `FOR UPDATE SKIP LOCKED` is a well-trodden pattern. |
| Realtime subscription, not SSE-in-request | Removes the serverless timeout ceiling and makes resumability structural rather than bolted on. This is the single highest-value change in this document. |
| Server-side keys with metered quotas, plus a BYO-Key tier | Enables billing while keeping the existing behaviour available to technical users at zero inference cost. |
| Keep the prompt library nearly verbatim | It is the most valuable and least reproducible asset in the prototype. Change it deliberately, with the golden-topic suite as a guard. |
| React-only codegen | The validator, the repair loop, and the Sandpack preview are all React-shaped. Widening this multiplies QA surface with no revenue signal. |
| HIPAA explicitly out of scope | Prevents compliance bloat and the false-positive flagging observed in the prototype. |

---

## 20. CARRY-OVER INVENTORY

The point of this rebuild is to keep what works. Source paths are relative to `website/producthive-main/producthive-main/`.

### Copy nearly verbatim — the high-value assets

| Source | Destination | Notes |
|---|---|---|
| `app/api/debate/route.ts` → prompt builders + `AGENT_SPECIFICS` + `DEBATE_AGENTS` | `lib/prompts/debate.ts` | **The crown jewels.** Fix R1 (de-hardcode domain), dedupe R8. |
| `app/api/codegen/route.ts` → `buildArchitectPrompt`, `buildCodegenPrompt`, `buildEditPrompt` | `lib/prompts/codegen.ts` | Keep the "critical rules" block — it encodes hard-won bundler lessons |
| `app/api/codegen/route.ts` → `selectRelevantContext`, `extractFileSkeleton`, `buildProjectSkeleton` | `lib/codegen/context.ts` | Genuinely good selective-context implementation; keep as is |
| `app/api/codegen/route.ts` → `applyPatch` | `lib/codegen/patch.ts` | Whitespace-normalized fallback matching is subtle and works |
| `app/api/codegen/route.ts` → validation block (fences, braces, barrel exports, truncation, missing imports) | `lib/codegen/validate.ts` | Extract from the inline loop |
| `components/workspace/SandboxPreview.tsx` | same | The Sandpack integration and error capture |
| `components/workspace/CodePanel.tsx`, `CodeEditor.tsx`, `FileTree.tsx` | same | Presentational, low coupling |
| `components/landing/HoneycombBackground.tsx`, `HeroSection.tsx`, `Navbar.tsx` | same | Add auth state to Navbar |
| `components/workspace/PRDViewer.tsx` | same | **Add Markdown sanitization** before shipping |
| `components/workspace/ThinkingCanvas.tsx` | same | |
| `tailwind.config.ts`, `app/globals.css` | same | The visual identity |
| `app/pricing/page.tsx` | same | Wire tier data + Stripe checkout |
| `public/model_icons/` | same | |

### Port with rework

| Source | Change |
|---|---|
| `components/workspace/WorkspaceChat.tsx`, `DevChat.tsx` | Replace `fetch` + manual SSE parsing with a Realtime subscription. The event-handling switch survives intact — this is why §7 keeps the event names. |
| `components/workspace/WorkspaceLayout.tsx` | Split into two route segments; fixes R6 |
| `components/workspace/DevWorkspaceLayout.tsx` | Keep the snapshot/rollback logic; move persistence from localStorage to the server |
| `components/landing/MainInput.tsx` | Keep the UI. Remove Jira fields (R-nonexistent feature), fix the privacy copy (R5), repoint to `POST /api/jobs` (R3) |
| `components/landing/SettingsPanel.tsx` | Reduce to BYO-key + model preference; drop Jira |
| `app/api/models/route.ts` | Rebuild the catalogue with verified IDs; filter by caller's tier (R10) |
| `app/api/heal/route.ts` | Becomes a worker job kind, not a route |

### Do not carry

| Source | Reason |
|---|---|
| `lib/hooks/useJobStream.ts` | Dead — targets a nonexistent endpoint (R4) |
| `lib/types/agent-types.ts` | ~160 lines of aspirational types (`ProjectState`, `JiraIntegration`, `GitHubConfig`) that no code imports. Rewrite types from the §8 schema instead. |
| The three `callLLM` copies | Replaced by one `lib/llm/client.ts` (R7) |
| `package.json` dependency list | Rebuild from actual imports (R9) |
| `tsconfig.tsbuildinfo` | Build artifact, currently committed |
| `.gitignore`'s blanket `*.json` rule | Will silently exclude `components.json` and any data fixtures |

### Verified-healthy prototype behaviours worth preserving

- `tsc --noEmit` passes clean — hold this bar from commit one.
- `.env` is correctly gitignored and untracked.
- The multi-provider fallback chain on HTTP 429 works and has clearly been battle-tested against Groq rate limits.
- Zod schema validation with a correction-retry on PRD parse failure is a genuinely good pattern — extend it to codegen.

---

## APPENDIX A — First Week Checklist

1. Answer Q1 (product identity) and Q2 (worker host).
2. `npx create-next-app@latest producthive --typescript --tailwind --app` in a **new repository**.
3. Copy the §20 "verbatim" list. Do not copy `package.json`; add dependencies as imports demand them.
4. Extract `lib/llm/client.ts` and `lib/prompts/`. Delete the duplicates.
5. Fix R1 — rewrite `AGENT_SPECIFICS` to be domain-neutral. Write the golden-topic test for the recipe-app case *first*, watch it fail, then fix.
6. Smoke test: one debate end-to-end, still in-request, still synchronous. Prove the prompts survived the move before changing the architecture underneath them.
7. Only then start P1.

**Step 6 matters more than it looks.** Changing the prompts and the execution architecture in the same commit makes any quality regression impossible to attribute.
