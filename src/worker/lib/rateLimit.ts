const inMemoryRateLimit = new Map<string, { count: number; windowStart: number }>();

export function isRateLimited(bucketId: string, limitPerMinute = 30): boolean {
	const now = Date.now();
	const slot = inMemoryRateLimit.get(bucketId);
	if (!slot || now - slot.windowStart >= 60_000) {
		inMemoryRateLimit.set(bucketId, { count: 1, windowStart: now });
		return false;
	}
	slot.count += 1;
	return slot.count > limitPerMinute;
}
