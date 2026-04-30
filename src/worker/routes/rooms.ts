import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z, type ZodSchema } from "zod";
import { isValidVapidPublicKey, slugify } from "../lib/crypto";
import { jsonError } from "../lib/http";
import {
	authHeaderSchema,
	ownerLoginSchema,
	roomCreateSchema,
	roomJoinSchema,
	roomSlugParamSchema,
	sendPayloadSchema,
	subscriptionSchema,
} from "../lib/validators";
import {
	createRoom,
	getRoomStats,
	joinByName,
	ownerLogin,
	upsertRoomSubscription,
	verifyOwnerToken,
} from "../services/roomService";
import { sendToProjectSubscribers } from "../services/pushService";
import { verifyUserToken } from "../services/userService";
import type { AppEnv } from "../types";

const roomsApp = new Hono<AppEnv>();

function getNormalizedRoomFromToken(payload: Record<string, unknown>): string {
	const rawRoomSlug = typeof payload.roomSlug === "string" ? payload.roomSlug : "";
	return slugify(rawRoomSlug);
}

const validateJson = (schema: ZodSchema, message: string) =>
	zValidator("json", schema, (result) => {
		if (!result.success) return jsonError(message, 400);
	});

const validateParam = (schema: ZodSchema) =>
	zValidator("param", schema, (result) => {
		if (!result.success) return jsonError("Invalid route params", 400);
	});

const validateHeader = (schema: ZodSchema) =>
	zValidator("header", schema, (result) => {
		if (!result.success) return jsonError("Missing owner token", 401);
	});

roomsApp.post(
	"/create",
	validateHeader(authHeaderSchema),
	validateJson(roomCreateSchema, "Invalid room create payload"),
	async (c) => {
	const { authorization } = c.req.valid("header") as z.infer<typeof authHeaderSchema>;
	if (!authorization.startsWith("Bearer ")) return jsonError("Missing user token", 401);
	const user = await verifyUserToken(c, authorization.slice("Bearer ".length));
	if (!user) return jsonError("Invalid user token", 401);
	const body = c.req.valid("json") as z.infer<typeof roomCreateSchema>;
	const room = await createRoom(c, user.userId, body);
	return c.json({ ok: true, ...room });
	},
);

roomsApp.post("/owner/login", validateJson(ownerLoginSchema, "Invalid owner login payload"), async (c) => {
	const body = c.req.valid("json") as z.infer<typeof ownerLoginSchema>;
	const logged = await ownerLogin(c, body.roomName, body.ownerPassword);
	if (logged === null) return jsonError("Room not found", 404);
	if (logged === false) return jsonError("Invalid owner password", 401);
	return c.json({ ok: true, ...logged });
});

roomsApp.post("/join", validateJson(roomJoinSchema, "Invalid join payload"), async (c) => {
	const body = c.req.valid("json") as z.infer<typeof roomJoinSchema>;
	const joined = await joinByName(c, body.roomName, body.joinPassword, body.displayName);
	if (joined === null) return jsonError("Room not found", 404);
	if (joined === false) return jsonError("Wrong join password", 401);
	return c.json({ ok: true, ...joined });
});

roomsApp.post(
	"/:roomSlug/subscribe",
	validateParam(roomSlugParamSchema),
	validateJson(subscriptionSchema, "Invalid subscription payload"),
	async (c) => {
		const roomSlug = (c.req.valid("param") as z.infer<typeof roomSlugParamSchema>).roomSlug;
		const payload = c.req.valid("json") as z.infer<typeof subscriptionSchema>;
	const result = await upsertRoomSubscription(c, roomSlug, payload, c.req.header("origin"));
	if ("error" in result) return jsonError(result.error, 404);
	return c.json({ ok: true });
	},
);

roomsApp.get("/:roomSlug/config", validateParam(roomSlugParamSchema), async (c) => {
	const roomSlug = (c.req.valid("param") as z.infer<typeof roomSlugParamSchema>).roomSlug;
	const stats = await getRoomStats(c, roomSlug);
	if (!stats) return jsonError("Room not found", 404);
	const vapidPublicKey = c.env.VAPID_PUBLIC_KEY?.trim();
	if (!isValidVapidPublicKey(vapidPublicKey)) {
		return jsonError("Push config invalid: VAPID_PUBLIC_KEY is missing or invalid", 500);
	}
	return c.json({ roomSlug: stats.roomSlug, roomName: stats.roomName, vapidPublicKey });
});

roomsApp.get("/:roomSlug/dashboard", validateParam(roomSlugParamSchema), validateHeader(authHeaderSchema), async (c) => {
	const { authorization } = c.req.valid("header") as z.infer<typeof authHeaderSchema>;
	if (!authorization.startsWith("Bearer ")) return jsonError("Missing owner token", 401);
	const payload = await verifyOwnerToken(c, authorization.slice("Bearer ".length));
	if (!payload) return jsonError("Invalid owner token", 401);
	const roomSlug = slugify((c.req.valid("param") as z.infer<typeof roomSlugParamSchema>).roomSlug);
	if (getNormalizedRoomFromToken(payload) !== roomSlug) return jsonError("Forbidden", 403);
	const stats = await getRoomStats(c, roomSlug);
	if (!stats) return jsonError("Room not found", 404);
	if (typeof payload.roomId === "string" && payload.roomId !== stats.roomId) return jsonError("Forbidden", 403);
	return c.json({ ok: true, ...stats });
});

roomsApp.post(
	"/:roomSlug/notifications",
	validateParam(roomSlugParamSchema),
	validateHeader(authHeaderSchema),
	validateJson(sendPayloadSchema, "Invalid body"),
	async (c) => {
		const { authorization } = c.req.valid("header") as z.infer<typeof authHeaderSchema>;
		if (!authorization.startsWith("Bearer ")) return jsonError("Missing owner token", 401);
		const payload = await verifyOwnerToken(c, authorization.slice("Bearer ".length));
	if (!payload) return jsonError("Invalid owner token", 401);
		const roomSlug = slugify((c.req.valid("param") as z.infer<typeof roomSlugParamSchema>).roomSlug);
	if (getNormalizedRoomFromToken(payload) !== roomSlug) return jsonError("Forbidden", 403);
	const roomStats = await getRoomStats(c, roomSlug);
	if (!roomStats) return jsonError("Room not found", 404);
	if (typeof payload.roomId === "string" && payload.roomId !== roomStats.roomId) return jsonError("Forbidden", 403);
		const body = c.req.valid("json") as z.infer<typeof sendPayloadSchema>;
	const result = await sendToProjectSubscribers(c, roomStats.roomId, body);
	return c.json({ ok: true, ...result });
	},
);

export default roomsApp;
