import prismaClients from "../lib/prismaClient";
import { sha256Hex, signJwtHS256, verifyJwtHS256 } from "../lib/crypto";
import type { AppContext } from "../types";

const USER_JWT_TTL_SECONDS = 7 * 24 * 60 * 60;

function resolveUserJwtSecret(c: AppContext): string {
	const secret = c.env.USER_JWT_SECRET ?? c.env.ROOM_OWNER_JWT_SECRET;
	if (!secret) throw new Error("Missing USER_JWT_SECRET");
	return secret;
}

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: string }).code === "P2002"
	);
}

export async function registerUser(c: AppContext, username: string, password: string) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const passwordHash = await sha256Hex(password);
	try {
		const user = await prisma.user.create({
			data: {
				username,
				passwordHash,
			},
			select: { id: true, username: true },
		});
		const token = await signJwtHS256(
			{ userId: user.id, username: user.username },
			resolveUserJwtSecret(c),
			USER_JWT_TTL_SECONDS,
		);
		return { ok: true as const, user, token, expiresInSec: USER_JWT_TTL_SECONDS };
	} catch (error) {
		if (isUniqueViolation(error)) return { ok: false as const, reason: "USERNAME_TAKEN" };
		throw error;
	}
}

export async function loginUser(c: AppContext, username: string, password: string) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const user = await prisma.user.findUnique({
		where: { username },
		select: { id: true, username: true, passwordHash: true },
	});
	if (!user) return null;
	const passwordHash = await sha256Hex(password);
	if (passwordHash !== user.passwordHash) return false;
	const token = await signJwtHS256(
		{ userId: user.id, username: user.username },
		resolveUserJwtSecret(c),
		USER_JWT_TTL_SECONDS,
	);
	return { user: { id: user.id, username: user.username }, token, expiresInSec: USER_JWT_TTL_SECONDS };
}

export async function verifyUserToken(c: AppContext, token: string) {
	const payload = await verifyJwtHS256(token, resolveUserJwtSecret(c));
	if (!payload) return null;
	const userId = typeof payload.userId === "string" ? payload.userId : null;
	const username = typeof payload.username === "string" ? payload.username : null;
	if (!userId || !username) return null;
	return { userId, username };
}
