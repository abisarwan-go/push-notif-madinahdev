export async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
	const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
	const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
	const bin = atob(base64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

export function isValidVapidPublicKey(value: string | undefined): boolean {
	if (!value) return false;
	const trimmed = value.trim();
	if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return false;
	try {
		const bytes = base64UrlToBytes(trimmed);
		// Web Push VAPID public key must be uncompressed P-256 EC point: 65 bytes, 0x04 prefix.
		return bytes.length === 65 && bytes[0] === 0x04;
	} catch {
		return false;
	}
}

export function toBase64Url(input: string): string {
	return bytesToBase64Url(new TextEncoder().encode(input));
}

export function fromBase64Url(input: string): string {
	return new TextDecoder().decode(base64UrlToBytes(input));
}

export async function signHmacSha256(input: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
	return bytesToBase64Url(new Uint8Array(signature));
}

export async function signJwtHS256(
	payload: Record<string, unknown>,
	secret: string,
	expiresInSeconds: number,
): Promise<string> {
	const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const now = Math.floor(Date.now() / 1000);
	const body = toBase64Url(
		JSON.stringify({
			...payload,
			iat: now,
			exp: now + expiresInSeconds,
		}),
	);
	const signature = await signHmacSha256(`${header}.${body}`, secret);
	return `${header}.${body}.${signature}`;
}

export async function verifyJwtHS256(
	token: string,
	secret: string,
): Promise<Record<string, unknown> | null> {
	const [header, body, signature] = token.split(".");
	if (!header || !body || !signature) return null;
	const expected = await signHmacSha256(`${header}.${body}`, secret);
	if (expected !== signature) return null;
	const parsed = JSON.parse(fromBase64Url(body)) as { exp?: number } & Record<string, unknown>;
	if (!parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
	return parsed;
}

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

export function randomToken(size = 24): string {
	return crypto.randomUUID().split("-").join("").slice(0, size);
}

const HANDLE_REGEX = /^[a-z][a-z0-9_]{2,31}$/;

export function normalizeHandle(value: string): string {
	return value.trim().toLowerCase();
}

export function isValidHandle(value: string): boolean {
	return HANDLE_REGEX.test(normalizeHandle(value));
}
