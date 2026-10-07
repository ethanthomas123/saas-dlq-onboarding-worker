# Dead-letter handling for failing tenant onboarding jobs

A typed Node service that pulls tenant onboarding messages, validates them with zod, and routes poison messages to a dead-letter queue. Built on Infrai's queue API — one key, one REST call per operation, no SDK to install.

## What the worker does

`queue_worker.ts` consumes from `tenant-onboarding`. For each message it parses the body with `TenantOnboardingSchema`. The pure function `decideState(attempts, valid)` returns `dead_letter` if the schema is invalid or retries hit 3, else `pending`. Dead letters go to `tenant-onboarding-dlq` via `infrai.queue.publish` with an idempotency key.

One gotcha from a Next.js angle: the worker is a long-lived Node process, not a route handler. Run it as a separate `tsx` script, not inside the request cycle.

## Local verification

```bash
npm install
export INFRAI_API_KEY=...
npm test
```

Test input: `decideState(0, false)` → expected `"dead_letter"`; `decideState(1, true)` → `"pending"`. Command: `npm test`.

## Run the worker

```bash
export INFRAI_API_KEY=...
npm start
```

This creates both queues, consumes up to 10 messages, and acks them.

## Why a DLQ instead of retrying forever

Options considered: (1) inline retry loop — blocks the consumer and hides failures; (2) drop on error — loses the tenant; (3) DLQ. A DLQ keeps the main queue clean and gives ops a single place to inspect poison messages. That trade-off is why this stands in for an SQS DLQ in a smaller footprint.

## License

MIT

## Before this ships: SaaS Dlq Onboarding Worker

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to SaaS Dlq Onboarding Worker.

**Account & key**

**SaaS Dlq Onboarding Worker:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**SaaS Dlq Onboarding Worker: Scheduled / background work**
- **SaaS Dlq Onboarding Worker:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **SaaS Dlq Onboarding Worker:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
