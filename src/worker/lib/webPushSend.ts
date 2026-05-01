/**
 * Web Push outbound path uses `@block65/webcrypto-web-push` (MIT, github.com/block65/webcrypto-web-push).
 *
 * Why this instead of `web-push` (npm web-push-libs)?
 * - Same protocol: encrypted body + VAPID JWT, POST to the browser subscription `endpoint`.
 * - Implementation is Web Crypto + `fetch` only (no `jws` / Node `Readable` stack), so Vite + Cloudflare
 *   worker dev pre-bundling does not crash on `util.inherits` like `web-push` → `jws` did.
 *
 * VAPID shape for this library (see its `vapid.js`): `publicKey` = uncompressed P-256 point, base64url
 * (same as `VAPID_PUBLIC_KEY` today). `privateKey` must be the ES256 JWK **secret scalar `d`** as
 * base64url — i.e. the `d` field inside your existing `VAPID_PRIVATE_JWK` JSON (not a PEM string).
 */
import {
	buildPushPayload,
	type PushMessage,
	type PushSubscription,
	type VapidKeys,
} from "@block65/webcrypto-web-push";
import type { Bindings } from "../types";

export function vapidKeysFromEnv(env: Bindings): VapidKeys {
	const pub = env.VAPID_PUBLIC_KEY?.trim();
	const jwkRaw = env.VAPID_PRIVATE_JWK?.trim();
	const subject = env.VAPID_SUBJECT?.trim();
	if (!pub || !jwkRaw || !subject) {
		throw new Error("Missing VAPID secrets in Worker environment");
	}
	const jwk = JSON.parse(jwkRaw) as { d?: string };
	if (typeof jwk.d !== "string" || !jwk.d) {
		throw new Error("VAPID_PRIVATE_JWK must be a JWK with a base64url `d` field (ES256 private key)");
	}
	return { subject, publicKey: pub, privateKey: jwk.d };
}

export type PushPayloadData = {
	title: string;
	body: string;
	url: string;
	tag: string;
};

export async function postWebPushToSubscription(
	subscription: { endpoint: string; p256dh: string; auth: string },
	payloadJson: PushPayloadData,
	vapid: VapidKeys,
): Promise<Response> {
	const pushSubscription: PushSubscription = {
		endpoint: subscription.endpoint,
		expirationTime: null,
		keys: { p256dh: subscription.p256dh, auth: subscription.auth },
	};
	const message: PushMessage<PushPayloadData> = {
		data: payloadJson,
		options: { ttl: 60, urgency: "normal" },
	};
	const { method, headers, body } = await buildPushPayload(message, pushSubscription, vapid);
	return fetch(subscription.endpoint, {
		method,
		headers: headers as HeadersInit,
		body,
	});
}
