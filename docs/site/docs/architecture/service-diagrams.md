---
sidebar_label: Service diagrams
description: Component diagrams for the application Worker, database, queue, gateway, sandbox, model, cache and deployment services.
---

# Service architecture diagrams

Start with the [whole-system topology](cloud-services.md#current-deployment-topology) to see where services run. The diagrams below follow the same boundaries into each service. Arrows identify a request, write, event stream or scheduled invocation.

## Application Worker and static assets

```mermaid
flowchart LR
    Browser -->|application files| Assets[Workers Static Assets]
    Browser -->|school API| Routes[Hono routes]
    Runtime[Sandbox school tools] -->|attempt credential| Routes
    Routes -->|session or tool scope| Services[School services]
    Services --> Repos[Drizzle repositories]
    Repos -->|HTTPS| DB[(Neon Postgres)]
    Services -->|dispatch intent ready| Q[Cloudflare Queue]
```

Static assets serve the application. API routes validate inputs against shared contracts. Each school service checks the active membership or run scope before calling its repository. The [API explorer](../reference/openapi.mdx) lists both browser routes and internal callbacks.

## Neon Postgres

```mermaid
flowchart TD
    Auth[Identity service] --> Identity[(Accounts, memberships and sessions)]
    Run[Run service] -->|atomic acceptance| Ledger[(Run, initial event, quotas and outbox)]
    Consumer[Queue consumer] -->|claim and finish attempt| Ledger
    Consumer -->|append ordered events| Stream[(Run events)]
    Replay[History and event replay] --> Stream
    Tools[Verified tool callbacks] --> Worksheets[(Assessments)]
    Student[Quiz submission] --> Grades[(Submissions)]
    Worksheets --> Student
    Cron[Routine consumer] --> Reports[(Guardian report drafts)]
    Decision[Principal decision] -->|atomic update| Claims[(Claims and notifications)]
```

These are tables in one database. Daily quota reservations and dispatch intent commit with the new run. A repeated submission uses the saved worksheet and student identity to find the original grade. The [schema](../reference/database.md) lists the keys, constraints and ownership rules for every table.

## Cloudflare Queues and cron

```mermaid
sequenceDiagram
    participant API as Application Worker
    participant DB as Neon
    participant Q as crudex-jobs
    participant C as Queue consumer
    participant G as Agent gateway
    API->>DB: Accept run and store dispatch intent
    API->>Q: Enqueue dispatch-run
    Q->>C: Deliver message
    C->>DB: Claim active attempt
    C->>G: Dispatch school turn
    G-->>C: Stream events
    C->>DB: Commit events and terminal outcome
    Note over API,DB: Every five minutes, recover outstanding work and find due routines
    API->>Q: Enqueue draft-reports for due occurrence
    Q->>C: Deliver routine ID and scheduled instant
    C->>DB: Advance routine and write per-guardian drafts
```

The consumer handles one message per batch. It retries transient handler failures with backoff. Postgres tracks run attempts and deduplicates routine deliveries. A client reconnect reads committed events independently of queue delivery.

## Upstash Redis and Workers KV

```mermaid
flowchart LR
    Timer[Daily cron at 03:17 UTC] --> App[Scheduled handler]
    App --> Cache[Cache adapter]
    Cache -->|REST write with seven-day TTL| Redis[(Upstash Redis)]
    Terraform -->|provisions namespace| KV[(Workers KV)]
    Worker[Application Worker] -. reserved PREVIEWS binding .-> KV
```

The keepalive refreshes one Redis key. The Worker has a KV namespace for future previews. Published worksheets and grades are read from Postgres.

## Agent gateway and Durable Objects

```mermaid
flowchart TD
    Consumer[School queue consumer] -->|private service binding| Dispatch[SchoolDispatch]
    Dispatch -->|scoped turn| Manager[SandboxManager]
    Demo[Demo browser] -->|passcode cookie| Gateway[Gateway routes]
    Gateway -->|demo chat| Manager
    Gateway -->|latest or manual brief| Brief[MorningBrief]
    Brief -->|manual run or Bangkok alarm| Manager
    Brief --> BriefStore[(Latest validated demo brief)]
    Manager --> State[(Sandbox lifecycle and daily usage)]
    Manager -->|start, rotate or stop| Sandbox[Vercel Sandbox]
    Sandbox -->|single-use bundle request| Gateway
    Gateway --> Archive[Gateway static assets]
```

Each teacher has their own sandbox manager instance and sandbox; the shared daily run cap stays on the `main` instance. The morning-brief object maintains the demo schedule and accepted result. School principal brief data comes from school-scoped API queries.

## Vercel Sandbox, OpenCode and OpenAI

```mermaid
sequenceDiagram
    participant M as SandboxManager
    participant R as Node runtime
    participant H as OpenCode harness
    participant AI as OpenAI API
    participant T as School plugin tools
    participant A as Application Worker
    M->>R: Authenticated chat and signed school scope
    R->>H: Start or resume an owned agent session
    H->>AI: Prompt and permitted tools
    AI-->>H: Model response or requested tool call
    H->>T: Check permissions and execute tool
    T->>A: Scoped callback for records or worksheet save
    A-->>T: Authorized result
    T-->>H: Tool output
    H-->>R: Session, tool and response events
    R-->>M: Stream turn
```

The sandbox owns temporary session state and receives the server-side model key. OpenAI performs inference. Tool handlers execute in the runtime and the school API persists business results. In the passcode demo, configured Google Apps Script adapters can publish Forms or request mail. School workflows publish local quizzes and create family report drafts.

## Optional demo integrations

```mermaid
flowchart LR
    Tool[Demo school tools] -->|configured HTTPS endpoint| Script[Google Apps Script]
    Script --> Form[Google Forms quiz]
    Script --> Mail[Mail delivery]
    Media[Teaching media agent] -->|validated draft and enabled permission| MCP[Kahoot MCP]
    MCP --> Quiz[Kahoot quiz]
```

Google actions require the configured Apps Script endpoint. The optional Kahoot tool is enabled for the teaching media agent in demo mode and checks the prepared draft before publication.

## Provisioning, releases and documentation

```mermaid
flowchart TD
    PR[GitHub pull request] --> Checks[CI and documentation build]
    Merge[Merge into main] --> AppRelease[Application workflow]
    AppRelease -->|changed infrastructure| TF[Terraform with HCP state]
    TF --> Resources[Neon, Upstash, Queue, KV and Vercel project]
    AppRelease -->|migrations then Worker and SPA| App[Cloudflare application Worker]
    Merge -->|agent changes| AgentRelease[Agent workflow]
    AgentRelease --> Gateway[Cloudflare gateway and runtime archive]
    Merge -->|documentation changes| Docs[Docusaurus build]
    Docs --> Pages[GitHub Pages]
```

Each workflow filters by changed paths. The [infrastructure runbook](https://github.com/Chokchai-Fa/crudex/blob/main/infra/README.md) covers provisioning and the first release order.
