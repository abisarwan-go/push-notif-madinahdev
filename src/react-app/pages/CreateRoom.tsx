import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createInvite, createRoomFromForm } from "../services/api";

export default function CreateRoom() {
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [ownerName, setOwnerName] = useState(localStorage.getItem("displayName") ?? "");
	const [loading, setLoading] = useState(false);
	const [inviteLink, setInviteLink] = useState("");
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return toast.error("Room name is required");
		setLoading(true);
		try {
			const result = await createRoomFromForm(name.trim(), password || undefined, ownerName || "Owner");
			localStorage.setItem("projectId", result.roomId);
			localStorage.setItem("roomName", result.roomName);
			localStorage.setItem("roomSlug", result.roomSlug);
			localStorage.setItem("displayName", ownerName || "Owner");
			localStorage.setItem("memberId", result.memberId);
			localStorage.setItem("dashboardToken", result.dashboardToken);
			localStorage.setItem("apiKey", result.apiKey);
			const invited = await createInvite(result.roomSlug, 5);
			const link = `${window.location.origin}/join?token=${encodeURIComponent(invited.token)}`;
			setInviteLink(link);
			toast.success("Room created successfully");
			navigate(`/dashboard/${result.roomSlug}`);
		} catch (error) {
			toast.error("Failed to create room", {
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
				<h1 className="text-3xl font-bold">Create a room</h1>
				<p className="mt-2 text-sm text-base-content/70">Set up a secure room for your notifications.</p>
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
								placeholder="engineering-alerts"
								value={name}
								onChange={(e) => setName(e.target.value)}
								disabled={loading}
							/>
						</label>
						<label className="form-control w-full">
							<div className="label">
								<span className="label-text font-medium">Your display name</span>
							</div>
							<input
								className="input input-bordered w-full bg-base-200/60 transition focus:bg-base-100"
								placeholder="Admin"
								value={ownerName}
								onChange={(e) => setOwnerName(e.target.value)}
								disabled={loading}
							/>
						</label>
						<label className="form-control w-full">
							<div className="label">
								<span className="label-text font-medium">Room password</span>
								<span className="label-text-alt">Optional</span>
							</div>
							<input
								type="password"
								className="input input-bordered w-full bg-base-200/60 transition focus:bg-base-100"
								placeholder="Leave empty for quick testing"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={loading}
							/>
						</label>
						<div className="alert alert-info alert-soft text-sm">
							<span>Tip: choose a short room name like `ops-alerts`.</span>
						</div>
						{inviteLink && (
							<label className="form-control">
								<div className="label">
									<span className="label-text">Invite link (5 min)</span>
								</div>
								<input className="input input-bordered w-full font-mono text-xs" readOnly value={inviteLink} />
							</label>
						)}
						<button className="btn btn-primary h-12 w-full text-base" disabled={loading || !name.trim()}>
							{loading && <span className="loading loading-spinner loading-sm" />}
							Provision Room
						</button>
					</form>
				</div>
			</div>
			</div>
		</div>
	);
}
