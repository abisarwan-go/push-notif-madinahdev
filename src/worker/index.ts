import { Hono, type Context } from "hono";
import prismaClients from "./lib/prismaClient";

type Bindings = {
	DB: D1Database;
	VAPID_PUBLIC_KEY?: string;
	VAPID_PRIVATE_JWK?: string;
	VAPID_SUBJECT?: string;
};

type PushSubscriptionInput = {
	endpoint: string;
	p256dh: string;
	auth: string;
	userAgent?: string;
};

type SendPayload = {
	title: string;
	body: string;
	url?: string;
};

const app = new Hono<{ Bindings: Bindings }>();
const inMemoryRateLimit = new Map<string, { count: number; windowStart: number }>();
type AppContext = Context<{ Bindings: Bindings }>;

function jsonError(message: string, status = 400) {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function isString(v: unknown): v is string {
	return typeof v === "string" && v.trim().length > 0;
}

function sanitizePayload(payload: unknown): SendPayload | null {
	if (!payload || typeof payload !== "object") return null;
	const body = payload as Partial<SendPayload>;
	if (!isString(body.title) || !isString(body.body)) return null;
	if (body.url && typeof body.url !== "string") return null;
	return {
		title: body.title.trim(),
		body: body.body.trim(),
		url: body.url?.trim(),
	};
}

function sanitizeSubscription(payload: unknown): PushSubscriptionInput | null {
	if (!payload || typeof payload !== "object") return null;
	const body = payload as Partial<PushSubscriptionInput>;
	if (!isString(body.endpoint) || !isString(body.p256dh) || !isString(body.auth)) return null;
	return {
		endpoint: body.endpoint.trim(),
		p256dh: body.p256dh.trim(),
		auth: body.auth.trim(),
		userAgent: typeof body.userAgent === "string" ? body.userAgent.slice(0, 300) : undefined,
	};
}

async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isRateLimited(bucketId: string, limitPerMinute = 30): boolean {
	const now = Date.now();
	const slot = inMemoryRateLimit.get(bucketId);
	if (!slot || now - slot.windowStart >= 60_000) {
		inMemoryRateLimit.set(bucketId, { count: 1, windowStart: now });
		return false;
	}
	slot.count += 1;
	return slot.count > limitPerMinute;
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toBytes(value: string): Uint8Array {
	return new TextEncoder().encode(value);
}

function derToJose(der: Uint8Array, joseSize: number): Uint8Array {
	// Some runtimes may already return raw JOSE (r||s).
	if (der.length === joseSize) return der;

	const half = joseSize / 2;
	let offset = 0;

	const readLen = () => {
		const first = der[offset++];
		if (first === undefined) throw new Error("Invalid ECDSA signature: unexpected end");
		if ((first & 0x80) === 0) return first;
		const byteCount = first & 0x7f;
		if (byteCount === 0 || byteCount > 2) {
			throw new Error("Invalid ECDSA signature: unsupported DER length");
		}
		let len = 0;
		for (let i = 0; i < byteCount; i++) {
			const next = der[offset++];
			if (next === undefined) throw new Error("Invalid ECDSA signature: bad length");
			len = (len << 8) | next;
		}
		return len;
	};

	if (der[offset++] !== 0x30) throw new Error("Invalid ECDSA signature: missing sequence");
	const seqLen = readLen();
	if (seqLen > der.length - offset) throw new Error("Invalid ECDSA signature: sequence length");

	if (der[offset++] !== 0x02) throw new Error("Invalid ECDSA signature: missing r integer");
	const rLen = readLen();
	let r = der.slice(offset, offset + rLen);
	offset += rLen;

	if (der[offset++] !== 0x02) throw new Error("Invalid ECDSA signature: missing s integer");
	const sLen = readLen();
	let s = der.slice(offset, offset + sLen);

	while (r.length > half && r[0] === 0) r = r.slice(1);
	while (s.length > half && s[0] === 0) s = s.slice(1);
	if (r.length > half || s.length > half) {
		throw new Error("Invalid ECDSA signature: r/s length overflow");
	}

	const out = new Uint8Array(joseSize);
	out.set(r, half - r.length);
	out.set(s, joseSize - s.length);
	return out;
}

async function createVapidJwt(
	endpoint: string,
	subject: string,
	privateJwkRaw: string,
): Promise<string> {
	const audience = new URL(endpoint).origin;
	const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
	const header = base64UrlEncode(toBytes(JSON.stringify({ typ: "JWT", alg: "ES256" })));
	const payload = base64UrlEncode(
		toBytes(
			JSON.stringify({
				aud: audience,
				exp,
				sub: subject,
			}),
		),
	);
	const signingInput = `${header}.${payload}`;

	const key = await crypto.subtle.importKey(
		"jwk",
		JSON.parse(privateJwkRaw),
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);
	const derSignature = new Uint8Array(
		await crypto.subtle.sign(
			{ name: "ECDSA", hash: "SHA-256" },
			key,
			toBytes(signingInput),
		),
	);
	const jose = derToJose(derSignature, 64);
	return `${signingInput}.${base64UrlEncode(jose)}`;
}

async function sendWebPush(
	subscription: PushSubscriptionInput,
	env: Bindings,
): Promise<Response> {
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_JWK || !env.VAPID_SUBJECT) {
		throw new Error("Missing VAPID secrets in Worker environment");
	}

	const jwt = await createVapidJwt(
		subscription.endpoint,
		env.VAPID_SUBJECT,
		env.VAPID_PRIVATE_JWK,
	);

	return fetch(subscription.endpoint, {
		method: "POST",
		headers: {
			TTL: "60",
			Urgency: "normal",
			Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
			"Content-Type": "application/octet-stream",
			// Empty payload keeps MVP simple. UI message is rendered by SW fallback text.
			"Content-Length": "0",
		},
		body: "",
	});
}

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

app.post("/v1/dev/bootstrap", async (c) => {
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
	const hashedKey = await sha256Hex(rawApiKey);

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
			members: {
				create: {
					userId: user.id,
					role: "OWNER",
				},
			},
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

	await prisma.apiKey.create({
		data: {
			projectId: project.id,
			name: "default",
			hashedKey,
		},
	});

	return c.json({
		tenantId: tenant.id,
		projectId: project.id,
		dashboardToken,
		apiKey: rawApiKey,
	});
});

app.get("/v1/public/:projectId/config", async (c) => {
	const prisma = await prismaClients.fetch(c.env.DB);
	const projectId = c.req.param("projectId");
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: { id: true, name: true, vapidPublicKey: true },
	});
	if (!project) return jsonError("Project not found", 404);
	return c.json(project);
});

