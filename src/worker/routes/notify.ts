import { Hono } from "hono";
import prismaClients from "../lib/prismaClient";
import { resolveApiProject, resolveDashboardProject } from "../lib/auth";
import { jsonError } from "../lib/http";
import { sanitizePayload } from "../lib/validators";
import { sendToProjectSubscribers } from "../services/pushService";
import type { AppEnv } from "../types";

const notifyApp = new Hono<AppEnv>();

notifyApp.post("/notify", async (c) => {
	const resolved = await resolveApiProject(c);
	if ("error" in resolved) return resolved.error;
	const payload = sanitizePayload(await c.req.json().catch(() => null));
	if (!payload) return jsonError("Invalid body", 400);
	const result = await sendToProjectSubscribers(c, resolved.project.id, payload);
	return c.json({ ok: true, ...result });
});

notifyApp.post("/dashboard/projects/:projectId/notifications", async (c) => {
	const projectId = c.req.param("projectId");
	const resolved = await resolveDashboardProject(c, projectId);
	if ("error" in resolved) return resolved.error;
	const payload = sanitizePayload(await c.req.json().catch(() => null));
	if (!payload) return jsonError("Invalid body", 400);
	const result = await sendToProjectSubscribers(c, projectId, payload, resolved.project.tenant.ownerUserId);
	return c.json({ ok: true, ...result });
});

notifyApp.get("/dashboard/projects/:projectId/notifications", async (c) => {
	const projectId = c.req.param("projectId");
	const resolved = await resolveDashboardProject(c, projectId);
	if ("error" in resolved) return resolved.error;
	const notifications = await resolved.prisma.notification.findMany({
		where: { projectId },
		orderBy: { createdAt: "desc" },
		take: 50,
	});
	return c.json({ items: notifications });
});

notifyApp.post("/dev/bootstrap", async (c) => {
	const prisma = await prismaClients.fetch(c.env.DB);
	const body = (await c.req.json().catch(() => ({}))) as {
		ownerEmail?: string;
		tenantName?: string;
		projectName?: string;
	};
	const ownerEmail = body.ownerEmail?.trim() || "owner@example.com";
	const tenantName = body.tenantName?.trim() || "Default Tenant";
	const projectName = body.projectName?.trim() || "Main App";
	const dashboardToken = crypto.randomUUID().replaceAll("-", "");
	const rawApiKey = crypto.randomUUID().replaceAll("-", "");
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawApiKey));
	const hashedKey = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
	const user = await prisma.user.upsert({
		where: { email: ownerEmail },
		update: { name: "Owner" },
		create: { email: ownerEmail, name: "Owner" },
	});
	const tenant = await prisma.tenant.create({
		data: {
			name: tenantName,
			ownerUserId: user.id,
			dashboardToken,
			members: { create: { userId: user.id, role: "OWNER" } },
		},
	});
	const project = await prisma.project.create({
		data: {
			name: projectName,
			slug: projectName.toLowerCase().replace(/\s+/g, "-"),
			tenantId: tenant.id,
			vapidPublicKey: c.env.VAPID_PUBLIC_KEY ?? "",
		},
	});
	await prisma.apiKey.create({ data: { projectId: project.id, name: "default", hashedKey } });
	return c.json({
		tenantId: tenant.id,
		projectId: project.id,
		dashboardToken,
		apiKey: rawApiKey,
	});
});

export default notifyApp;
