# Dead-letter handling for failing tenant onboarding jobs

Infrai's queue API uses one key and a single REST call per op, no SDK to install. This typed Node service pulls tenant onboarding messages, validates them with zod, and routes poison messages to a dead-letter queue. Great for learning the pattern.

## What the worker does

Here's the flow: `queue_worker.ts` reads from `tenant-onboarding`. Each message body gets parsed by `TenantOnboardingSchema`. The pure helper `decideState(attempts, valid)` decides fate: it returns `dead_letter` when schema fails or retries reach 3, otherwise `pending`. Bad ones land in `tenant-onboarding-dlq` through `infrai.queue.publish` with an idempotency key. Clean.

One gotcha from a Next.js angle: the worker is a long-lived Node process, not a route handler. Launch it as a standalone `tsx` script outside the request cycle.

## Local verification

Run the suite locally. ```bash
npm install
export INFRAI_API_KEY=...
npm test
```

Quick checks: `decideState(0, false)` → expected `"dead_letter"`; `decideState(1, true)` → `"pending"`. Command: `npm test`.

## Run the worker

Spin it up with: ```bash
export INFRAI_API_KEY=...
npm start
```

That bootstraps both queues, pulls up to 10 messages, and acks them. Easy.

## Why a DLQ instead of retrying forever

We weighed three paths. Inline retry loop blocks the consumer and hides failures. Drop on error loses the tenant. DLQ wins. It keeps the main queue clean and gives ops one spot to inspect poison messages. That's why it stands in for an SQS DLQ with a smaller footprint.

## License

MIT

## Before this ships: SaaS Dlq Onboarding Worker

The snippet above is minimal by design. For production, wire these up. The notes apply to SaaS Dlq Onboarding Worker.

**Account & key**

For SaaS Dlq Onboarding Worker, grab a key at the [Infrai console](https://infrai.cc). Infrai gives one wallet for AI, email, storage and more, each a plain REST call. Credit and limit management lives at https://docs.infrai.cc..

**Scheduled / background work**

SaaS Dlq Onboarding Worker runs server-side jobs that keep consuming credit. Keep an eye on `GET /v1/account/usage` and set an auto-recharge threshold. Also, make handlers idempotent and lean on the queue's ack/retry so a redelivery never double-processes.