import { beforeEach, describe, expect, it } from "@jest/globals";

import {
  consumeRateLimit,
  resetRateLimitStore,
  resolveRateLimitPolicy,
  type RateLimitPolicy,
} from "@/lib/rate-limit";

describe("rate limit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows requests up to the policy limit and blocks the next one", () => {
    const policy: RateLimitPolicy = {
      id: "test-policy",
      limit: 2,
      windowMs: 60_000,
    };

    const first = consumeRateLimit(policy, "client-a", 1_000);
    const second = consumeRateLimit(policy, "client-a", 2_000);
    const third = consumeRateLimit(policy, "client-a", 3_000);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the counter after the time window elapses", () => {
    const policy: RateLimitPolicy = {
      id: "test-reset",
      limit: 1,
      windowMs: 60_000,
    };

    const first = consumeRateLimit(policy, "client-b", 1_000);
    const second = consumeRateLimit(policy, "client-b", 2_000);
    const third = consumeRateLimit(policy, "client-b", 62_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(third.allowed).toBe(true);
  });

  it("uses stricter policy for login endpoint", () => {
    const loginPolicy = resolveRateLimitPolicy("/api/auth/login");
    const apiPolicy = resolveRateLimitPolicy("/api/users");

    expect(loginPolicy).not.toBeNull();
    expect(apiPolicy).not.toBeNull();

    expect(loginPolicy?.limit).toBe(5);
    expect(apiPolicy?.limit).toBe(100);
  });
});

