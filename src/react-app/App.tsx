import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import "./App.css";
import Home from "./pages/Home";
import CreateRoom from "./pages/CreateRoom";
import JoinRoom from "./pages/JoinRoom";
import OwnerLogin from "./pages/OwnerLogin";
import RoomDashboard from "./pages/RoomDashboard";
import UserRegister from "./pages/UserRegister";
import UserLogin from "./pages/UserLogin";

type ThemeMode = "light" | "dim";

function AppShell({
	children,
	theme,
	onToggleTheme,
}: {
	children: React.ReactNode;
	theme: ThemeMode;
	onToggleTheme: () => void;
}) {
	return (
		<div className="flex min-h-screen flex-col">
			<header className="sticky top-0 z-50 border-b border-base-300 bg-base-100/90 backdrop-blur">
				<div className="navbar mx-auto max-w-7xl px-4">
					<Link to="/" className="btn btn-ghost text-xl normal-case">
						RoomPush
					</Link>
					<nav className="ml-auto flex items-center gap-2">
						<Link to="/create" className="btn btn-ghost btn-sm">
							Create
						</Link>
						<Link to="/join" className="btn btn-ghost btn-sm">
							Join
						</Link>
						<Link to="/owner-login" className="btn btn-ghost btn-sm">
							Owner
						</Link>
						<Link to="/register" className="btn btn-ghost btn-sm">
							Register
						</Link>
						<Link to="/login" className="btn btn-ghost btn-sm">
							Login
						</Link>
						<button className="btn btn-ghost btn-sm" onClick={onToggleTheme} type="button">
							{theme === "light" ? "Dark" : "Light"}
						</button>
					</nav>
				</div>
			</header>
			<main className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-6">{children}</main>
			<footer className="py-6 text-center text-sm text-base-content/60">
				&copy; {new Date().getFullYear()} Room Push
			</footer>
		</div>
	);
}

export default function App() {
	const [theme, setTheme] = useState<ThemeMode>(() => {
		const saved = localStorage.getItem("themeMode");
		return saved === "light" || saved === "dim" ? saved : "light";
	});

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		localStorage.setItem("themeMode", theme);
	}, [theme]);

	const toasterTheme = useMemo(() => (theme === "light" ? "light" : "dark"), [theme]);

	const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dim" : "light"));

	return (
		<BrowserRouter>
			<AppShell theme={theme} onToggleTheme={toggleTheme}>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/create" element={<CreateRoom />} />
					<Route path="/join" element={<JoinRoom />} />
					<Route path="/owner-login" element={<OwnerLogin />} />
					<Route path="/register" element={<UserRegister />} />
					<Route path="/login" element={<UserLogin />} />
					<Route path="/dashboard/:roomName" element={<RoomDashboard />} />
				</Routes>
			</AppShell>
			<Toaster theme={toasterTheme} position="top-right" richColors />
		</BrowserRouter>
	);
}
