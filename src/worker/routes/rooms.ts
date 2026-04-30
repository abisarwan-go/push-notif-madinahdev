import { Hono } from "hono";
import { jsonError } from "../lib/http";
import {
	readOwnerLoginBody,
	readRoomCreateBody,
	readRoomJoinBody,
	sanitizePayload,
	sanitizeSubscription,
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
import type { AppEnv } from "../types";

const roomsApp = new Hono<AppEnv>();

roomsApp.post("/create", async (c) => {
	const body = readRoomCreateBody(await c.req.json().catch(() => null));
	if (!body) return jsonError("Invalid room create payload", 400);
	const room = await createRoom(c, body);
	return c.json({ ok: true, ...room });
});

roomsApp.post("/owner/login", async (c) => {
	const body = readOwnerLoginBody(await c.req.json().catch(() => null));
	if (!body) return jsonError("Invalid owner login payload", 400);
	const logged = await ownerLogin(c, body.roomName, body.ownerPassword);
	if (logged === null) return jsonError("Room not found", 404);
	if (logged === false) return jsonError("Invalid owner password", 401);
	return c.json({ ok: true, ...logged });
});

roomsApp.post("/join", async (c) => {
	const body = readRoomJoinBody(await c.req.json().catch(() => null));
	if (!body) return jsonError("Invalid join payload", 400);
	const joined = await joinByName(c, body.roomName, body.joinPassword, body.displayName);
	if (joined === null) return jsonError("Room not found", 404);
	if (joined === false) return jsonError("Wrong join password", 401);
	return c.json({ ok: true, ...joined });
});

roomsApp.post("/:roomSlug/subscribe", async (c) => {
	const roomSlug = c.req.param("roomSlug");
	const payload = sanitizeSubscription(await c.req.json().catch(() => null));
	if (!payload) return jsonError("Invalid subscription payload", 400);
	const result = await upsertRoomSubscription(c, roomSlug, payload, c.req.header("origin"));
	if ("error" in result) return jsonError(result.error, 404);
	return c.json({ ok: true });
});

roomsApp.get("/:roomSlug/config", async (c) => {
	const roomSlug = c.req.param("roomSlug");
	const stats = await getRoomStats(c, roomSlug);
	if (!stats) return jsonError("Room not found", 404);
	return c.json({ roomSlug: stats.roomSlug, roomName: stats.roomName, vapidPublicKey: c.env.VAPID_PUBLIC_KEY ?? "" });
});

roomsApp.get("/:roomSlug/dashboard", async (c) => {
	const auth = c.req.header("authorization");
	if (!auth?.startsWith("Bearer ")) return jsonError("Missing owner token", 401);
	const payload = await verifyOwnerToken(c, auth.slice("Bearer ".length));
	if (!payload) return jsonError("Invalid owner token", 401);
	const roomSlug = c.req.param("roomSlug");
	if (payload.roomSlug !== roomSlug) return jsonError("Forbidden", 403);
	const stats = await getRoomStats(c, roomSlug);
	if (!stats) return jsonError("Room not found", 404);
	return c.json({ ok: true, ...stats });
});

roomsApp.post("/:roomSlug/notifications", async (c) => {
	const auth = c.req.header("authorization");
	if (!auth?.startsWith("Bearer ")) return jsonError("Missing owner token", 401);
	const payload = await verifyOwnerToken(c, auth.slice("Bearer ".length));
	if (!payload) return jsonError("Invalid owner token", 401);
	const roomSlug = c.req.param("roomSlug");
	if (payload.roomSlug !== roomSlug) return jsonError("Forbidden", 403);
	const roomStats = await getRoomStats(c, roomSlug);
	if (!roomStats) return jsonError("Room not found", 404);
	const body = sanitizePayload(await c.req.json().catch(() => null));
	if (!body) return jsonError("Invalid body", 400);
	const result = await sendToProjectSubscribers(c, roomStats.roomId, body);
	return c.json({ ok: true, ...result });
});

export default roomsApp;
