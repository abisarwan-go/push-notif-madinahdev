import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createRoomFromForm } from "../services/api";

export default function CreateRoom() {
	const [name, setName] = useState("");
	const [joinPassword, setJoinPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [hasUserToken, setHasUserToken] = useState(() => Boolean(localStorage.getItem("userToken")));
	const navigate = useNavigate();

	useEffect(() => {
		const sync = () => setHasUserToken(Boolean(localStorage.getItem("userToken")));
		window.addEventListener("auth-changed", sync);
		return () => window.removeEventListener("auth-changed", sync);
	}, []);

	useEffect(() => {
		if (!hasUserToken) {
			toast.info("Sign in required", { description: "Create room is only available for signed-in accounts." });
			navigate("/login?next=/create", { replace: true });
		}
	}, [hasUserToken, navigate]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const userToken = localStorage.getItem("userToken");
		if (!userToken) {
			toast.error("Login required to create a room");
			navigate("/login?next=/create");
			return;
		}
		if (!name.trim()) return toast.error("Room name is required");
		setLoading(true);
		try {
			const result = await createRoomFromForm(name.trim(), joinPassword.trim() || undefined);
			localStorage.setItem("roomName", result.roomName);
			localStorage.removeItem("roomSlug");
			const accountName = localStorage.getItem("username") ?? "";
			if (accountName) localStorage.setItem("displayName", accountName);
			toast.success("Room created successfully");
			navigate(`/dashboard/${encodeURIComponent(result.roomName)}`);
		} catch (error) {
			toast.error("Failed to create room", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setLoading(false);
		}
	};

	if (!hasUserToken) {
		return (
			<div className="mx-auto flex min-h-[50vh] w-full max-w-xl items-center justify-center px-4">
				<span className="loading loading-lg loading-spinner text-primary" />
			</div>
		);
	}

	return (
		<div className="mx-auto flex min-h-[72vh] w-full max-w-xl items-center px-4 sm:px-0">
			<div className="w-full min-w-0">
				<div className="mb-6 text-center sm:mb-8">
					<h1 className="text-2xl font-bold sm:text-3xl">Create a room</h1>
					<p className="mt-2 text-sm text-base-content/70">Set up a secure room for your notifications.</p>
				</div>
				<div className="card border border-base-300 bg-base-100 shadow-2xl">
					<div className="card-body gap-4 p-4 sm:p-8 sm:gap-5">
					<form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
						<label className="form-control w-full">
							<div className="label">
								<span className="label-text font-medium">Room name</span>
							</div>
							<input
								className="input input-bordered w-full min-w-0 bg-base-200/60 transition focus:bg-base-100"
								placeholder="engineering-alerts"
								value={name}
								onChange={(e) => setName(e.target.value)}
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
								className="input input-bordered w-full min-w-0 bg-base-200/60 transition focus:bg-base-100"
								placeholder="Required for members if set"
								value={joinPassword}
								onChange={(e) => setJoinPassword(e.target.value)}
								disabled={loading}
							/>
						</label>
						<div className="alert alert-info alert-soft text-sm">
							<span>
								Your member display name in this room matches your account (
								<span className="font-mono font-medium">{localStorage.getItem("username") ?? "…"}</span>
								). Optional join password limits who can join as a member.
							</span>
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
