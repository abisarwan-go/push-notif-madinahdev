import { Activity, BellRing, History, Send, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { createInvite, getRoomStats, sendNotification } from "../services/api";

type RoomStatsModel = {
	roomId: string;
	roomName: string;
	roomSlug: string;
	membersCount: number;
	activeSubscribers: number;
};

export default function RoomDashboard() {
	const params = useParams<{ roomName: string }>();
	const roomNameParam = params.roomName ?? "";
	const [stats, setStats] = useState<RoomStatsModel | null>(null);
	const [isLoadingStats, setIsLoadingStats] = useState(true);
	const [title, setTitle] = useState("");
	const [message, setMessage] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [inviteLink, setInviteLink] = useState("");
	const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

	useEffect(() => {
		let mounted = true;
		const fetchStats = async () => {
			if (!roomNameParam) return;
			try {
				const data = await getRoomStats(roomNameParam);
				if (mounted) setStats(data);
			} catch (error) {
				if (mounted) {
					toast.error("Unable to load live stats", {
						description: error instanceof Error ? error.message : "Unknown error",
					});
				}
			} finally {
				if (mounted) setIsLoadingStats(false);
			}
		};
		void fetchStats();
		const interval = setInterval(fetchStats, 5000);
		return () => {
			mounted = false;
			clearInterval(interval);
		};
	}, [roomNameParam]);

	const roomName = useMemo(
		() => stats?.roomName || localStorage.getItem("roomName") || "Unknown room",
		[stats?.roomName],
	);
	const roomSlug = useMemo(
		() => stats?.roomSlug || localStorage.getItem("roomSlug") || roomNameParam,
		[roomNameParam, stats?.roomSlug],
	);

	const handleSendNotification = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!roomNameParam) return toast.error("Missing room in URL");
		if (!title.trim() || !message.trim()) return toast.error("Title and message are required");
		setIsSending(true);
		try {
			await sendNotification(roomNameParam, title.trim(), message.trim());
			toast.success("Notification sent");
			setTitle("");
			setMessage("");
		} catch (error) {
			toast.error("Failed to send notification", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsSending(false);
		}
	};

	const handleGenerateInvite = async () => {
		if (!roomSlug) return toast.error("Missing room slug");
		setIsGeneratingInvite(true);
		try {
			const invited = await createInvite(roomSlug, 5);
			const link = `${window.location.origin}/join?token=${encodeURIComponent(invited.token)}`;
			setInviteLink(link);
			await navigator.clipboard.writeText(link);
			toast.success("Invite link copied (valid 5 minutes)");
		} catch (error) {
			toast.error("Failed to generate invite link", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsGeneratingInvite(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold">Room dashboard</h1>
					<p className="mt-1 text-sm text-base-content/70">
						Room <span className="badge badge-outline">{roomName}</span>
						<span className="mx-2">|</span>
						Slug <span className="font-mono text-xs">{roomSlug}</span>
					</p>
				</div>
				<div className="badge badge-success gap-2">
					<Activity className="h-3.5 w-3.5" />
					Live
				</div>
			</div>

			<div className="stats stats-vertical w-full border border-base-300 bg-base-100 shadow md:stats-horizontal">
				<div className="stat">
					<div className="stat-figure text-primary">
						<Users className="h-6 w-6" />
					</div>
					<div className="stat-title">Members</div>
					<div className="stat-value text-primary">
						{isLoadingStats ? <span className="loading loading-dots loading-md" /> : (stats?.membersCount ?? 0)}
					</div>
				</div>
				<div className="stat">
					<div className="stat-figure text-secondary">
						<BellRing className="h-6 w-6" />
					</div>
					<div className="stat-title">Active subscribers</div>
					<div className="stat-value text-secondary">
						{isLoadingStats ? <span className="loading loading-dots loading-md" /> : (stats?.activeSubscribers ?? 0)}
					</div>
				</div>
				<div className="stat">
					<div className="stat-figure text-accent">
						<History className="h-6 w-6" />
					</div>
					<div className="stat-title">Status</div>
					<div className="stat-value text-accent text-2xl">Ready</div>
					<div className="stat-desc">Polling every 5 seconds</div>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-12">
				<section className="card border border-base-300 bg-base-100 shadow-xl lg:col-span-8">
					<div className="card-body">
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
									className="input input-bordered w-full"
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
									className="textarea textarea-bordered h-32 w-full"
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
					</div>
				</section>

				<aside className="card border border-base-300 bg-base-100 shadow-xl lg:col-span-4">
					<div className="card-body">
						<h3 className="card-title text-base">Session details</h3>
						<div className="space-y-2 text-sm">
							<p>
								Display name: <span className="font-medium">{localStorage.getItem("displayName") || "-"}</span>
							</p>
							<p>
								Member ID: <span className="font-mono text-xs">{localStorage.getItem("memberId") || "-"}</span>
							</p>
							<p>
								Dashboard token:{" "}
								<span className="font-mono text-xs">
									{(localStorage.getItem("dashboardToken") || "-").slice(0, 10)}
									...
								</span>
							</p>
						</div>
						<button className="btn btn-outline btn-sm mt-2" onClick={handleGenerateInvite} disabled={isGeneratingInvite}>
							{isGeneratingInvite && <span className="loading loading-spinner loading-xs" />}
							Generate invite link (5 min)
						</button>
						{inviteLink && (
							<label className="form-control mt-2">
								<div className="label">
									<span className="label-text">Last invite link</span>
								</div>
								<input className="input input-bordered w-full font-mono text-xs" value={inviteLink} readOnly />
							</label>
						)}
						<div className="alert mt-2">
							<Activity className="h-4 w-4" />
							<span>Keep this tab open to monitor room activity.</span>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}
