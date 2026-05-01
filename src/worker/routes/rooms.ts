import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z, type ZodSchema } from "zod";
import { isValidVapidPublicKey } from "../lib/crypto";
import { jsonError } from "../lib/http";
import {
	authHeaderSchema,
	ownerLoginSchema,
	roomCreateSchema,
	roomJoinSchema,
	roomNameParamSchema,
	sendPayloadSchema,
	subscriptionSchema,
} from "../lib/validators";
import {
	createRoom,
	getDashboardViewerRole,
	getRoomStats,
	isRoomOwnedByUser,
	joinByName,
	listRoomsForUser,
	ownerLogin,
	rotateRoomIntegrationSecret,
	upsertRoomSubscription,
	verifyRoomIntegrationSecret,
} from "../services/roomService";
import { sendToProjectSubscribers } from "../services/pushService";
import { verifyUserToken } from "../services/userService";
import type { AppEnv } from "../types";

const roomsApp = new Hono<AppEnv>();

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
		if (!result.success) return jsonError("Missing Authorization header", 401);
	});

roomsApp.get("/mine", validateHeader(authHeaderSchema), async (c) => {
	const { authorization } = c.req.valid("header") as z.infer<typeof authHeaderSchema>;
	if (!authorization.startsWith("Bearer ")) return jsonError("Missing user token", 401);
	const user = await verifyUserToken(c, authorization.slice("Bearer ".length));
	if (!user) return jsonError("Invalid user token", 401);
	const lists = await listRoomsForUser(c, user.userId, user.username);
	return c.json({ ok: true, ...lists });
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
		try {
			const room = await createRoom(c, user.userId, {
				...body,
				ownerDisplayName: user.username,
			});
			return c.json({ ok: true, ...room });
		} catch (err) {
			if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "ROOM_NAME_TAKEN") {
				return jsonError("Room name already taken", 409);
			}
			throw err;
		}
	},
);

roomsApp.post("/owner/login", validateJson(ownerLoginSchema, "Invalid owner login payload"), async (c) => {
	const body = c.req.valid("json") as z.infer<typeof ownerLoginSchema>;
	const logged = await ownerLogin(c, body.roomName, body.ownerPassword);
	if (logged === null) return jsonError("Room not found", 404);
	if (logged === false) return jsonError("Invalid owner password", 401);
	return c.json({ ok: true, ...logged });
});

roomsApp.post(
	"/join",
	validateHeader(authHeaderSchema),
	validateJson(roomJoinSchema, "Invalid join payload"),
	async (c) => {
		const { authorization } = c.req.valid("header") as z.infer<typeof authHeaderSchema>;
		if (!authorization.startsWith("Bearer ")) return jsonError("Missing user token", 401);
		const user = await verifyUserToken(c, authorization.slice("Bearer ".length));
		if (!user) return jsonError("Invalid user token", 401);
		const body = c.req.valid("json") as z.infer<typeof roomJoinSchema>;
		const joined = await joinByName(c, body.roomName, body.joinPassword, user.username);
		if (joined === null) return jsonError("Room not found", 404);
		if (joined === false) return jsonError("Wrong join password", 401);
		return c.json({ ok: true, ...joined });
	},
);

roomsApp.post(
	"/:roomName/subscribe",
	validateParam(roomNameParamSchema),
	validateJson(subscriptionSchema, "Invalid subscription payload"),
	async (c) => {
		const roomName = (c.req.valid("param") as z.infer<typeof roomNameParamSchema>).roomName;
		const payload = c.req.valid("json") as z.infer<typeof subscriptionSchema>;
		const result = await upsertRoomSubscription(c, roomName, payload, c.req.header("origin"));
		if ("error" in result) return jsonError(result.error, 404);
		return c.json({ ok: true });
	},
);

roomsApp.get("/:roomName/config", validateParam(roomNameParamSchema), async (c) => {
	const roomName = (c.req.valid("param") as z.infer<typeof roomNameParamSchema>).roomName;
	const stats = await getRoomStats(c, roomName);
	if (!stats) return jsonError("Room not found", 404);
	const vapidPublicKey = c.env.VAPID_PUBLIC_KEY?.trim();
	if (!isValidVapidPublicKey(vapidPublicKey)) {
		return jsonError("Push config invalid: VAPID_PUBLIC_KEY is missing or invalid", 500);
	}
	return c.json({ roomName: stats.roomName, vapidPublicKey });
});