app.post("/v1/public/:projectId/subscribe", async (c) => {
	const prisma = await prismaClients.fetch(c.env.DB);
	const projectId = c.req.param("projectId");
	const payload = sanitizeSubscription(await c.req.json().catch(() => null));
	if (!payload) return jsonError("Invalid subscription payload", 400);

	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: { id: true, allowedOrigin: true },
	});
	if (!project) return jsonError("Project not found", 404);

	const origin = c.req.header("origin");
	if (project.allowedOrigin && origin !== project.allowedOrigin) {
		return jsonError("Origin not allowed", 403);
	}

	await prisma.subscriber.upsert({
		where: { endpoint: payload.endpoint },
		update: {
			projectId,
			p256dh: payload.p256dh,
			auth: payload.auth,
			userAgent: payload.userAgent,
			status: "ACTIVE",
			lastSeenAt: new Date(),
		},
		create: {
			projectId,
			endpoint: payload.endpoint,
			p256dh: payload.p256dh,
			auth: payload.auth,
			userAgent: payload.userAgent,
		},
	});

	return c.json({ ok: true });
});

app.post("/v1/public/:projectId/unsubscribe", async (c) => {
	const prisma = await prismaClients.fetch(c.env.DB);
	const projectId = c.req.param("projectId");
	const body = (await c.req.json().catch(() => null)) as { endpoint?: string } | null;
	if (!body || !isString(body.endpoint)) return jsonError("Invalid payload", 400);

	await prisma.subscriber.updateMany({
		where: { projectId, endpoint: body.endpoint.trim() },
		data: { status: "INACTIVE" },
	});
	return c.json({ ok: true });
});

