import prismaClients from "../lib/prismaClient";
import { randomToken, sha256Hex, signJwtHS256, verifyJwtHS256 } from "../lib/crypto";
import type { AppContext, PushSubscriptionInput } from "../types";

/** URL / storage key for room: lowercase, allow hyphen + underscore (legacy slug migration). */
export function normalizeRoomKey(raw: string): string {
	try {
		return decodeURIComponent(raw).trim().toLowerCase();
	} catch {
		return raw.trim().toLowerCase();
	}
}

export async function createRoom(
	c: AppContext,
	ownerUserId: string,
	input: { roomName: string; joinPassword?: string; ownerDisplayName: string },
) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const ownerPasswordHash = await sha256Hex(randomToken(32));
	const joinPasswordHash = input.joinPassword ? await sha256Hex(input.joinPassword) : null;
	const existing = await prisma.room.findUnique({ where: { name: input.roomName } });
	if (existing) {
		throw Object.assign(new Error("ROOM_NAME_TAKEN"), { code: "ROOM_NAME_TAKEN" });
	}
	const room = await prisma.room.create({
		data: {
			name: input.roomName,
			ownerUserId,
			vapidPublicKey: c.env.VAPID_PUBLIC_KEY ?? "",
			ownerPasswordHash,
			joinPasswordHash,
			members: { create: { displayName: input.ownerDisplayName } },
		},
	});
	return {
		roomId: room.id,
		roomName: room.name,
	};
}

export async function ownerLogin(c: AppContext, roomName: string, ownerPassword: string) {
	if (!c.env.ROOM_OWNER_JWT_SECRET) throw new Error("Missing ROOM_OWNER_JWT_SECRET");
	const prisma = await prismaClients.fetch(c.env.DB);
	const key = normalizeRoomKey(roomName);
	const room = await prisma.room.findUnique({ where: { name: key } });
	if (!room) return null;
	const hash = await sha256Hex(ownerPassword);
	if (hash !== room.ownerPasswordHash) return false;
	const token = await signJwtHS256({ roomId: room.id, roomName: room.name }, c.env.ROOM_OWNER_JWT_SECRET, 7 * 24 * 60 * 60);
	return { token, expiresInSec: 7 * 24 * 60 * 60, roomName: room.name };
}

export async function joinByName(
	c: AppContext,
	roomName: string,
	joinPassword: string | undefined,
	displayName: string,
) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const room = await prisma.room.findUnique({ where: { name: roomName } });
	if (!room) return null;
	if (room.joinPasswordHash) {
		if (!joinPassword) return false;
		const hash = await sha256Hex(joinPassword);
		if (hash !== room.joinPasswordHash) return false;
	}
	const member = await prisma.member.upsert({
		where: { roomId_displayName: { roomId: room.id, displayName } },
		update: { lastSeenAt: new Date() },
		create: { roomId: room.id, displayName },
	});
	return { memberId: member.id, roomId: room.id, roomName: room.name, displayName };
}

export async function verifyOwnerToken(c: AppContext, token: string) {
	if (!c.env.ROOM_OWNER_JWT_SECRET) return null;
	return verifyJwtHS256(token, c.env.ROOM_OWNER_JWT_SECRET);
}

export async function getRoomStats(c: AppContext, roomKey: string) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const name = normalizeRoomKey(roomKey);
	const room = await prisma.room.findUnique({ where: { name } });
	if (!room) return null;
	const membersCount = await prisma.member.count({ where: { roomId: room.id } });
	const activeSubscriptions = await prisma.subscription.count({ where: { roomId: room.id, status: "ACTIVE" } });
	const notifications = await prisma.notification.findMany({
		where: { roomId: room.id },
		orderBy: { createdAt: "desc" },
		take: 30,
	});
	return {
		roomId: room.id,
		roomName: room.name,
		membersCount,
		activeSubscriptions,
		notifications,
	};
}

export async function isRoomOwnedByUser(c: AppContext, roomKey: string, userId: string): Promise<boolean> {
	const prisma = await prismaClients.fetch(c.env.DB);
	const name = normalizeRoomKey(roomKey);
	const room = await prisma.room.findUnique({
		where: { name },
		select: { ownerUserId: true },
	});
	return !!room && room.ownerUserId === userId;
}

/** Dashboard access: owner has full control; member is anyone with a Member row for this room (displayName = username). */
export async function getDashboardViewerRole(
	c: AppContext,
	roomKey: string,
	userId: string,
	username: string,
): Promise<"OWNER" | "MEMBER" | null> {
	const prisma = await prismaClients.fetch(c.env.DB);
	const name = normalizeRoomKey(roomKey);
	const room = await prisma.room.findUnique({
		where: { name },
		select: { id: true, ownerUserId: true },
	});
	if (!room) return null;
	if (room.ownerUserId === userId) return "OWNER";
	const membership = await prisma.member.findFirst({
		where: { roomId: room.id, displayName: username },
		select: { id: true },
	});
	return membership ? "MEMBER" : null;
}

export async function upsertRoomSubscription(
	c: AppContext,
	roomKey: string,
	payload: PushSubscriptionInput,
	origin?: string,
): Promise<{ ok: true } | { error: string }> {
	const prisma = await prismaClients.fetch(c.env.DB);
	const name = normalizeRoomKey(roomKey);
	const room = await prisma.room.findUnique({
		where: { name },
		select: { id: true },
	});
	if (!room) return { error: "Room not found" };
	void origin;
	await prisma.subscription.upsert({
		where: { endpoint: payload.endpoint },
		update: {
			roomId: room.id,
			p256dh: payload.p256dh,
			auth: payload.auth,
			userAgent: payload.userAgent,
			memberId: payload.memberId,
			status: "ACTIVE",
			lastSeenAt: new Date(),
		},
		create: {
			roomId: room.id,
			endpoint: payload.endpoint,
			p256dh: payload.p256dh,
			auth: payload.auth,
			userAgent: payload.userAgent,
			memberId: payload.memberId,
		},
	});
	return { ok: true };
}

export async function listRoomsForUser(c: AppContext, userId: string, username: string) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const owned = await prisma.room.findMany({
		where: { ownerUserId: userId },
		select: { id: true, name: true },
		orderBy: { updatedAt: "desc" },
	});
	const memberships = await prisma.member.findMany({
		where: { displayName: username },
		select: { room: { select: { id: true, name: true, ownerUserId: true } } },
	});
	const joinedMap = new Map<string, { id: string; name: string }>();
	for (const m of memberships) {
		const r = m.room;
		if (r.ownerUserId !== userId) joinedMap.set(r.id, { id: r.id, name: r.name });
	}
	return {
		owned,
		joined: [...joinedMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
	};
}
