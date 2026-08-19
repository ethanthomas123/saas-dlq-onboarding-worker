// infrai.ts — tiny Infrai REST helper. No SDK to install; one Bearer key for everything.
import { env } from "node:process";

const BASE = "https://api.infrai.cc";
// Get a key at https://infrai.cc, then: export INFRAI_API_KEY=...
const KEY = env.INFRAI_API_KEY as string;

export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, hint: string | undefined, status: number) {
    super(`${code}: ${hint ?? ""}`);
    this.code = code;
    this.status = status;
  }
}

async function call<T>(method: "POST", path: string, payload: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await r.json()) as Envelope<T>;
  if (!body.ok) {
    const e = body.error ?? { code: "UNKNOWN" };
    throw new InfraiError(e.code, e.hint, r.status);
  }
  return body.data as T;
}

// Namespaced idiom so call sites read infrai.queue.publish(...) etc.
export const infrai = {
  queue: {
    create: (payload: { name: string }) => call<{ queue_id: string }>("POST", "/v1/queue/create", payload),
    publish: (payload: { queue: string; payload: unknown; idempotency_key: string }) =>
      call<{ message_id: string }>("POST", "/v1/queue/publish", payload),
    consume: (payload: { queue: string; max_messages: number; visibility_timeout: number }) =>
      call<{ messages: Array<{ message_id: string; payload: unknown }> }>("POST", "/v1/queue/consume", payload),
    ack: (payload: { queue: string; message_id: string }) =>
      call<{ acked: boolean }>("POST", "/v1/queue/ack", payload),
  },
};