async function resolveApiProject(c: AppContext) {
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

async function sendToProjectSubscribers(
	c: AppContext,
	projectId: string,
	payload: SendPayload,
	createdById?: string,
) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const subscribers = await prisma.subscriber.findMany({
		where: { projectId, status: "ACTIVE" },
	});

	const notification = await prisma.notification.create({
		data: {
			projectId,
			createdById,
			title: payload.title,
			body: payload.body,
			url: payload.url,
			status: "QUEUED",
		},
	});

	if (subscribers.length === 0) {
		await prisma.notification.update({
			where: { id: notification.id },
			data: { status: "FAILED", sentAt: new Date() },
		});
		return { notificationId: notification.id, sent: 0, failed: 0 };
	}

	let sent = 0;
	let failed = 0;

	for (const sub of subscribers) {
		try {
			const res = await sendWebPush(
				{
					endpoint: sub.endpoint,
					p256dh: sub.p256dh,
					auth: sub.auth,
					userAgent: sub.userAgent ?? undefined,
				},
				c.env,
			);
			if (res.ok) {
				sent += 1;
				await prisma.deliveryLog.create({
					data: {
						notificationId: notification.id,
						subscriberId: sub.id,
						status: "SENT",
					},
				});
			} else {
				failed += 1;
				const text = await res.text();
				await prisma.deliveryLog.create({
					data: {
						notificationId: notification.id,
						subscriberId: sub.id,
						status: "FAILED",
						errorCode: String(res.status),
						errorMessage: text.slice(0, 500),
					},
				});
				if (res.status === 404 || res.status === 410) {
					await prisma.subscriber.update({
						where: { id: sub.id },
						data: { status: "INVALID" },
					});
				}
			}
		} catch (error) {
			failed += 1;
			await prisma.deliveryLog.create({
				data: {
					notificationId: notification.id,
					subscriberId: sub.id,
					status: "FAILED",
					errorMessage: error instanceof Error ? error.message.slice(0, 500) : "unknown",
				},
			});
		}
	}

	const status = failed === 0 ? "SENT" : sent > 0 ? "PARTIAL" : "FAILED";
	await prisma.notification.update({
		where: { id: notification.id },
		data: { status, sentAt: new Date() },
	});
	return { notificationId: notification.id, sent, failed, status };
}

app.post("/v1/notify", async (c) => {
	const resolved = await resolveApiProject(c);
	if (resolved.error) return resolved.error;

	const payload = sanitizePayload(await c.req.json().catch(() => null));
	if (!payload) return jsonError("Invalid body", 400);

	const result = await sendToProjectSubscribers(c, resolved.project.id, payload);
	return c.json({ ok: true, ...result });
});

app.post("/v1/dashboard/projects/:projectId/notifications", async (c) => {
	const prisma = await prismaClients.fetch(c.env.DB);
	const projectId = c.req.param("projectId");
	const dashboardToken = c.req.header("x-dashboard-token");
	if (!dashboardToken) return jsonError("Missing x-dashboard-token", 401);
	if (isRateLimited(`dash:${dashboardToken}`, 30)) return jsonError("Rate limit exceeded", 429);

	const project = await prisma.project.findUnique({
		where: { id: projectId },
		include: { tenant: true },
	});
	if (!project) return jsonError("Project not found", 404);
	if (project.tenant.dashboardToken !== dashboardToken) {
		return jsonError("Unauthorized dashboard token", 401);
	}

	const payload = sanitizePayload(await c.req.json().catch(() => null));
	if (!payload) return jsonError("Invalid body", 400);
	const result = await sendToProjectSubscribers(c, projectId, payload, project.tenant.ownerUserId);
	return c.json({ ok: true, ...result });
});

app.get("/v1/dashboard/projects/:projectId/notifications", async (c) => {
	const prisma = await prismaClients.fetch(c.env.DB);
	const projectId = c.req.param("projectId");
	const dashboardToken = c.req.header("x-dashboard-token");
	if (!dashboardToken) return jsonError("Missing x-dashboard-token", 401);

	const project = await prisma.project.findUnique({
		where: { id: projectId },
		include: { tenant: true },
	});
	if (!project) return jsonError("Project not found", 404);
	if (project.tenant.dashboardToken !== dashboardToken) {
		return jsonError("Unauthorized dashboard token", 401);
	}

	const notifications = await prisma.notification.findMany({
		where: { projectId },
		orderBy: { createdAt: "desc" },
		take: 50,
	});
	return c.json({ items: notifications });
});

export default app;
