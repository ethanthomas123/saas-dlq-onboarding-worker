import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { decideState } from "./queue_worker.js";

describe("onboarding dlq decision", () => {
  it("routes invalid schema to dead_letter on first attempt", () => {
    assert.equal(decideState(0, false), "dead_letter");
  });
  it("routes valid message past retries to dead_letter", () => {
    assert.equal(decideState(3, true), "dead_letter");
  });
  it("keeps valid message under retry limit pending", () => {
    assert.equal(decideState(1, true), "pending");
  });
});
