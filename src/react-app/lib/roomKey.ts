/** Match worker `normalizeRoomKey` for URLs and lookups. */
export function normalizeRoomKey(raw: string): string {
	try {
		return decodeURIComponent(raw).trim().toLowerCase();
	} catch {
		return raw.trim().toLowerCase();
	}
}
