import prismaClients from "./prismaClient";
import { sha256Hex } from "./crypto";
import { jsonError } from "./http";
import { isRateLimited } from "./rateLimit";
import type { AppContext } from "../types";

export async function resolveApiProject(c: AppContext) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const apiKey = c.req.header("x-api-key");
	if (!apiKey) return { error: jsonError("Missing x-api-key", 401) };
	if (isRateLimited(`api:${apiKey}`, 20)) return { error: jsonError("Rate limit exceeded", 429) };
	const hashedKey = await sha256Hex(apiKey);
	const apiKeyRow = await prisma.apiKey.findFirst({
		where: { hashedKey, revokedAt: null },
		include: { project: true },
	});
	if (!apiKeyRow) return { error: jsonError("Invalid API key", 401) };
	await prisma.apiKey.update({
		where: { id: apiKeyRow.id },
		data: { lastUsedAt: new Date() },
	});
	return { prisma, project: apiKeyRow.project };
}

export async function resolveDashboardProject(c: AppContext, projectId: string) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const dashboardToken = c.req.header("x-dashboard-token");
	if (!dashboardToken) return { error: jsonError("Missing x-dashboard-token", 401) };
	if (isRateLimited(`dash:${dashboardToken}`, 30)) return { error: jsonError("Rate limit exceeded", 429) };
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		include: { tenant: true },
	});
	if (!project) return { error: jsonError("Project not found", 404) };
	if (project.tenant.dashboardToken !== dashboardToken) {
		return { error: jsonError("Unauthorized dashboard token", 401) };
	}
	return { prisma, project };
}
