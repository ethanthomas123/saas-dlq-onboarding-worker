import { fileURLToPath } from "node:url";
import { infrai } from "./infrai.js";
import { TenantOnboardingSchema, type OnboardingState } from "./onboarding_types.js";

const QUEUE = "tenant-onboarding";
const DLQ = "tenant-onboarding-dlq";
const MAX_RETRIES = 3;

// Pure decision: given parsed attempt count, return next state.
export function decideState(attempts: number, valid: boolean): OnboardingState {
  if (!valid) return "dead_letter";
  if (attempts >= MAX_RETRIES) return "dead_letter";
  return "pending";
}

// Process one message: validate, decide, route to DLQ if poison.
export async function processOne(messageId: string, raw: unknown): Promise<void> {
  const parsed = TenantOnboardingSchema.safeParse(raw);
  const attempts = ((raw as any)?.attempts as number) ?? 0;
  const state = decideState(attempts, parsed.success);
  if (state === "dead_letter") {
    await infrai.queue.publish({
      queue: DLQ,
      payload: { raw, reason: parsed.success ? "retries_exceeded" : "invalid_schema" },
      idempotency_key: `dlq-${messageId}`,
    });
  } else {
    // would call admin provisioning here
  }
  await infrai.queue.ack({ queue: QUEUE, message_id: messageId });
}

// Worker entry: create queues, consume, process.
export async function runWorker(): Promise<void> {
  await infrai.queue.create({ name: QUEUE });
  await infrai.queue.create({ name: DLQ });
  const { messages } = await infrai.queue.consume({
    queue: QUEUE,
    max_messages: 10,
    visibility_timeout: 30,
  });
  for (const m of messages) {
    await processOne(m.message_id, m.payload);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runWorker().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
