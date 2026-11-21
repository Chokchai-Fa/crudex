# Crudex

Crudex is a Thai-language AI assistant for school staff. A teacher can ask Jaew (น้องแจ๋ว) for a fractions worksheet. Jaew delegates to Jum (น้องจ๋ำ), whose tools check the answer key before publication. Other assistants help with teaching media, administrative paperwork and student insights.

[Read the Crudex documentation](https://chokchai-fa.github.io/crudex/) · [Write or preview documentation](skills/write-docusaurus-docs/SKILL.md)

## What works today

The passcode-protected agent demo uses synthetic school data. It has five teacher agents, delegated chat with streamed responses, assessment checking, and a Google Forms integration when configured. OpenCode runs on Node 24 in a disposable Vercel Sandbox and calls OpenAI with a server-side key. A replacement sandbox starts a fresh session. [Gateway API and streaming guide](docs/site/docs/integrations/demo-gateway.md)

Open the app and choose **ครู** (teacher) or **ผอ.** (principal) to try a private sample school without an invitation. Each trial includes classroom ป.4/1 and two sample students.

The school API authenticates teachers, students, guardians and principals. A teacher can start a worksheet run, reconnect to its event stream, and reopen the saved worksheet after the sandbox stops. Students submit quizzes for server-side grading. Teachers can read gradebooks and schedule family report drafts. Principals can review school totals and decide budget claims. The web app connects the teacher classroom, chat and principal brief to the school API. External report delivery is pending.

[API guide](docs/site/docs/integrations/school-api.md) · [OpenAPI specification](docs/site/static/openapi.yaml) · [Database schema](docs/site/docs/reference/database.md) · [Backend implementation plan](PLAN.md) · [Screen designs](docs/design/README.md)

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web` | React application served by Cloudflare Workers Static Assets. |
| `apps/api` | Hono application Worker for school identity, agent runs, classroom workflows and approvals, backed by Neon, a queue consumer and scheduled jobs. |
| `apps/agent-gateway` | Cloudflare Worker for trusted school dispatch, the passcode-protected demo, sandbox lifecycle and demo morning briefs. |
| `apps/agent-runtime` | OpenCode host, agent definitions, school tools, embedded skills and scripted-model tests. |
| `packages/shared` | Zod contracts shared by application callers and the API. |
| `infra` and `.github/workflows` | Terraform resources, CI and separate application and agent release workflows. |

The [backend architecture](docs/site/docs/architecture/run-lifecycle.md) traces an AI request. The [cloud architecture](docs/site/docs/architecture/cloud-services.md) maps each component to its provider and data store.

## Develop locally

Follow [Run Crudex locally](docs/site/docs/getting-started/local-development.md) for prerequisites, migrations, local services and the school workflow checks.

## Verification and operations

Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` from the repository root. After changing a Drizzle table, generate and review the migration with `pnpm --filter api db:generate`.

Hosted infrastructure must stay within the repo’s no-credit-card constraint. The infrastructure guide covers account setup, credentials, migrations and deployments. [Infrastructure guide](infra/README.md) · [Repository conventions](CLAUDE.md)
