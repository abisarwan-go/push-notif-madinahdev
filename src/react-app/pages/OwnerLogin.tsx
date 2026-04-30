import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ownerLogin } from "../services/api";

export default function OwnerLogin() {
	const [searchParams] = useSearchParams();
	const [roomName, setRoomName] = useState(searchParams.get("room") ?? localStorage.getItem("roomSlug") ?? "");
	const [ownerPassword, setOwnerPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!roomName.trim() || !ownerPassword.trim()) return toast.error("Room name and owner password are required");
		setLoading(true);
		try {
			const logged = await ownerLogin(roomName.trim(), ownerPassword.trim());
			localStorage.setItem("ownerToken", logged.token);
			localStorage.setItem("roomSlug", logged.roomSlug);
			localStorage.setItem("roomName", logged.roomName);
			toast.success("Owner authenticated");
			navigate(`/dashboard/${logged.roomSlug}`);
		} catch (error) {
			toast.error("Owner login failed", {
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
					<h1 className="text-3xl font-bold">Owner login</h1>
					<p className="mt-2 text-sm text-base-content/70">Access your private room dashboard.</p>
				</div>
				<div className="card border border-base-300 bg-base-100 shadow-2xl">
					<div className="card-body p-8">
						<form onSubmit={onSubmit} className="space-y-5">
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Room name</span>
								</div>
								<input className="input input-bordered w-full" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
							</label>
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Owner password</span>
								</div>
								<input
									type="password"
									className="input input-bordered w-full"
									value={ownerPassword}
									onChange={(e) => setOwnerPassword(e.target.value)}
								/>
							</label>
							<button className="btn btn-primary h-12 w-full text-base" disabled={loading}>
								{loading && <span className="loading loading-spinner loading-sm" />}
								Enter dashboard
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}
