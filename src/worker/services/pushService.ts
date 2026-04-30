import prismaClients from "../lib/prismaClient";
import type { Bindings, PushSubscriptionInput, SendPayload, AppContext } from "../types";

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toBytes(value: string): Uint8Array {
	return new TextEncoder().encode(value);
}

function derToJose(der: Uint8Array, joseSize: number): Uint8Array {
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
	if (r.length > half || s.length > half) throw new Error("Invalid ECDSA signature: r/s length overflow");
	const out = new Uint8Array(joseSize);
	out.set(r, half - r.length);
	out.set(s, joseSize - s.length);
	return out;
}

async function createVapidJwt(endpoint: string, subject: string, privateJwkRaw: string): Promise<string> {
	const audience = new URL(endpoint).origin;
	const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
	const header = base64UrlEncode(toBytes(JSON.stringify({ typ: "JWT", alg: "ES256" })));
	const payload = base64UrlEncode(toBytes(JSON.stringify({ aud: audience, exp, sub: subject })));
	const signingInput = `${header}.${payload}`;
	const key = await crypto.subtle.importKey(
		"jwk",
		JSON.parse(privateJwkRaw),
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);
	const derSignature = new Uint8Array(
		await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, toBytes(signingInput)),
	);
	return `${signingInput}.${base64UrlEncode(derToJose(derSignature, 64))}`;
}

async function sendWebPush(subscription: PushSubscriptionInput, env: Bindings): Promise<Response> {
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_JWK || !env.VAPID_SUBJECT) {
		throw new Error("Missing VAPID secrets in Worker environment");
	}
	const jwt = await createVapidJwt(subscription.endpoint, env.VAPID_SUBJECT, env.VAPID_PRIVATE_JWK);
	return fetch(subscription.endpoint, {
		method: "POST",
		headers: {
			TTL: "60",
			Urgency: "normal",
			Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
			"Content-Type": "application/octet-stream",
			"Content-Length": "0",
		},
		body: "",
	});
}

export async function sendToProjectSubscribers(
	c: AppContext,
	roomId: string,
	payload: SendPayload,
) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const subscriptions = await prisma.subscription.findMany({ where: { roomId, status: "ACTIVE" } });
	const notification = await prisma.notification.create({
		data: { roomId, title: payload.title, body: payload.body, url: payload.url, status: "QUEUED" },
	});
	if (subscriptions.length === 0) {
		await prisma.notification.update({
			where: { id: notification.id },
			data: { status: "FAILED", sentAt: new Date() },
		});
		return { notificationId: notification.id, sent: 0, failed: 0 };
	}

	let sent = 0;
	let failed = 0;
	for (const sub of subscriptions) {
		try {
			const res = await sendWebPush(
				{ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, userAgent: sub.userAgent ?? undefined },
				c.env,
			);
			if (res.ok) {
				sent += 1;
				await prisma.deliveryLog.create({
					data: { notificationId: notification.id, subscriptionId: sub.id, status: "SENT" },
				});
			} else {
				failed += 1;
				const text = await res.text();
				await prisma.deliveryLog.create({
					data: {
						notificationId: notification.id,
						subscriptionId: sub.id,
						status: "FAILED",
						errorCode: String(res.status),
						errorMessage: text.slice(0, 500),
					},
				});
				if (res.status === 404 || res.status === 410) {
					await prisma.subscription.update({ where: { id: sub.id }, data: { status: "INVALID" } });
				}
			}
		} catch (error) {
			failed += 1;
			await prisma.deliveryLog.create({
				data: {
					notificationId: notification.id,
					subscriptionId: sub.id,
					status: "FAILED",
					errorMessage: error instanceof Error ? error.message.slice(0, 500) : "unknown",
				},
			});
		}
	}
	const status = failed === 0 ? "SENT" : sent > 0 ? "PARTIAL" : "FAILED";
	await prisma.notification.update({ where: { id: notification.id }, data: { status, sentAt: new Date() } });
	return { notificationId: notification.id, sent, failed, status };
}
