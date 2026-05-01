import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { joinRoom, loadConfig, subscribeDevice } from "../services/api";

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

/** Ensures we may call PushManager.subscribe (prompts once when permission is still "default"). */
async function ensureNotificationPermissionForPush(): Promise<void> {
	if (!("Notification" in window)) {
		throw new Error("This browser does not support web notifications.");
	}
	if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
		throw new Error("Push is not supported in this browser context. On iPhone/iPad, install the app to Home Screen and reopen it.");
	}
	let perm = Notification.permission;
	if (perm === "denied") {
		throw new Error(
			"Notifications are blocked for this site. Use the lock/icon in the address bar or browser site settings to allow notifications, then try Join again.",
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
function describePushSetupFailure(error: unknown): string {
	const raw = error instanceof Error ? error.message : String(error);
	if (/permission denied/i.test(raw)) {
		return "The browser refused push until notifications are allowed for this site.";
	}
	if (/notallowederror/i.test(raw)) {
		return "Notifications or push were blocked by the browser.";
	}
	return raw;
}

async function subscribePushForRoom(roomName: string, memberId: string, displayName: string): Promise<void> {
	await ensureNotificationPermissionForPush();
	const config = await loadConfig(roomName);
	if (!("serviceWorker" in navigator)) throw new Error("Service Worker not supported in this browser");
	const registration = await navigator.serviceWorker.register("/sw.js");
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
	await subscribeDevice(roomName, {
		endpoint: json.endpoint,
		p256dh: json.keys.p256dh,
		auth: json.keys.auth,
		memberId,
		displayName,
		userAgent: navigator.userAgent,
	});
}

export default function JoinRoom() {
	const supportsNotifications = typeof window !== "undefined" && "Notification" in window;
	const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
		supportsNotifications ? Notification.permission : "unsupported",
	);
	const [roomName, setRoomName] = useState(
		localStorage.getItem("roomName") ?? localStorage.getItem("roomSlug") ?? "",
	);
	const [joinPassword, setJoinPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const handleRequestPermission = async () => {
		if (!supportsNotifications) {
			toast.error("This browser does not support notifications.");
			return;
		}
		try {
			const result = await Notification.requestPermission();
			setNotificationPermission(result);
			if (result === "granted") {
				toast.success("Notifications enabled for this browser.");
				return;
			}
			if (result === "denied") {
				toast.warning("Notifications blocked", {
					description: "Enable notifications from browser site settings to receive pushes.",
				});
				return;
			}
			toast.info("Notification permission not granted yet.");
		} catch {
			toast.error("Could not request notification permission.");
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!roomName.trim()) return toast.error("Room name is required");

		// Important: request permission immediately from the click gesture (before any async network call).
		if (supportsNotifications && notificationPermission === "default") {
			try {
				const nextPermission = await Notification.requestPermission();
				setNotificationPermission(nextPermission);
			} catch {
				// Keep flow going: room join should still work even if permission prompt fails.
			}
		}

		setLoading(true);
		let joined: Awaited<ReturnType<typeof joinRoom>>;
		try {
			joined = await joinRoom(roomName.trim(), joinPassword.trim() || undefined);
			localStorage.setItem("roomName", joined.roomName);
			localStorage.removeItem("roomSlug");
			localStorage.setItem("displayName", joined.displayName);
			localStorage.setItem("memberId", joined.memberId);
		} catch (error) {
			toast.error("Failed to join room", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
			setLoading(false);
			return;
		}

		try {
			await subscribePushForRoom(joined.roomName, joined.memberId, joined.displayName);
			toast.success("Joined and subscribed", { description: "You will receive push notifications for this room." });
		} catch (error) {
			const msg = describePushSetupFailure(error);
			if (supportsNotifications) {
				setNotificationPermission(Notification.permission);
			}
			toast.warning("Joined the room — push not enabled yet", {
				description: `${msg} You can still use the room dashboard; use Join from the menu again after allowing notifications if you want pushes.`,
				duration: 9000,
			});
		} finally {
			setLoading(false);
			navigate(`/dashboard/${encodeURIComponent(joined.roomName)}`);
		}
	};

	return (
		<div className="mx-auto flex min-h-[72vh] w-full max-w-xl items-center px-4 sm:px-0">
			<div className="w-full min-w-0">
				<div className="mb-6 text-center sm:mb-8">
					<h1 className="text-2xl font-bold sm:text-3xl">Join a room</h1>
					<p className="mt-2 text-sm text-base-content/70">You join using your account username.</p>
				</div>
				<div className="card border border-base-300 bg-base-100 shadow-2xl">
					<div className="card-body gap-4 p-4 sm:p-8">
						<form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Room name</span>
								</div>
								<input
									className="input input-bordered w-full min-w-0 bg-base-200/60 transition focus:bg-base-100"
									placeholder="marketing-fr"
									value={roomName}
									onChange={(e) => setRoomName(e.target.value)}
									disabled={loading}
								/>
							</label>
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Join password</span>
									<span className="label-text-alt">If protected</span>
								</div>
								<input
									type="password"
									className="input input-bordered w-full min-w-0 bg-base-200/60 transition focus:bg-base-100"
									placeholder="Join password"
									value={joinPassword}
									onChange={(e) => setJoinPassword(e.target.value)}
									disabled={loading}
								/>
							</label>
							<div className="alert alert-info alert-soft text-sm">
								<span>Only room name and optional join password are sent. Your member name is your account username.</span>
							</div>
							<div className="rounded-lg border border-base-300 bg-base-200/40 p-3">
								<div className="flex items-center justify-between gap-2">
									<p className="text-sm">
										Notifications:{" "}
										<span className="font-medium">
											{notificationPermission === "unsupported" ? "unsupported" : notificationPermission}
										</span>
									</p>
									<button
										type="button"
										className="btn btn-outline btn-sm"
										onClick={() => void handleRequestPermission()}
										disabled={loading || notificationPermission === "granted" || !supportsNotifications}
									>
										Enable notifications
									</button>
								</div>
								<p className="mt-2 text-xs text-base-content/60">
									Click once before joining if you want to receive push notifications on this device.
								</p>
							</div>
							<button className="btn btn-primary mt-1 h-12 w-full text-base" disabled={loading || !roomName.trim()}>
								{loading && <span className="loading loading-spinner loading-sm" />}
								Join and subscribe
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}
