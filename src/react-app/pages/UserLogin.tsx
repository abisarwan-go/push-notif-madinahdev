import { LogIn, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { safeNextPath } from "../lib/nav";
import { loginUser } from "../services/api";

export default function UserLogin() {
	const [searchParams] = useSearchParams();
	const [username, setUsername] = useState(localStorage.getItem("username") ?? "");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!username.trim() || !password.trim()) return toast.error("Username and password are required");
		setLoading(true);
		try {
			const result = await loginUser(username.trim(), password.trim());
			localStorage.setItem("userToken", result.token);
			localStorage.setItem("username", result.user.username);
			window.dispatchEvent(new Event("auth-changed"));
			toast.success("Signed in");
			navigate(safeNextPath(searchParams.get("next")));
		} catch (error) {
			toast.error("Login failed", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setLoading(false);
		}
	};

	const nextParam = searchParams.get("next");
	const registerHref = nextParam ? `/register?next=${encodeURIComponent(nextParam)}` : "/register";

	return (
		<div className="mx-auto flex min-h-[72vh] w-full max-w-xl items-center">
			<div className="w-full">
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-bold">Sign in</h1>
					<p className="mt-2 text-sm text-base-content/70">Use your RoomPush account to create rooms and open dashboards.</p>
				</div>
				<div className="card border border-base-300 bg-base-100 shadow-2xl">
					<div className="card-body gap-0 p-0 sm:p-2">
						<div className="p-6 sm:p-8">
							<form onSubmit={onSubmit} className="flex flex-col gap-5">
								<label className="form-control w-full">
									<div className="label">
										<span className="label-text font-medium">Username</span>
									</div>
									<input
										className="input input-bordered w-full bg-base-200/50 focus:bg-base-100"
										autoComplete="username"
										value={username}
										onChange={(e) => setUsername(e.target.value)}
									/>
								</label>
								<label className="form-control w-full">
									<div className="label">
										<span className="label-text font-medium">Password</span>
									</div>
									<input
										type="password"
										className="input input-bordered w-full bg-base-200/50 focus:bg-base-100"
										autoComplete="current-password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
									/>
								</label>
								<button className="btn btn-primary mt-1 h-12 w-full gap-2 text-base" type="submit" disabled={loading}>
									{loading ? <span className="loading loading-spinner loading-sm" /> : <LogIn className="h-4 w-4" />}
									Sign in
								</button>
							</form>
						</div>

						<div className="divider my-0 px-6 text-xs text-base-content/50 sm:px-8">or</div>

						<div className="rounded-b-2xl bg-gradient-to-br from-primary/10 via-base-200/40 to-secondary/10 p-6 sm:p-8">
							<div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
								<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-base-100 shadow-inner ring-1 ring-base-300">
									<UserPlus className="h-7 w-7 text-primary" />
								</div>
								<div className="min-w-0 flex-1 space-y-1">
									<p className="font-semibold text-base-content">New to RoomPush?</p>
									<p className="text-sm text-base-content/70">Create a free account in under a minute, then create your first room.</p>
								</div>
								<Link to={registerHref} className="btn btn-outline btn-primary shrink-0 gap-2 border-primary/40">
									Create account
								</Link>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
