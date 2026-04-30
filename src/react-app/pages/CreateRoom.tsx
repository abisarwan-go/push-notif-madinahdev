import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createRoomFromForm } from "../services/api";

export default function CreateRoom() {
	const [name, setName] = useState("");
	const [ownerPassword, setOwnerPassword] = useState("");
	const [joinPassword, setJoinPassword] = useState("");
	const [ownerDisplayName, setOwnerDisplayName] = useState(localStorage.getItem("displayName") ?? "");
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return toast.error("Room name is required");
		if (!ownerPassword.trim()) return toast.error("Owner password is required");
		setLoading(true);
		try {
			const result = await createRoomFromForm(
				name.trim(),
				ownerPassword.trim(),
				joinPassword.trim() || undefined,
				ownerDisplayName || "Owner",
			);
			localStorage.setItem("roomName", result.roomName);
			localStorage.setItem("roomSlug", result.roomSlug);
			localStorage.setItem("displayName", ownerDisplayName || "Owner");
			toast.success("Room created successfully");
			navigate(`/owner-login?room=${encodeURIComponent(result.roomSlug)}`);
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
					<form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
								<span className="label-text font-medium">Owner display name</span>
							</div>
							<input
								className="input input-bordered w-full bg-base-200/60 transition focus:bg-base-100"
								placeholder="Admin"
								value={ownerDisplayName}
								onChange={(e) => setOwnerDisplayName(e.target.value)}
								disabled={loading}
							/>
						</label>
						<label className="form-control w-full">
							<div className="label">
								<span className="label-text font-medium">Owner password</span>
							</div>
							<input
								type="password"
								className="input input-bordered w-full bg-base-200/60 transition focus:bg-base-100"
								placeholder="Required for dashboard access"
								value={ownerPassword}
								onChange={(e) => setOwnerPassword(e.target.value)}
								disabled={loading}
							/>
						</label>
						<label className="form-control w-full">
							<div className="label">
								<span className="label-text font-medium">Join password</span>
								<span className="label-text-alt">Optional</span>
							</div>
							<input
								type="password"
								className="input input-bordered w-full bg-base-200/60 transition focus:bg-base-100"
								placeholder="Required for members if set"
								value={joinPassword}
								onChange={(e) => setJoinPassword(e.target.value)}
								disabled={loading}
							/>
						</label>
						<div className="alert alert-info alert-soft text-sm">
							<span>Owner password protects dashboard, join password protects members access.</span>
						</div>
						<button className="btn btn-primary mt-2 h-12 w-full text-base" disabled={loading || !name.trim()}>
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
