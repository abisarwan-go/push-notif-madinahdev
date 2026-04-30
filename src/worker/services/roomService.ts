import prismaClients from "../lib/prismaClient";
import { fromBase64Url, randomToken, sha256Hex, signHmacSha256, slugify, toBase64Url } from "../lib/crypto";
import type { AppContext, PushSubscriptionInput } from "../types";

export async function createRoom(
	c: AppContext,
	input: { roomName: string; password: string; ownerName: string; ownerEmail: string },
) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const roomPasswordHash = await sha256Hex(input.password);
	const dashboardToken = randomToken(32);
	const rawApiKey = randomToken(32);
	const hashedKey = await sha256Hex(rawApiKey);
	const user = await prisma.user.upsert({
		where: { email: input.ownerEmail },
		update: { name: input.ownerName },
		create: { email: input.ownerEmail, name: input.ownerName },
	});
	const tenant = await prisma.tenant.create({
		data: {
			name: `${input.ownerName}'s space`,
			ownerUserId: user.id,
			dashboardToken,
			members: { create: { userId: user.id, role: "OWNER" } },
		},
	});

	const slugBase = slugify(input.roomName) || "room";
	let slug = slugBase;
	let idx = 1;
	while (await prisma.project.findFirst({ where: { roomSlug: slug } })) {
		idx += 1;
		slug = `${slugBase}-${idx}`;
	}

	const roomJoinCode = randomToken(8);
	const project = await prisma.project.create({
		data: {
			name: input.roomName,
			slug,
			roomSlug: slug,
			tenantId: tenant.id,
			vapidPublicKey: c.env.VAPID_PUBLIC_KEY ?? "",
			isRoomMode: true,
			roomPasswordHash,
			roomJoinCode,
		},
	});
	await prisma.apiKey.create({ data: { projectId: project.id, name: "room-default", hashedKey } });
	return {
		roomId: project.id,
		roomName: project.name,
		roomSlug: project.roomSlug,
		roomJoinCode,
		memberId: randomToken(10),
		dashboardToken,
		apiKey: rawApiKey,
	};
}

export async function joinByName(c: AppContext, roomName: string, password: string, displayName: string) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const slug = slugify(roomName);
	const room = await prisma.project.findFirst({ where: { OR: [{ roomSlug: slug }, { id: roomName }] } });
	if (!room || !room.isRoomMode || !room.roomPasswordHash) return null;
	const inputHash = await sha256Hex(password);
	if (inputHash !== room.roomPasswordHash) return false;
	const memberId = randomToken(10);
	return { memberId, roomName: room.name, roomSlug: room.roomSlug ?? room.slug, projectId: room.id, displayName };
}

async function findRoomByIdentifier(c: AppContext, roomIdentifier: string) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const slug = slugify(roomIdentifier);
	const room = await prisma.project.findFirst({
		where: { OR: [{ id: roomIdentifier }, { roomSlug: slug }, { slug: slug }] },
		include: { tenant: true },
	});
	return room;
}

export async function getRoomStats(c: AppContext, roomIdentifier: string) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const room = await findRoomByIdentifier(c, roomIdentifier);
	if (!room || !room.isRoomMode) return null;
	const membersCount = await prisma.subscriber
		.findMany({
			where: { projectId: room.id, status: "ACTIVE", memberId: { not: null } },
			select: { memberId: true },
			distinct: ["memberId"],
		})
		.then((rows) => rows.length);
	const activeSubscribers = await prisma.subscriber.count({ where: { projectId: room.id, status: "ACTIVE" } });
	return { roomId: room.id, roomName: room.name, roomSlug: room.roomSlug ?? room.slug, membersCount, activeSubscribers };
}

export async function createInviteToken(
	c: AppContext,
	roomName: string,
	ttlMinutes: number,
	dashboardToken: string,
) {
	if (!c.env.ROOM_INVITE_SECRET) throw new Error("Missing ROOM_INVITE_SECRET");
	const room = await findRoomByIdentifier(c, roomName);
	if (!room || !room.roomSlug || !room.tenant || room.tenant.dashboardToken !== dashboardToken) return null;
	const exp = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
	const payload = toBase64Url(JSON.stringify({ roomSlug: room.roomSlug, exp }));
	const sig = await signHmacSha256(payload, c.env.ROOM_INVITE_SECRET);
	return {
		token: `${payload}.${sig}`,
		expiresAt: new Date(exp * 1000).toISOString(),
		roomSlug: room.roomSlug,
	};
}

export async function joinByToken(c: AppContext, token: string, displayName: string) {
	if (!c.env.ROOM_INVITE_SECRET) throw new Error("Missing ROOM_INVITE_SECRET");
	const [payload, signature] = token.split(".");
	if (!payload || !signature) return null;
	const expected = await signHmacSha256(payload, c.env.ROOM_INVITE_SECRET);
	if (expected !== signature) return null;
	const parsed = JSON.parse(fromBase64Url(payload)) as { roomSlug?: string; exp?: number };
	if (!parsed.roomSlug || !parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
	const room = await findRoomByIdentifier(c, parsed.roomSlug);
	if (!room || !room.isRoomMode) return null;
	return {
		memberId: randomToken(10),
		projectId: room.id,
		roomName: room.name,
		roomSlug: room.roomSlug ?? room.slug,
		displayName,
	};
}

export async function upsertRoomSubscription(
	c: AppContext,
	roomIdentifier: string,
	payload: PushSubscriptionInput,
	origin?: string,
): Promise<{ ok: true } | { error: string }> {
	const prisma = await prismaClients.fetch(c.env.DB);
	const slug = slugify(roomIdentifier);
	const project = await prisma.project.findFirst({
		where: { OR: [{ id: roomIdentifier }, { roomSlug: slug }, { slug }] },
		select: { id: true, allowedOrigin: true },
	});
	if (!project) return { error: "Project not found" };
	if (project.allowedOrigin && origin !== project.allowedOrigin) return { error: "Origin not allowed" };
	await prisma.subscriber.upsert({
		where: { endpoint: payload.endpoint },
		update: {
			projectId: project.id,
			p256dh: payload.p256dh,
			auth: payload.auth,
			userAgent: payload.userAgent,
			memberId: payload.memberId,
			displayName: payload.displayName,
			status: "ACTIVE",
			lastSeenAt: new Date(),
		},
		create: {
			projectId: project.id,
			endpoint: payload.endpoint,
			p256dh: payload.p256dh,
			auth: payload.auth,
			userAgent: payload.userAgent,
			memberId: payload.memberId,
			displayName: payload.displayName,
		},
	});
	return { ok: true };
}
