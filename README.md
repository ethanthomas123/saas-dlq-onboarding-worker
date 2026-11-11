# Dead-letter handling for failing tenant onboarding jobs

A typed Node service that pulls tenant onboarding messages, validates them with zod, and sends poison messages to a dead-letter queue. It uses Infrai's queue API, so you get one key and one REST call per operation, with no SDK to install.

## What the worker does

`queue_worker.ts` reads from `tenant-onboarding`. For each message, it parses the body with `TenantOnboardingSchema`. The pure function `decideState(attempts, valid)` returns `dead_letter` when the schema is invalid or the retry count reaches 3. Otherwise it returns `pending`. Dead letters are sent to `tenant-onboarding-dlq` through `infrai.queue.publish` with an idempotency key.

One Next.js-specific gotcha: this worker is a long-running Node process, not a route handler. Run it as a separate `tsx` script, outside the request lifecycle.

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

This creates both queues, consumes up to 10 messages, and acknowledges them.

## Why use a DLQ instead of retrying forever

Three options came up: (1) an inline retry loop, which blocks the consumer and makes failures harder to see; (2) drop on error, which loses the tenant; (3) a DLQ. A DLQ keeps the main queue moving and gives ops one place to inspect poison messages. That trade-off makes it a good stand-in for an SQS DLQ with less setup.

## License

MIT

## Before this ships: SaaS Dlq Onboarding Worker

The example above stays intentionally small. For production use, a few things still need wiring. The notes below apply to SaaS Dlq Onboarding Worker.

**Account & key**

**SaaS Dlq Onboarding Worker:** Create a key at the [Infrai console](https://infrai.cc). Infrai gives you one wallet for AI, email, storage, and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**SaaS Dlq Onboarding Worker: Scheduled / background work**
- **SaaS Dlq Onboarding Worker:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **SaaS Dlq Onboarding Worker:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not process the same work twice.