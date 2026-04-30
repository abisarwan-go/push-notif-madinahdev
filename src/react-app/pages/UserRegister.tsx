import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { registerUser } from "../services/api";

export default function UserRegister() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

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
			navigate("/login");
		} catch (error) {
			toast.error("Register failed", {
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
					<h1 className="text-3xl font-bold">Create account</h1>
					<p className="mt-2 text-sm text-base-content/70">Username format: lowercase, digits, underscore.</p>
				</div>
				<div className="card border border-base-300 bg-base-100 shadow-2xl">
					<div className="card-body p-8">
						<form onSubmit={onSubmit} className="flex flex-col gap-5">
							<label className="form-control w-full">
								<div className="label">
									<span className="label-text font-medium">Username</span>
								</div>
								<input
									className="input input-bordered w-full"
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
									className="input input-bordered w-full"
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
									className="input input-bordered w-full"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
								/>
							</label>
							<button
								className="btn btn-primary mt-2 h-12 w-full text-base"
								disabled={loading || !username.trim() || !password.trim() || password !== confirmPassword}
							>
								{loading && <span className="loading loading-spinner loading-sm" />}
								Register
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}
