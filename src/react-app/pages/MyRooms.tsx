import { ChevronRight, DoorOpen, Home, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { fetchMyRooms } from "../services/api";

function SectionHeader({ icon: Icon, iconClass, label }: { icon: typeof Home; iconClass: string; label: string }) {
	return (
		<div className="flex items-center gap-3">
			<span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
				<Icon className="h-5 w-5" strokeWidth={2} />
			</span>
			<h2 className="text-lg font-semibold tracking-tight">{label}</h2>
		</div>
	);
}

export default function MyRooms() {
	const [owned, setOwned] = useState<Array<{ id: string; name: string }>>([]);
	const [joined, setJoined] = useState<Array<{ id: string; name: string }>>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			setLoading(true);
			try {
				const data = await fetchMyRooms();
				if (!cancelled) {
					setOwned(data.owned);
					setJoined(data.joined);
				}
			} catch (e) {
				if (!cancelled) {
					toast.error("Could not load your rooms", {
						description: e instanceof Error ? e.message : "Unknown error",
					});
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-0">
			<header className="space-y-2 border-b border-base-300 pb-6">
				<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My rooms</h1>
				<p className="max-w-xl text-sm leading-relaxed text-base-content/70">
					Every room you own or joined appears here. Open one for the owner dashboard or your member feed.
				</p>
				<div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
					<Link to="/create" className="btn btn-primary gap-2 sm:btn-md">
						<DoorOpen className="h-4 w-4 shrink-0" /> Create room
					</Link>
					<Link to="/join" className="btn btn-outline btn-primary gap-2 border-base-300 sm:btn-md">
						Join room
					</Link>
				</div>
			</header>

			{loading ? (
				<div className="flex justify-center py-16">
					<span className="loading loading-lg loading-spinner text-primary" />
				</div>
			) : (
				<div className="space-y-10">
					<section className="space-y-4">
						<SectionHeader icon={Home} iconClass="bg-primary/12 text-primary" label="Your rooms" />
						{owned.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-base-300 bg-base-200/20 px-5 py-10 text-center">
								<p className="text-sm text-base-content/65">You don’t own a room yet.</p>
								<p className="mt-1 text-xs text-base-content/50">Use Create room above to start one.</p>
							</div>
						) : (
							<div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
								<ul className="divide-y divide-base-200">
									{owned.map((r) => (
										<li key={r.id}>
											<Link
												to={`/dashboard/${encodeURIComponent(r.name)}`}
												className="group flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-base-200/35 sm:px-5 sm:py-[1.125rem]"
												title={r.name}
											>
												<span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug tracking-tight text-base-content group-hover:text-primary">
													{r.name}
												</span>
												<span className="flex shrink-0 items-center gap-2">
													<span className="badge badge-primary whitespace-nowrap px-3 text-xs font-medium">Owner</span>
													<ChevronRight className="h-4 w-4 shrink-0 text-base-content/25 transition-transform group-hover:translate-x-0.5 group-hover:text-base-content/45" />
												</span>
											</Link>
										</li>
									))}
								</ul>
							</div>
						)}
					</section>

					<section className="space-y-4">
						<SectionHeader icon={Users} iconClass="bg-secondary/12 text-secondary" label="Joined as member" />
						{joined.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-base-300 bg-base-200/20 px-5 py-10 text-center">
								<p className="text-sm text-base-content/65">You haven’t joined another room yet.</p>
								<p className="mt-1 text-xs text-base-content/50">Use Join room above when someone shares a room name.</p>
							</div>
						) : (
							<div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
								<ul className="divide-y divide-base-200">
									{joined.map((r) => (
										<li key={r.id}>
											<Link
												to={`/dashboard/${encodeURIComponent(r.name)}`}
												className="group flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-base-200/35 sm:px-5 sm:py-[1.125rem]"
												title={r.name}
											>
												<span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug tracking-tight text-base-content group-hover:text-secondary">
													{r.name}
												</span>
												<span className="flex shrink-0 items-center gap-2">
													<span className="badge badge-outline badge-secondary whitespace-nowrap px-3 text-xs font-medium">
														Member
													</span>
													<ChevronRight className="h-4 w-4 shrink-0 text-base-content/25 transition-transform group-hover:translate-x-0.5 group-hover:text-base-content/45" />
												</span>
											</Link>
										</li>
									))}
								</ul>
							</div>
						)}
					</section>
				</div>
			)}
		</div>
	);
}
