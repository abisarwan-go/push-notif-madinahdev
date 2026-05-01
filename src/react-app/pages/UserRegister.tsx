import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { safeNextPath } from "../lib/nav";
import { registerUser } from "../services/api";

export default function UserRegister() {
	const [searchParams] = useSearchParams();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();
	const nextParam = searchParams.get("next");
	const loginHref = nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : "/login";

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!username.trim() || !password.trim()) return toast.error("Username and password are required");
		if (password !== confirmPassword) return toast.error("Passwords do not match");
		setLoading(true);
		try {
			const result = await registerUser(username.trim(), password.trim());
			localStorage.setItem("userToken", result.token);
			localStorage.setItem("username", result.user.username);
			window.dispatchEvent(new Event("auth-changed"));
			toast.success("Account created");
			navigate(safeNextPath(searchParams.get("next")));
		} catch (error) {
			toast.error("Register failed", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="mx-auto flex min-h-[72vh] w-full max-w-xl items-center px-4 sm:px-0">
			<div className="w-full min-w-0">
				<div className="mb-6 text-center sm:mb-8">
					<h1 className="text-2xl font-bold sm:text-3xl">Create account</h1>
					<p className="mt-2 text-sm text-base-content/70">Username format: lowercase, digits, underscore.</p>
				</div>
				<div className="card border border-base-300 bg-base-100 shadow-2xl">
					<div className="card-body gap-4 p-4 sm:p-8 sm:gap-5">
						<form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-5">
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Username</span>
								</div>
								<input
									className="input input-bordered w-full min-w-0"
									placeholder="madinah_dev"
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
									className="input input-bordered w-full min-w-0"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
							</label>
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Confirm password</span>
								</div>
								<input
									type="password"
									className="input input-bordered w-full min-w-0"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
								/>
							</label>
							<button
								className="btn btn-primary mt-2 h-12 w-full text-base"
								type="submit"
								disabled={loading || !username.trim() || !password.trim() || password !== confirmPassword}
							>
								{loading && <span className="loading loading-spinner loading-sm" />}
								Create account
							</button>
						</form>
						<p className="mt-6 text-center text-sm text-base-content/70">
							Already have an account?{" "}
							<Link to={loginHref} className="link link-primary font-medium">
								Sign in
							</Link>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
