import type { PushSubscriptionInput, SendPayload } from "../types";

function isString(v: unknown): v is string {
	return typeof v === "string" && v.trim().length > 0;
}

export function sanitizePayload(payload: unknown): SendPayload | null {
	if (!payload || typeof payload !== "object") return null;
	const body = payload as Partial<SendPayload>;
	if (!isString(body.title) || !isString(body.body)) return null;
	if (body.url && typeof body.url !== "string") return null;
	return {
		title: body.title.trim(),
		body: body.body.trim(),
		url: body.url?.trim(),
	};
}

export function sanitizeSubscription(payload: unknown): PushSubscriptionInput | null {
	if (!payload || typeof payload !== "object") return null;
	const body = payload as Partial<PushSubscriptionInput>;
	if (!isString(body.endpoint) || !isString(body.p256dh) || !isString(body.auth)) return null;
	return {
		endpoint: body.endpoint.trim(),
		p256dh: body.p256dh.trim(),
		auth: body.auth.trim(),
		userAgent: typeof body.userAgent === "string" ? body.userAgent.slice(0, 300).trim() : undefined,
		memberId: typeof body.memberId === "string" ? body.memberId.trim() : undefined,
		displayName:
			typeof body.displayName === "string" ? body.displayName.slice(0, 60).trim() : undefined,
	};
}

export function readRoomCreateBody(payload: unknown) {
	if (!payload || typeof payload !== "object") return null;
	const body = payload as Record<string, unknown>;
	const roomName = typeof body.roomName === "string" ? body.roomName.trim() : "";
	const ownerPassword =
		typeof body.ownerPassword === "string"
			? body.ownerPassword.trim()
			: typeof body.password === "string"
				? body.password.trim()
				: "";
	const joinPassword = typeof body.joinPassword === "string" ? body.joinPassword.trim() : "";
	const ownerDisplayName = typeof body.ownerDisplayName === "string" ? body.ownerDisplayName.trim() : "";
	if (!roomName || !ownerPassword) return null;
	return {
		roomName: roomName.slice(0, 80),
		ownerPassword: ownerPassword.slice(0, 120),
		joinPassword: joinPassword.slice(0, 120) || undefined,
		ownerDisplayName: ownerDisplayName.slice(0, 60) || "Owner",
	};
}

export function readOwnerLoginBody(payload: unknown) {
	if (!payload || typeof payload !== "object") return null;
	const body = payload as Record<string, unknown>;
	const roomName = typeof body.roomName === "string" ? body.roomName.trim() : "";
	const ownerPassword = typeof body.ownerPassword === "string" ? body.ownerPassword.trim() : "";
	if (!roomName || !ownerPassword) return null;
	return {
		roomName: roomName.slice(0, 80),
		ownerPassword: ownerPassword.slice(0, 120),
	};
}

export function readRoomJoinBody(payload: unknown) {
	if (!payload || typeof payload !== "object") return null;
	const body = payload as Record<string, unknown>;
	const roomName = typeof body.roomName === "string" ? body.roomName.trim() : "";
	const joinPassword =
		typeof body.joinPassword === "string"
			? body.joinPassword.trim()
			: typeof body.password === "string"
				? body.password.trim()
				: "";
	const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
	if (!roomName || !displayName) return null;
	return {
		roomName: roomName.toLowerCase().slice(0, 80),
		joinPassword: joinPassword.slice(0, 120) || undefined,
		displayName: displayName.slice(0, 60),
	};
}
