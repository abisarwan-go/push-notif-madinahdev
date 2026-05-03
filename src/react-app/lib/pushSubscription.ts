import { loadConfig, subscribeDevice, subscribeDeviceWithUserToken } from "../services/api";

function isValidVapidPublicKey(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return false;
	try {
		const padding = "=".repeat((4 - (trimmed.length % 4)) % 4);
		const base64 = (trimmed + padding).replace(/-/g, "+").replace(/_/g, "/");
		const rawData = atob(base64);
		if (rawData.length !== 65) return false;
		return rawData.charCodeAt(0) === 0x04;
	} catch {
		return false;
	}
}

async function assertServiceWorkerScriptIsReachable(): Promise<void> {
	const res = await fetch("/sw.js", { method: "GET", cache: "no-store", credentials: "same-origin" });
	const text = (await res.text()).trimStart();
	if (!res.ok) {
		throw new Error(`Could not load /sw.js (HTTP ${res.status}). Push needs a real service worker file.`);
	}
	if (text.startsWith("<") || text.startsWith("<!")) {
		throw new Error(
			"/sw.js returned HTML instead of JavaScript (often SPA fallback). Fix static asset routing so /sw.js is served from the build output.",
		);
	}
}

/** Ensures we may call PushManager.subscribe (prompts once when permission is still "default"). */
export async function ensureNotificationPermissionForPush(): Promise<void> {
	if (!("Notification" in window)) {
		throw new Error("This browser does not support web notifications.");
	}
	if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
		throw new Error(
			"Push is not supported in this browser context. On iPhone/iPad, add the site to Home Screen (PWA) and open it from there.",
		);
	}
	let perm = Notification.permission;
	if (perm === "denied") {
		throw new Error(
			"Notifications are blocked for this site. Use the lock/icon in the address bar or browser site settings to allow notifications, then try again.",
		);
	}
	if (perm === "default") {
		perm = await Notification.requestPermission();
	}
	if (perm !== "granted") {
		throw new Error("Notifications were not allowed, so push alerts for this room were not enabled.");
	}
}

/** Turns Push/SW errors into short copy; avoids showing Chrome's "Registration failed - permission denied". */
export function describePushSetupFailure(error: unknown): string {
	const raw = error instanceof Error ? error.message : String(error);
	if (/permission denied/i.test(raw)) {
		return "The browser refused push until notifications are allowed for this site.";
	}
	if (/notallowederror/i.test(raw)) {
		return "Notifications or push were blocked by the browser.";
	}
	return raw;
}

async function buildWebPushSubscription(roomName: string): Promise<{ endpoint: string; p256dh: string; auth: string }> {
	const config = await loadConfig(roomName);
	if (!("serviceWorker" in navigator)) throw new Error("Service Worker not supported in this browser");
	await assertServiceWorkerScriptIsReachable();
	const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
	await navigator.serviceWorker.ready;
	let pushSub = await registration.pushManager.getSubscription();
	if (!pushSub) {
		const vapidKey = config.vapidPublicKey?.trim() ?? "";
		if (!isValidVapidPublicKey(vapidKey)) {
			throw new Error("VAPID public key missing or invalid on server");
		}
		const urlBase64ToUint8Array = (base64String: string) => {
			const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
			const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
			const rawData = atob(base64);
			return Uint8Array.from([...rawData].map((ch) => ch.charCodeAt(0)));
		};
		pushSub = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidKey),
		});
	}
	const json = pushSub.toJSON() as {
		endpoint?: string;
		keys?: { p256dh?: string; auth?: string };
	};
	if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Invalid subscription payload");
	return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

/**
 * Registers this browser for Web Push for the given room (after caller has ensured JWT / membership via joinRoom).
 */
export async function subscribePushForRoom(roomName: string, memberId: string, displayName: string): Promise<void> {
	await ensureNotificationPermissionForPush();
	const keys = await buildWebPushSubscription(roomName);
	await subscribeDevice(roomName, {
		...keys,
		memberId,
		displayName,
		userAgent: navigator.userAgent,
	});
}

/**
 * Registers push for the logged-in dashboard user; server resolves memberId (no join password).
 */
export async function subscribePushForCurrentSession(roomName: string): Promise<void> {
	await ensureNotificationPermissionForPush();
	const keys = await buildWebPushSubscription(roomName);
	const out = await subscribeDeviceWithUserToken(roomName, {
		...keys,
		userAgent: navigator.userAgent,
	});
	if (out.memberId) localStorage.setItem("memberId", out.memberId);
}