roomsApp.get("/:roomName/dashboard", validateParam(roomNameParamSchema), validateHeader(authHeaderSchema), async (c) => {
	const { authorization } = c.req.valid("header") as z.infer<typeof authHeaderSchema>;
	if (!authorization.startsWith("Bearer ")) return jsonError("Missing user token", 401);
	const user = await verifyUserToken(c, authorization.slice("Bearer ".length));
	if (!user) return jsonError("Invalid user token", 401);
	const roomName = (c.req.valid("param") as z.infer<typeof roomNameParamSchema>).roomName;
	const viewerRole = await getDashboardViewerRole(c, roomName, user.userId, user.username);
	if (!viewerRole) return jsonError("Forbidden", 403);
	const stats = await getRoomStats(c, roomName);
	if (!stats) return jsonError("Room not found", 404);
	return c.json({ ok: true, viewerRole, ...stats });
});

roomsApp.post(
	"/:roomName/integrations/rotate",
	validateParam(roomNameParamSchema),
	validateHeader(authHeaderSchema),
	async (c) => {
		const { authorization } = c.req.valid("header") as z.infer<typeof authHeaderSchema>;
		if (!authorization.startsWith("Bearer ")) return jsonError("Missing user token", 401);
		const user = await verifyUserToken(c, authorization.slice("Bearer ".length));
		if (!user) return jsonError("Invalid user token", 401);
		const roomName = (c.req.valid("param") as z.infer<typeof roomNameParamSchema>).roomName;
		const owned = await isRoomOwnedByUser(c, roomName, user.userId);
		if (!owned) return jsonError("Forbidden", 403);
		const out = await rotateRoomIntegrationSecret(c, roomName, user.userId);
		if (!out) return jsonError("Room not found", 404);
		const pushPath = `/v1/rooms/${encodeURIComponent(out.roomName)}/integrations/push`;
		return c.json({
			ok: true,
			secret: out.secret,
			roomName: out.roomName,
			integrationPath: pushPath,
			hint: "Store the secret in n8n credentials; it is shown only this once.",
		});
	},
);

roomsApp.post(
	"/:roomName/integrations/push",
	validateParam(roomNameParamSchema),
	validateJson(sendPayloadSchema, "Invalid body"),
	async (c) => {
		const secret = c.req.header("x-room-integration-secret")?.trim();
		if (!secret) return jsonError("Missing X-Room-Integration-Secret header", 401);
		const roomName = (c.req.valid("param") as z.infer<typeof roomNameParamSchema>).roomName;
		const verified = await verifyRoomIntegrationSecret(c, roomName, secret);
		if (!verified) return jsonError("Invalid integration secret", 401);
		const body = c.req.valid("json") as z.infer<typeof sendPayloadSchema>;
		const result = await sendToProjectSubscribers(c, verified.roomId, verified.roomName, body);
		return c.json({ ok: true, ...result });
	},
);

roomsApp.post(
	"/:roomName/notifications",
	validateParam(roomNameParamSchema),
	validateHeader(authHeaderSchema),
	validateJson(sendPayloadSchema, "Invalid body"),
	async (c) => {
		const { authorization } = c.req.valid("header") as z.infer<typeof authHeaderSchema>;
		if (!authorization.startsWith("Bearer ")) return jsonError("Missing user token", 401);
		const user = await verifyUserToken(c, authorization.slice("Bearer ".length));
		if (!user) return jsonError("Invalid user token", 401);
		const roomName = (c.req.valid("param") as z.infer<typeof roomNameParamSchema>).roomName;
		const owned = await isRoomOwnedByUser(c, roomName, user.userId);
		if (!owned) return jsonError("Forbidden", 403);
		const roomStats = await getRoomStats(c, roomName);
		if (!roomStats) return jsonError("Room not found", 404);
		const body = c.req.valid("json") as z.infer<typeof sendPayloadSchema>;
		const result = await sendToProjectSubscribers(c, roomStats.roomId, roomStats.roomName, body);
		return c.json({ ok: true, ...result });
	},
);

export default roomsApp;
