# School backend and AI integration plan

## Backend delivery status

| Area | Implemented backend | Verification or follow-up |
| --- | --- | --- |
| School identity | Invitation exchange, session revocation, active membership selection and class/guardian access | Local synthetic fixtures cover two schools, expired identity and concurrent invitation redemption. |
| AI dispatch | Private service binding, scoped attempt credentials, single sandbox manager with owner rotation, server-side OpenAI configuration | The runtime suite exercises OpenCode with a scripted model. Check the deployed gateway entrypoint, sandbox boot and one budget-authorized live turn before rollout. |
| Runs and memory | Atomic acceptance, quota and outbox, queue dispatch, durable event replay, cancellation and owner-approved memory | Local Postgres checks cover concurrent acceptance, quota rollback and memory isolation. |
| Worksheets and quizzes | Scoped worksheet save with arithmetic verification, durable artifact, student-safe quiz, idempotent grading and teacher gradebook | The local Worker workflow exercises duplicate tool saves, replay, quiz submission and gradebook reads. School mode uses the local form. |
| Routines and briefs | Bangkok-local scheduling, drafts per guardian, sent-report access and principal school aggregates | External report delivery requires a provider and confirmed-send handling. |
| Budget approvals | Teacher claims, principal decisions and atomic channel notifications | Local HTTP checks cover replay, concurrent decisions and school isolation. |

## Remaining integration and release work

1. Consume the [API guide](docs/site/docs/integrations/school-api.md) and [OpenAPI specification](docs/site/static/openapi.yaml) in the separate frontend PR. Verify sign-in, reconnect, worksheet navigation, quiz submission and role-specific states against a local application Worker.
2. Qualify the separately deployed gateway and application revisions together. Exercise gateway boot, disconnect, failure, sandbox replacement, scoped callbacks and saved-artifact retrieval. Verify the demo morning-brief alarm against its last valid result.
3. Enable external Forms or family report delivery only when provider credentials, recipient authorization, confirmed publication or delivery, and handling for uncertain results are available.
4. Run the checks below before deployment. Release the gateway revision with the named entrypoint before shipping the application binding. Agent changes deploy on qualifying merged PRs or manual workflow dispatch.

[School architecture](docs/site/docs/architecture/run-lifecycle.md) · [Cloud components](docs/site/docs/architecture/cloud-services.md) · [Database schema](docs/site/docs/reference/database.md)

## Local verification sequence

1. Use the pinned repo Node version and `pnpm install --frozen-lockfile`. Start the Compose dependencies and run migrations against the local database as described in the [README](README.md).
2. For each API change, exercise the new route and denial path using the patterns in [notes route tests](apps/api/test/notes.routes.test.ts). Run `pnpm --filter api test`, `pnpm --filter agent-gateway test` and `pnpm --filter agent-runtime test` for the touched packages.
3. For agent changes, set `OPENCODE_BIN` to the compatible local OpenCode executable and run `node apps/agent-runtime/e2e/run.mjs` with Node 24. Extend the scripted scenarios for principal routing and scoped tool calls.
4. For the first release, seed two schools, submit one Thai worksheet request twice with the same ID, disconnect and reconnect, and verify one assessment, one quota reservation and zero cross-school reads. Replace the sandbox and retrieve the completed assessment again. Run workspace lint, typecheck, tests and build before release.
