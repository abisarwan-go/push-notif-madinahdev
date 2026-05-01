import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { normalizeRoomKey } from "../lib/roomKey";

export default function OwnerLogin() {
	const [searchParams] = useSearchParams();
	const [roomName, setRoomName] = useState(
		searchParams.get("room") ?? localStorage.getItem("roomName") ?? localStorage.getItem("roomSlug") ?? "",
	);
	const navigate = useNavigate();

	const onSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const userToken = localStorage.getItem("userToken");
		if (!userToken) {
			toast.error("Login required to access dashboard");
			navigate("/login");
			return;
		}
		if (!roomName.trim()) return toast.error("Room name is required");
		const key = normalizeRoomKey(roomName);
		if (!key || !/^[a-z0-9_-]+$/.test(key)) {
			toast.error("Invalid room name");
			return;
		}
		localStorage.setItem("roomName", key);
		toast.success("Opening dashboard");
		navigate(`/dashboard/${encodeURIComponent(key)}`);
	};

	return (
		<div className="mx-auto flex min-h-[72vh] w-full max-w-xl items-center px-4 sm:px-0">
			<div className="w-full min-w-0">
				<div className="mb-6 text-center sm:mb-8">
					<h1 className="text-2xl font-bold sm:text-3xl">Open dashboard</h1>
					<p className="mt-2 text-sm text-base-content/70">Your user login already authenticates dashboard access.</p>
				</div>
				<div className="card border border-base-300 bg-base-100 shadow-2xl">
					<div className="card-body gap-4 p-4 sm:p-8 sm:gap-5">
						<form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-5">
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Room name</span>
								</div>
								<input
									className="input input-bordered w-full min-w-0"
									value={roomName}
									onChange={(e) => setRoomName(e.target.value)}
								/>
							</label>
							<button className="btn btn-primary mt-2 h-12 w-full text-base" type="submit">
								Open dashboard
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}
