export type RateLimitPolicy = {
  id: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  policyId: string;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  windowSeconds: number;
};

const AUTH_LOGIN_POLICY: RateLimitPolicy = {
  id: "auth-login",
  limit: 5,
  windowMs: 15 * 60 * 1000,
};

const STANDARD_API_POLICY: RateLimitPolicy = {
  id: "api-standard",
  limit: 100,
  windowMs: 15 * 60 * 1000,
};

const counters = new Map<string, RateLimitEntry>();
let lastCleanupAt = 0;

function cleanupExpiredEntries(now: number) {
  const cleanupIntervalMs = 60 * 1000;
  if (now - lastCleanupAt < cleanupIntervalMs) {
    return;
  }

  for (const [key, entry] of counters.entries()) {
    if (entry.resetAt <= now) {
      counters.delete(key);
    }
  }

  lastCleanupAt = now;
}

function toRetryAfterSeconds(resetAt: number, now: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

export function resolveRateLimitPolicy(pathname: string): RateLimitPolicy | null {
  if (pathname === "/api/health") {
    return null;
  }

  if (pathname === "/api/auth/login") {
    return AUTH_LOGIN_POLICY;
  }

  return STANDARD_API_POLICY;
}

export function resolveRateLimitClient(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
    if (firstForwardedIp) {
      return firstForwardedIp;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const userAgent = headers.get("user-agent")?.trim();
  if (userAgent) {
    return `ua:${userAgent}`;
  }

  return "anonymous";
}

export function consumeRateLimit(policy: RateLimitPolicy, clientKey: string, now = Date.now()): RateLimitResult {
  cleanupExpiredEntries(now);

  const key = `${policy.id}:${clientKey}`;
  const existing = counters.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + policy.windowMs;
    counters.set(key, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      policyId: policy.id,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - 1),
      resetAt,
      retryAfterSeconds: toRetryAfterSeconds(resetAt, now),
      windowSeconds: Math.ceil(policy.windowMs / 1000),
    };
  }

  if (existing.count >= policy.limit) {
    return {
      allowed: false,
      policyId: policy.id,
      limit: policy.limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: toRetryAfterSeconds(existing.resetAt, now),
      windowSeconds: Math.ceil(policy.windowMs / 1000),
    };
  }

  existing.count += 1;
  counters.set(key, existing);

  return {
    allowed: true,
    policyId: policy.id,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: toRetryAfterSeconds(existing.resetAt, now),
    windowSeconds: Math.ceil(policy.windowMs / 1000),
  };
}

export function resetRateLimitStore() {
  counters.clear();
  lastCleanupAt = 0;
}
