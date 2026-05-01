import { ArrowRight, ShieldCheck, Users2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
	const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem("userToken")));

	useEffect(() => {
		const sync = () => setIsAuthenticated(Boolean(localStorage.getItem("userToken")));
		window.addEventListener("auth-changed", sync);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener("auth-changed", sync);
			window.removeEventListener("storage", sync);
		};
	}, []);

	return (
		<div className="mx-auto flex min-h-[75vh] w-full max-w-5xl flex-col items-center justify-center gap-12 py-8">
			<div className="space-y-5 text-center">
				<div className="badge badge-outline badge-lg">
					<span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
					Real-time push rooms on Cloudflare
				</div>
				<h1 className="text-4xl font-black leading-tight md:text-6xl">
					Broadcast signals
					<br />
					<span className="text-primary">without friction.</span>
				</h1>
				<p className="mx-auto max-w-2xl text-base-content/70 md:text-lg">
					Create secure rooms to send real-time notifications to users, teams, and devices in
					seconds.
				</p>
			</div>

			<div className="flex flex-col items-center gap-4">
				{!isAuthenticated && (
					<div className="flex flex-col items-center gap-3">
						<Link to="/login" className="btn btn-primary btn-lg px-10">
							Sign in <ArrowRight className="h-4 w-4" />
						</Link>
						<p className="max-w-md text-center text-sm text-base-content/70">
							Creating a room is tied to your account. Join a room stays open without an account.
						</p>
					</div>
				)}
			</div>

			<div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
				<Link
					to={isAuthenticated ? "/create" : "/login?next=/create"}
					className="card border border-base-300 bg-base-100 transition hover:shadow-xl"
				>
					<div className="card-body">
						<div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary">
							<Zap className="h-6 w-6" />
						</div>
						<h3 className="card-title">
							Create a Room <ArrowRight className="h-4 w-4" />
						</h3>
						<p className="text-sm text-base-content/70">Set up a private notification room in one step.</p>
						{!isAuthenticated ? (
							<p className="text-xs font-medium text-primary">Requires sign-in — click to continue</p>
						) : null}
					</div>
				</Link>
				<Link to="/join" className="card border border-base-300 bg-base-100 transition hover:shadow-xl">
					<div className="card-body">
						<div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/20 text-secondary">
							<Users2 className="h-6 w-6" />
						</div>
						<h3 className="card-title">
							Join a Room <ArrowRight className="h-4 w-4" />
						</h3>
						<p className="text-sm text-base-content/70">Connect your device and start receiving push updates.</p>
					</div>
				</Link>
			</div>

			<div className="grid w-full gap-4 border-t border-base-300 pt-8 md:grid-cols-3">
				<article className="card border border-base-300 bg-base-100">
					<div className="card-body p-5">
						<ShieldCheck className="h-5 w-5 text-success" />
						<h4 className="font-semibold">Secure by design</h4>
						<p className="text-sm text-base-content/70">User-authenticated dashboard access and optional room join password.</p>
					</div>
				</article>
				<article className="card border border-base-300 bg-base-100">
					<div className="card-body p-5">
						<Zap className="h-5 w-5 text-primary" />
						<h4 className="font-semibold">Low latency</h4>
						<p className="text-sm text-base-content/70">Cloudflare Workers keep notification delivery fast and global.</p>
					</div>
				</article>
				<article className="card border border-base-300 bg-base-100">
					<div className="card-body p-5">
						<Users2 className="h-5 w-5 text-info" />
						<h4 className="font-semibold">Simple workflow</h4>
						<p className="text-sm text-base-content/70">Create room, join room, and broadcast from one dashboard.</p>
					</div>
				</article>
			</div>
		</div>
	);
}
