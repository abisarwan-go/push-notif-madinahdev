import prismaClients from "../lib/prismaClient";
import { randomToken, sha256Hex, signJwtHS256, slugify, verifyJwtHS256 } from "../lib/crypto";
import type { AppContext, PushSubscriptionInput } from "../types";

export async function createRoom(
	c: AppContext,
	ownerUserId: string,
	input: { roomName: string; joinPassword?: string; ownerDisplayName: string },
) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const ownerPasswordHash = await sha256Hex(randomToken(32));
	const joinPasswordHash = input.joinPassword ? await sha256Hex(input.joinPassword) : null;
	const slugBase = slugify(input.roomName) || "room";
	let slug = slugBase;
	let idx = 1;
	while (await prisma.room.findFirst({ where: { slug } })) {
		idx += 1;
		slug = `${slugBase}-${idx}`;
	}
	const room = await prisma.room.create({
		data: {
			name: input.roomName,
			slug,
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
		roomSlug: room.slug,
	};
}

export async function ownerLogin(c: AppContext, roomName: string, ownerPassword: string) {
	if (!c.env.ROOM_OWNER_JWT_SECRET) throw new Error("Missing ROOM_OWNER_JWT_SECRET");
	const prisma = await prismaClients.fetch(c.env.DB);
	const slug = slugify(roomName);
	const room = await prisma.room.findFirst({ where: { slug } });
	if (!room) return null;
	const hash = await sha256Hex(ownerPassword);
	if (hash !== room.ownerPasswordHash) return false;
	const token = await signJwtHS256({ roomId: room.id, roomSlug: room.slug }, c.env.ROOM_OWNER_JWT_SECRET, 7 * 24 * 60 * 60);
	return { token, expiresInSec: 7 * 24 * 60 * 60, roomSlug: room.slug, roomName: room.name };
}

export async function joinByName(
	c: AppContext,
	roomName: string,
	joinPassword: string | undefined,
	displayName: string,
) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const slug = slugify(roomName);
	const room = await prisma.room.findFirst({ where: { slug } });
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
	return { memberId: member.id, roomId: room.id, roomSlug: room.slug, roomName: room.name, displayName };
}

export async function verifyOwnerToken(c: AppContext, token: string) {
	if (!c.env.ROOM_OWNER_JWT_SECRET) return null;
	return verifyJwtHS256(token, c.env.ROOM_OWNER_JWT_SECRET);
}

export async function getRoomStats(c: AppContext, roomSlug: string) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const room = await prisma.room.findFirst({ where: { slug: slugify(roomSlug) } });
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
		roomSlug: room.slug,
		membersCount,
		activeSubscriptions,
		notifications,
	};
}

export async function isRoomOwnedByUser(c: AppContext, roomSlug: string, userId: string): Promise<boolean> {
	const prisma = await prismaClients.fetch(c.env.DB);
	const room = await prisma.room.findFirst({
		where: { slug: slugify(roomSlug) },
		select: { ownerUserId: true },
	});
	return !!room && room.ownerUserId === userId;
}

export async function upsertRoomSubscription(
	c: AppContext,
	roomSlug: string,
	payload: PushSubscriptionInput,
	origin?: string,
): Promise<{ ok: true } | { error: string }> {
	const prisma = await prismaClients.fetch(c.env.DB);
	const room = await prisma.room.findFirst({
		where: { slug: slugify(roomSlug) },
		select: { id: true },
	});
	if (!room) return { error: "Room not found" };
	void origin; // reserved for future origin policy.
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
