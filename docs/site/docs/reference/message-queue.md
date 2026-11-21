---
sidebar_label: Message queue
description: Message bodies, producers, consumer effects, retries and recovery for the school backend queue.
---

# Message queue specification

The application Worker sends JSON objects to the Cloudflare queue `crudex-jobs` through its `JOBS_QUEUE` binding. The same Worker consumes one message per batch. Each body has a case-sensitive `type` discriminator. The producer validates the body before sending and the consumer validates it again on receipt. Cloudflare supplies the delivery ID and attempt count separately from the JSON body. [Message schema](https://github.com/Chokchai-Fa/crudex/blob/main/apps/api/src/jobs/messages.ts) · [Worker bindings](https://github.com/Chokchai-Fa/crudex/blob/main/apps/api/wrangler.toml)

## Message bodies

All fields listed for a type are required. UUIDs are strings. Timestamps use the UTC ISO 8601 format accepted by `z.iso.datetime()`. Each line below is a separate example message.

| Type | Payload fields besides `type` | Producer | Consumer effect |
| --- | --- | --- | --- |
| `dispatch-run` | `runId` (UUID), the accepted run | Run acceptance and scheduled outbox recovery | Claims a queued run, dispatches it through the school gateway and persists run events and the outcome. |
| `draft-reports` | `routineId` (UUID), the daily routine; `occurrence` (timestamp), its stored due instant | Five-minute scheduler | Advances the matching occurrence and writes a draft per eligible student–guardian pair. |
| `note-created` | `noteId` (UUID), the saved note | Notes service after a successful insert | Logs the note ID. Enqueue is best effort and failure leaves the saved note intact. |
| `ping` | `sentAt` (timestamp), the time supplied by the sender | Diagnostic message exercised in queue tests | Logs the supplied timestamp. The daily Redis keepalive runs directly from cron. |

```jsonl
{"type":"dispatch-run","runId":"39dc86f7-0c49-42ee-9061-5784c13de16f"}
{"type":"draft-reports","routineId":"355b02a4-43cc-47d6-9845-6a287c825973","occurrence":"2026-11-21T01:30:00.000Z"}
{"type":"note-created","noteId":"ab24a2a5-05dc-4e6a-a0ac-33a88140dfc3"}
{"type":"ping","sentAt":"2026-11-21T01:31:00.000Z"}
```

## Acknowledgement and retries

| Delivery outcome | Consumer action |
| --- | --- |
| Unknown type, missing required field or invalid field value | Logs the delivery ID and acknowledges the message immediately. |
| Handler returns successfully, including an already-processed job | Acknowledges the message. |
| Handler throws on attempts 1, 2 or 3 | Requests redelivery after 10, 20 or 40 seconds respectively. |
| Handler throws on attempt 4 | Logs the job type and delivery ID, then acknowledges. The queue has no configured dead-letter destination. |

A queue acknowledgement describes completion of the handler. For an AI request, read the durable run status to determine whether generation succeeded. [Consumer implementation](https://github.com/Chokchai-Fa/crudex/blob/main/apps/api/src/jobs/queue-handler.ts)

## Duplicate delivery and recovery

**Agent runs.** Acceptance commits the run and its `run_outbox` row together. If the initial send fails, the five-minute recovery job can enqueue the pending run again. Only a queued run can acquire a 12-minute attempt lease. Claiming removes the outbox entry. Later deliveries for the same run cannot start another attempt. Recovery marks an expired running attempt interrupted, and a client can replay committed events using its last cursor. [Run lifecycle](../architecture/run-lifecycle.md)

**Family reports.** The scheduler selects up to 100 enabled, due routines in order of their next scheduled instant. The consumer matches the exact instant in the message to the current `next_run_at`. Advancing it by one day and inserting the drafts happen in one SQL statement. A duplicate or stale message cannot advance the same occurrence twice. The uniqueness key includes routine, occurrence, student and guardian. An unprocessed due routine remains eligible for the next scan. [Database schema](database.md) · [Queue and cron diagram](../architecture/service-diagrams.md#cloudflare-queues-and-cron)
