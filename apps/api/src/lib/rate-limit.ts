import { TooManyRequestsError } from "./errors";

export interface RateLimiter {
	check(key: string): { allowed: boolean; retryAfterMs: number };
}

interface Bucket {
	count: number;
	resetAt: number;
}

export function createRateLimiter(windowMs: number, max: number): RateLimiter {
	const buckets = new Map<string, Bucket>();
	return {
		check(key: string): { allowed: boolean; retryAfterMs: number } {
			const now = Date.now();
			if (buckets.size > 10000) {
				for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
			}
			const bucket = buckets.get(key);
			if (!bucket || bucket.resetAt <= now) {
				buckets.set(key, { count: 1, resetAt: now + windowMs });
				return { allowed: true, retryAfterMs: 0 };
			}
			if (bucket.count < max) {
				bucket.count += 1;
				return { allowed: true, retryAfterMs: 0 };
			}
			return { allowed: false, retryAfterMs: bucket.resetAt - now };
		},
	};
}

export const loginLimiter: RateLimiter = createRateLimiter(60_000, 5);
export const ballotLimiter: RateLimiter = createRateLimiter(60_000, 5);
export const issueLimiter: RateLimiter = createRateLimiter(60_000, 5);

export function consumeOrThrow(
	limiter: RateLimiter,
	key: string,
	message?: string,
): void {
	const result = limiter.check(key);
	if (!result.allowed)
		throw new TooManyRequestsError(result.retryAfterMs, message);
}

export function clientIp(headers: Record<string, string | undefined>): string {
	const forwarded = headers["x-forwarded-for"];
	if (forwarded) {
		const first = forwarded.split(",")[0];
		if (first) return first.trim();
	}
	return headers["x-real-ip"] ?? "unknown";
}
