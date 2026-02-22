export type RateLimitDecision =
    | { allowed: true }
    | { allowed: false; retryAfterMs: number; limit: number; windowMs: number };

type Bucket = {
    windowStartMs: number;
    count: number;
};

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Notes:
 * - Best-effort protection for a single-node local stack.
 * - Resets on process restart.
 * - Key should include the route + identity (IP/device).
 */
export class RateLimiter {
    private buckets = new Map<string, Bucket>();

    decide(key: string, limit: number, windowMs: number, nowMs: number = Date.now()): RateLimitDecision {
        if (!key) return { allowed: true };
        if (!Number.isFinite(limit) || limit <= 0) return { allowed: true };
        if (!Number.isFinite(windowMs) || windowMs <= 0) return { allowed: true };

        const existing = this.buckets.get(key);
        if (!existing) {
            this.buckets.set(key, { windowStartMs: nowMs, count: 1 });
            return { allowed: true };
        }

        const elapsed = nowMs - existing.windowStartMs;
        if (elapsed >= windowMs) {
            existing.windowStartMs = nowMs;
            existing.count = 1;
            return { allowed: true };
        }

        if (existing.count >= limit) {
            const retryAfterMs = Math.max(0, windowMs - elapsed);
            return { allowed: false, retryAfterMs, limit, windowMs };
        }

        existing.count += 1;
        return { allowed: true };
    }

    cleanup(maxAgeMs: number = 10 * 60 * 1000) {
        const now = Date.now();
        for (const [key, bucket] of this.buckets.entries()) {
            if (now - bucket.windowStartMs > maxAgeMs) {
                this.buckets.delete(key);
            }
        }
    }
}

export const rateLimiter = new RateLimiter();
