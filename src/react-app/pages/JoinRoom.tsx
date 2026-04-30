import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { joinByToken, joinRoomFromForm } from "../services/api";

export default function JoinRoom() {
	const [searchParams] = useSearchParams();
	const [roomName, setRoomName] = useState(localStorage.getItem("roomSlug") ?? "");
	const [displayName, setDisplayName] = useState(localStorage.getItem("displayName") ?? "");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [tab, setTab] = useState<"name" | "token">(searchParams.get("token") ? "token" : "name");
	const navigate = useNavigate();
	const inviteToken = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!roomName.trim()) return toast.error("Room name is required");
		if (!displayName.trim()) return toast.error("Display name is required");
		setLoading(true);
		try {
			const joined = await joinRoomFromForm(roomName.trim(), displayName.trim(), password || undefined);
			localStorage.setItem("projectId", joined.projectId);
			localStorage.setItem("roomName", joined.roomName);
			localStorage.setItem("roomSlug", joined.roomSlug);
			localStorage.setItem("displayName", joined.displayName);
			localStorage.setItem("memberId", joined.memberId);
			toast.success("Connected to room");
			navigate(`/dashboard/${joined.roomSlug}`);
		} catch (error) {
			toast.error("Failed to join room", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleTokenJoin = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inviteToken) return toast.error("Missing invite token in link");
		if (!displayName.trim()) return toast.error("Display name is required");
		setLoading(true);
		try {
			const joined = await joinByToken(inviteToken, displayName.trim());
			localStorage.setItem("projectId", joined.projectId);
			localStorage.setItem("roomName", joined.roomName);
			localStorage.setItem("roomSlug", joined.roomSlug);
			localStorage.setItem("displayName", joined.displayName);
			localStorage.setItem("memberId", joined.memberId);
			toast.success("Connected with invite token");
			navigate(`/dashboard/${joined.roomSlug}`);
		} catch (error) {
			toast.error("Invite token invalid or expired", {
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
				<p className="mt-2 text-sm text-base-content/70">Connect this client to start receiving push messages.</p>
			</div>
			<div className="card border border-base-300 bg-base-100 shadow-2xl">
				<div className="card-body p-8">
					<div className="tabs tabs-box mb-3">
						<button type="button" className={`tab ${tab === "name" ? "tab-active" : ""}`} onClick={() => setTab("name")}>
							Nom + mot de passe
						</button>
						<button type="button" className={`tab ${tab === "token" ? "tab-active" : ""}`} onClick={() => setTab("token")}>
							Lien invitation
						</button>
					</div>
					{tab === "name" && (
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
								<span className="label-text font-medium">Password</span>
								<span className="label-text-alt">If protected</span>
							</div>
							<input
								type="password"
								className="input input-bordered w-full bg-base-200/60 transition focus:bg-base-100"
								placeholder="Room password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={loading}
							/>
						</label>
						<div className="alert alert-info alert-soft text-sm">
							<span>Use the exact room name shared by the owner.</span>
						</div>
						<button className="btn btn-primary h-12 w-full text-base" disabled={loading || !roomName.trim() || !displayName.trim()}>
							{loading && <span className="loading loading-spinner loading-sm" />}
							Connect to Room
						</button>
					</form>
					)}
					{tab === "token" && (
						<form onSubmit={handleTokenJoin} className="space-y-5">
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Invite token</span>
								</div>
								<input className="input input-bordered w-full bg-base-200/60 font-mono" value={inviteToken} readOnly />
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
							<div className="alert alert-warning alert-soft text-sm">
								<span>Token invitations are valid for 5 minutes and are multi-use.</span>
							</div>
							<button className="btn btn-primary h-12 w-full text-base" disabled={loading || !inviteToken || !displayName.trim()}>
								{loading && <span className="loading loading-spinner loading-sm" />}
								Join with Invite Link
							</button>
						</form>
					)}
				</div>
			</div>
			</div>
		</div>
	);
}
