import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

/** Same rules as worker `slugify` so dashboard URL matches stored room slug. */
function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

export default function OwnerLogin() {
	const [searchParams] = useSearchParams();
	const [roomName, setRoomName] = useState(searchParams.get("room") ?? localStorage.getItem("roomSlug") ?? "");
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
		const roomSlug = slugify(roomName);
		if (!roomSlug) {
			toast.error("Invalid room name");
			return;
		}
		localStorage.setItem("roomSlug", roomSlug);
		toast.success("Opening dashboard");
		navigate(`/dashboard/${encodeURIComponent(roomSlug)}`);
	};

	return (
		<div className="mx-auto flex min-h-[72vh] w-full max-w-xl items-center">
			<div className="w-full">
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-bold">Open dashboard</h1>
					<p className="mt-2 text-sm text-base-content/70">Your user login already authenticates dashboard access.</p>
				</div>
				<div className="card border border-base-300 bg-base-100 shadow-2xl">
					<div className="card-body p-8">
						<form onSubmit={onSubmit} className="flex flex-col gap-5">
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Room name or slug</span>
								</div>
								<input className="input input-bordered w-full" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
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
