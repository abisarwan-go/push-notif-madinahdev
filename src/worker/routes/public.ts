import { Hono } from "hono";
import prismaClients from "../lib/prismaClient";
import { jsonError } from "../lib/http";
import { sanitizeSubscription } from "../lib/validators";
import { upsertRoomSubscription } from "../services/roomService";
import type { AppEnv } from "../types";

const publicApp = new Hono<AppEnv>();

publicApp.get("/:projectId/config", async (c) => {
	const prisma = await prismaClients.fetch(c.env.DB);
	const project = await prisma.project.findUnique({
		where: { id: c.req.param("projectId") },
		select: { id: true, name: true, vapidPublicKey: true },
	});
	if (!project) return jsonError("Project not found", 404);
	return c.json(project);
});

publicApp.post("/:projectId/subscribe", async (c) => {
	const payload = sanitizeSubscription(await c.req.json().catch(() => null));
	if (!payload) return jsonError("Invalid subscription payload", 400);
	const result = await upsertRoomSubscription(
		c,
		c.req.param("projectId"),
		payload,
		c.req.header("origin"),
	);
	if ("error" in result) return jsonError(result.error, result.error === "Project not found" ? 404 : 403);
	return c.json({ ok: true });
});

publicApp.post("/:projectId/unsubscribe", async (c) => {
	const projectId = c.req.param("projectId");
	const body = (await c.req.json().catch(() => null)) as { endpoint?: string } | null;
	if (!body?.endpoint || !body.endpoint.trim()) return jsonError("Invalid payload", 400);
	const prisma = await prismaClients.fetch(c.env.DB);
	await prisma.subscriber.updateMany({
		where: { projectId, endpoint: body.endpoint.trim() },
		data: { status: "INACTIVE" },
	});
	return c.json({ ok: true });
});

export default publicApp;
