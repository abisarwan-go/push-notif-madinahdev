import { Activity, BellRing, History, RefreshCw, Send, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getRoomStats, sendNotification } from "../services/api";

type RoomStatsModel = {
	viewerRole: "OWNER" | "MEMBER";
	roomId: string;
	roomName: string;
	membersCount: number;
	activeSubscriptions: number;
	notifications: Array<{ id: string; title: string; body?: string; status: string; createdAt: string }>;
};

export default function RoomDashboard() {
	const params = useParams<{ roomName: string }>();
	const roomNameParam = params.roomName ?? "";
	const [stats, setStats] = useState<RoomStatsModel | null>(null);
	const [isLoadingStats, setIsLoadingStats] = useState(true);
	const [title, setTitle] = useState("");
	const [message, setMessage] = useState("");
	const [isSending, setIsSending] = useState(false);

	const loadStats = useCallback(async () => {
		if (!roomNameParam) return;
		setIsLoadingStats(true);
		try {
			const data = await getRoomStats(roomNameParam);
			setStats({
				viewerRole: data.viewerRole,
				roomId: data.roomId,
				roomName: data.roomName,
				membersCount: data.membersCount,
				activeSubscriptions: data.activeSubscriptions,
				notifications: data.notifications,
			});
		} catch (error) {
			toast.error("Unable to load room data", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsLoadingStats(false);
		}
	}, [roomNameParam]);

	useEffect(() => {
		void loadStats();
	}, [loadStats]);

	const isOwner = stats?.viewerRole === "OWNER";
	const pageTitle = !stats ? "Room" : isOwner ? "Room dashboard" : "Room feed";

	const roomName = useMemo(
		() => stats?.roomName || localStorage.getItem("roomName") || "Unknown room",
		[stats?.roomName],
	);

	const handleSendNotification = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isOwner) return;
		if (!roomNameParam) return toast.error("Missing room in URL");
		if (!title.trim() || !message.trim()) return toast.error("Title and message are required");
		setIsSending(true);
		try {
			await sendNotification(roomNameParam, title.trim(), message.trim());
			toast.success("Notification sent");
			setTitle("");
			setMessage("");
			await loadStats();
		} catch (error) {
			toast.error("Failed to send notification", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsSending(false);
		}
	};

	const memberId = localStorage.getItem("memberId");
	const accountUsername = localStorage.getItem("username") ?? "";

	return (
		<div className="min-w-0 space-y-4 sm:space-y-6">
			<div className="alert alert-warning border border-warning/40 bg-warning/10 text-xs sm:text-sm">
				<span>
					<strong>Not live.</strong> Counts and the list below refresh only when you load this page or click &quot;Refresh&quot;.
					Push notifications to devices are still delivered in real time.
				</span>
			</div>

			<div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
				<div className="min-w-0">
					<h1 className="text-2xl font-bold sm:text-3xl">{pageTitle}</h1>
					<p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-base-content/70">
						<span className="min-w-0 break-words">
							Room{" "}
							<span className="badge badge-outline max-w-full whitespace-normal break-all font-mono align-middle">
								{roomName}
							</span>
						</span>
						{stats?.viewerRole ? (
							<span className={`badge ${isOwner ? "badge-primary" : "badge-secondary"}`}>
								{isOwner ? "Owner" : "Member"}
							</span>
						) : null}
					</p>
					<p className="mt-2 text-sm">
						<Link to="/rooms" className="link link-primary">
							← My rooms
						</Link>
					</p>
				</div>
				<button
					type="button"
					className="btn btn-outline btn-primary w-full shrink-0 gap-2 sm:w-auto"
					disabled={isLoadingStats}
					onClick={() => void loadStats()}
				>
					{isLoadingStats ? <span className="loading loading-spinner loading-sm" /> : <RefreshCw className="h-4 w-4" />}
					Refresh
				</button>
			</div>

			{!isOwner && stats?.viewerRole === "MEMBER" ? (
				<div className="alert alert-info text-sm">
					<span>You are viewing this room as a <strong>member</strong>. Only the owner can send broadcasts; you can read past messages below.</span>
				</div>
			) : null}

			<div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:overflow-visible sm:px-0">
				<div className="stats stats-vertical w-full min-w-[16rem] border border-base-300 bg-base-100 shadow md:min-w-0 md:stats-horizontal">
				<div className="stat">
					<div className="stat-figure text-primary">
						<Users className="h-6 w-6" />
					</div>
					<div className="stat-title">Members</div>
					<div className="stat-value text-primary">
						{isLoadingStats && !stats ? <span className="loading loading-dots loading-md" /> : (stats?.membersCount ?? 0)}
					</div>
				</div>
				{isOwner ? (
					<div className="stat">
						<div className="stat-figure text-secondary">
							<BellRing className="h-6 w-6" />
						</div>
						<div className="stat-title">Active subscribers</div>
						<div className="stat-value text-secondary">
							{isLoadingStats && !stats ? <span className="loading loading-dots loading-md" /> : (stats?.activeSubscriptions ?? 0)}
						</div>
					</div>
				) : null}
				<div className="stat">
					<div className="stat-figure text-accent">
						<History className="h-6 w-6" />
					</div>
					<div className="stat-title">Status</div>
					<div className="stat-value text-accent text-2xl">Ready</div>
					<div className="stat-desc">Manual refresh</div>
				</div>
				</div>
			</div>

			<div className={`grid min-w-0 gap-6 ${isOwner ? "lg:grid-cols-12" : ""}`}>
				<section
					className={`card border border-base-300 bg-base-100 shadow-xl ${isOwner ? "lg:col-span-8" : "lg:col-span-12"}`}
				>
					<div className="card-body p-4 sm:p-6">
						{isOwner ? (
							<>
								<h2 className="card-title">Broadcast message</h2>
								<p className="text-sm text-base-content/70">
									Send a push notification to all active subscribers in this room.
								</p>
								<form onSubmit={handleSendNotification} className="mt-2 space-y-4">
									<label className="form-control w-full">
										<div className="label">
											<span className="label-text">Title</span>
										</div>
										<input
											className="input input-bordered w-full min-w-0"
											placeholder="Critical update"
											value={title}
											onChange={(e) => setTitle(e.target.value)}
											disabled={isSending}
										/>
									</label>
									<label className="form-control w-full">
										<div className="label">
											<span className="label-text">Message</span>
										</div>
										<textarea
											className="textarea textarea-bordered h-32 w-full min-w-0"
											placeholder="Type your broadcast message..."
											value={message}
											onChange={(e) => setMessage(e.target.value)}
											disabled={isSending}
										/>
									</label>
									<button className="btn btn-primary w-full md:w-auto" disabled={isSending || !title.trim() || !message.trim()}>
										{isSending ? <span className="loading loading-spinner loading-sm" /> : <Send className="h-4 w-4" />}
										Send notification
									</button>
								</form>
								<div className="divider" />
							</>
						) : (
							<h2 className="card-title">Broadcast history</h2>
						)}

						<h3 className={`font-semibold ${isOwner ? "" : "mt-0"}`}>Past broadcasts (from last refresh)</h3>
						<p className="mb-3 text-xs text-base-content/60">
							Same timeline as push history; click Refresh to load the latest.
						</p>
						<div className="max-h-96 space-y-2 overflow-auto rounded-lg border border-base-300 bg-base-200/30 p-3">
							{stats?.notifications?.length ? (
								stats.notifications.map((n) => (
									<div key={n.id} className="rounded-lg border border-base-300 bg-base-100 p-3 text-left text-sm shadow-sm">
										<p className="font-medium">{n.title}</p>
										{n.body ? <p className="mt-1 whitespace-pre-wrap text-base-content/80">{n.body}</p> : null}
										<p className="mt-1 text-xs text-base-content/50">
											{n.status} · {new Date(n.createdAt).toLocaleString()}
										</p>
									</div>
								))
							) : (
								<p className="text-center text-sm text-base-content/50">No notifications loaded yet.</p>
							)}
						</div>
					</div>
				</section>

				{isOwner ? (
					<aside className="card border border-base-300 bg-base-100 shadow-xl lg:col-span-4">
						<div className="card-body p-4 sm:p-6">
							<h3 className="card-title text-base">Session</h3>
							<div className="space-y-2 text-sm">
								<p>
									Account: <span className="font-mono font-medium">{accountUsername || "—"}</span>
								</p>
								<p>
									Display name (member):{" "}
									<span className="font-medium">{localStorage.getItem("displayName") || accountUsername || "—"}</span>
								</p>
								<p>
									Member ID: <span className="font-mono text-xs">{memberId || "—"}</span>
								</p>
								<p className="text-xs text-base-content/60">
									Member ID appears after you <strong>join</strong> this room on this device. Empty here as owner-only visitor is
									normal.
								</p>
								<p>
									User JWT: <span className="font-mono text-xs">{localStorage.getItem("userToken") ? "stored" : "missing"}</span>
								</p>
							</div>
							<div className="alert mt-4">
								<Activity className="h-4 w-4" />
								<span className="text-xs">Use Refresh to update stats and broadcast history without polling the server.</span>
							</div>
						</div>
					</aside>
				) : (
					<section className="card border border-base-300 bg-base-100 shadow-xl lg:hidden">
						<div className="card-body p-4 text-sm text-base-content/70 sm:p-6">
							<p>
								Signed in as <span className="font-mono font-medium">{accountUsername || "—"}</span>
							</p>
						</div>
					</section>
				)}
			</div>
		</div>
	);
}
