import { Hono } from "hono";
import { jsonError } from "../lib/http";
import {
	readInviteBody,
	readJoinByNameBody,
	readJoinByTokenBody,
	readRoomCreateBody,
	readRoomJoinBody,
	sanitizeSubscription,
} from "../lib/validators";
import {
	createInviteToken,
	createRoom,
	getRoomStats,
	joinByName,
	joinByToken,
	upsertRoomSubscription,
} from "../services/roomService";
import type { AppEnv } from "../types";

const roomsApp = new Hono<AppEnv>();

roomsApp.post("/create", async (c) => {
	const body = readRoomCreateBody(await c.req.json().catch(() => null));
	if (!body) return jsonError("Invalid room create payload", 400);
	const room = await createRoom(c, body);
	return c.json({ ok: true, ...room });
});

roomsApp.post("/:roomId/join", async (c) => {
	const roomId = c.req.param("roomId");
	const body = readRoomJoinBody(await c.req.json().catch(() => null));
	if (!body) return jsonError("Invalid join payload", 400);
	const joined = await joinByName(c, roomId, body.password, body.displayName);
	if (joined === null) return jsonError("Room not found", 404);
	if (joined === false) return jsonError("Wrong password", 401);
	return c.json({ ok: true, ...joined });
});

roomsApp.post("/join-by-name", async (c) => {
	const body = readJoinByNameBody(await c.req.json().catch(() => null));
	if (!body) return jsonError("Invalid join payload", 400);
	const joined = await joinByName(c, body.roomName, body.password, body.displayName);
	if (joined === null) return jsonError("Room not found", 404);
	if (joined === false) return jsonError("Wrong password", 401);
	return c.json({ ok: true, ...joined });
});

roomsApp.post("/invite", async (c) => {
	const body = readInviteBody(await c.req.json().catch(() => null));
	if (!body) return jsonError("Invalid invite payload", 400);
	const dashboardToken = c.req.header("x-dashboard-token");
	if (!dashboardToken) return jsonError("Missing x-dashboard-token", 401);
	const invited = await createInviteToken(c, body.roomName, body.ttlMinutes, dashboardToken);
	if (!invited) return jsonError("Unauthorized or room not found", 401);
	return c.json({ ok: true, ...invited });
});

roomsApp.post("/join-by-token", async (c) => {
	const body = readJoinByTokenBody(await c.req.json().catch(() => null));
	if (!body) return jsonError("Invalid token join payload", 400);
	const joined = await joinByToken(c, body.token, body.displayName);
	if (!joined) return jsonError("Invite token invalid or expired", 401);
	return c.json({ ok: true, ...joined });
});

roomsApp.get("/:roomId/stats", async (c) => {
	const roomId = c.req.param("roomId");
	const stats = await getRoomStats(c, roomId);
	if (!stats) return jsonError("Room not found", 404);
	return c.json(stats);
});

roomsApp.post("/:roomId/subscribe", async (c) => {
	const roomId = c.req.param("roomId");
	const payload = sanitizeSubscription(await c.req.json().catch(() => null));
	if (!payload) return jsonError("Invalid subscription payload", 400);
	const result = await upsertRoomSubscription(c, roomId, payload, c.req.header("origin"));
	if ("error" in result) return jsonError(result.error, result.error === "Project not found" ? 404 : 403);
	return c.json({ ok: true });
});

export default roomsApp;
