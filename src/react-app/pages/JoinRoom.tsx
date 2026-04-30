import { useState } from "react";
import { toast } from "sonner";
import { joinRoom, loadConfig, subscribeDevice } from "../services/api";

export default function JoinRoom() {
	const [roomName, setRoomName] = useState(localStorage.getItem("roomSlug") ?? "");
	const [displayName, setDisplayName] = useState(localStorage.getItem("displayName") ?? "");
	const [joinPassword, setJoinPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!roomName.trim()) return toast.error("Room name is required");
		if (!displayName.trim()) return toast.error("Display name is required");
		setLoading(true);
		try {
			const joined = await joinRoom(roomName.trim(), displayName.trim(), joinPassword.trim() || undefined);
			localStorage.setItem("roomName", joined.roomName);
			localStorage.setItem("roomSlug", joined.roomSlug);
			localStorage.setItem("displayName", joined.displayName);
			localStorage.setItem("memberId", joined.memberId);
			const config = await loadConfig(joined.roomSlug);
			if (!("serviceWorker" in navigator)) throw new Error("Service Worker not supported");
			const registration = await navigator.serviceWorker.register("/sw.js");
			await navigator.serviceWorker.ready;
			let pushSub = await registration.pushManager.getSubscription();
			if (!pushSub) {
				const vapidKey = config.vapidPublicKey;
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
			await subscribeDevice(joined.roomSlug, {
				endpoint: json.endpoint,
				p256dh: json.keys.p256dh,
				auth: json.keys.auth,
				memberId: joined.memberId,
				displayName: joined.displayName,
				userAgent: navigator.userAgent,
			});
			toast.success("Joined and subscribed successfully");
		} catch (error) {
			toast.error("Failed to join room", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="mx-auto flex min-h-[72vh] w-full max-w-xl items-center">
			<div className="w-full">
			<div className="mb-8 text-center">
				<h1 className="text-3xl font-bold">Join a room</h1>
				<p className="mt-2 text-sm text-base-content/70">Join as member then auto-subscribe this device.</p>
			</div>
			<div className="card border border-base-300 bg-base-100 shadow-2xl">
				<div className="card-body p-8">
					<form onSubmit={handleSubmit} className="space-y-5">
						<label className="form-control w-full">
							<div className="label">
								<span className="label-text font-medium">Room name</span>
							</div>
							<input
								className="input input-bordered w-full bg-base-200/60 transition focus:bg-base-100"
								placeholder="marketing-fr"
								value={roomName}
								onChange={(e) => setRoomName(e.target.value)}
								disabled={loading}
							/>
						</label>
						<label className="form-control w-full">
							<div className="label">
								<span className="label-text font-medium">Display name</span>
							</div>
							<input
								className="input input-bordered w-full bg-base-200/60 transition focus:bg-base-100"
								placeholder="Mobile User"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
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
							className="input input-bordered w-full bg-base-200/60 transition focus:bg-base-100"
							placeholder="Join password"
							value={joinPassword}
							onChange={(e) => setJoinPassword(e.target.value)}
							disabled={loading}
						/>
					</label>
						<div className="alert alert-info alert-soft text-sm">
							<span>Use the exact room name shared by the owner.</span>
						</div>
						<button className="btn btn-primary h-12 w-full text-base" disabled={loading || !roomName.trim() || !displayName.trim()}>
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
