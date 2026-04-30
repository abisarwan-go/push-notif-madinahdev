import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { loginUser } from "../services/api";

export default function UserLogin() {
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
			toast.success("User authenticated");
			navigate("/create");
		} catch (error) {
			toast.error("Login failed", {
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
					<h1 className="text-3xl font-bold">User login</h1>
					<p className="mt-2 text-sm text-base-content/70">Sign in to manage your rooms.</p>
				</div>
				<div className="card border border-base-300 bg-base-100 shadow-2xl">
					<div className="card-body p-8">
						<form onSubmit={onSubmit} className="flex flex-col gap-5">
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Username</span>
								</div>
								<input className="input input-bordered w-full" value={username} onChange={(e) => setUsername(e.target.value)} />
							</label>
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Password</span>
								</div>
								<input
									type="password"
									className="input input-bordered w-full"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
							</label>
							<button className="btn btn-primary mt-2 h-12 w-full text-base" disabled={loading}>
								{loading && <span className="loading loading-spinner loading-sm" />}
								Login
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}
