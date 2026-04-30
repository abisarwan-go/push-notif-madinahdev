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
	const password = typeof body.password === "string" ? body.password.trim() : "";
	const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
	const ownerEmail = typeof body.ownerEmail === "string" ? body.ownerEmail.trim() : "";
	if (!roomName || !password) return null;
	return {
		roomName: roomName.slice(0, 80),
		password: password.slice(0, 120),
		ownerName: ownerName.slice(0, 60) || "Owner",
		ownerEmail: ownerEmail || "owner@example.com",
	};
}

export function readRoomJoinBody(payload: unknown) {
	if (!payload || typeof payload !== "object") return null;
	const body = payload as Record<string, unknown>;
	const password = typeof body.password === "string" ? body.password.trim() : "";
	const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
	if (!password || !displayName) return null;
	return {
		password: password.slice(0, 120),
		displayName: displayName.slice(0, 60),
	};
}

export function readJoinByNameBody(payload: unknown) {
	if (!payload || typeof payload !== "object") return null;
	const body = payload as Record<string, unknown>;
	const roomName = typeof body.roomName === "string" ? body.roomName.trim() : "";
	const password = typeof body.password === "string" ? body.password.trim() : "";
	const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
	if (!roomName || !password || !displayName) return null;
	return {
		roomName: roomName.toLowerCase().slice(0, 80),
		password: password.slice(0, 120),
		displayName: displayName.slice(0, 60),
	};
}

export function readJoinByTokenBody(payload: unknown) {
	if (!payload || typeof payload !== "object") return null;
	const body = payload as Record<string, unknown>;
	const token = typeof body.token === "string" ? body.token.trim() : "";
	const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
	if (!token || !displayName) return null;
	return {
		token,
		displayName: displayName.slice(0, 60),
	};
}

export function readInviteBody(payload: unknown) {
	if (!payload || typeof payload !== "object") return null;
	const body = payload as Record<string, unknown>;
	const roomName = typeof body.roomName === "string" ? body.roomName.trim() : "";
	const ttlMinutes = typeof body.ttlMinutes === "number" ? body.ttlMinutes : 5;
	if (!roomName) return null;
	return {
		roomName: roomName.toLowerCase().slice(0, 80),
		ttlMinutes: Math.max(1, Math.min(15, Math.floor(ttlMinutes || 5))),
	};
}
