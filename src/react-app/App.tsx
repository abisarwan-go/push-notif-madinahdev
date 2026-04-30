import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
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
	isAuthenticated,
	username,
	onLogout,
}: {
	children: React.ReactNode;
	theme: ThemeMode;
	onToggleTheme: () => void;
	isAuthenticated: boolean;
	username: string;
	onLogout: () => void;
}) {
	return (
		<div className="flex min-h-screen flex-col">
			<header className="sticky top-0 z-50 border-b border-base-300 bg-base-100/90 backdrop-blur">
				<div className="navbar mx-auto max-w-7xl px-4">
					<Link to="/" className="btn btn-ghost text-xl normal-case">
						RoomPush
					</Link>
					<nav className="ml-auto flex items-center gap-1 md:gap-2">
						<Link to="/create" className="btn btn-ghost btn-sm">
							Create
						</Link>
						<Link to="/join" className="btn btn-ghost btn-sm">
							Join
						</Link>
						{!isAuthenticated ? (
							<>
								<Link to="/register" className="btn btn-ghost btn-sm">
									Register
								</Link>
								<Link to="/login" className="btn btn-ghost btn-sm">
									Login
								</Link>
							</>
						) : (
							<>
								<span className="badge badge-outline mr-1 hidden md:inline-flex">{username}</span>
								<button className="btn btn-ghost btn-sm" onClick={onLogout} type="button">
									Logout
								</button>
							</>
						)}
						<label className="swap swap-rotate btn btn-ghost btn-sm px-2">
							<input type="checkbox" checked={theme === "dim"} onChange={onToggleTheme} />
							<Sun className="swap-off h-4 w-4" />
							<Moon className="swap-on h-4 w-4" />
						</label>
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
	const [authState, setAuthState] = useState(() => ({
		isAuthenticated: Boolean(localStorage.getItem("userToken")),
		username: localStorage.getItem("username") ?? "",
	}));

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		localStorage.setItem("themeMode", theme);
	}, [theme]);

	useEffect(() => {
		const refreshAuthState = () =>
			setAuthState({
				isAuthenticated: Boolean(localStorage.getItem("userToken")),
				username: localStorage.getItem("username") ?? "",
			});
		window.addEventListener("storage", refreshAuthState);
		window.addEventListener("auth-changed", refreshAuthState);
		return () => {
			window.removeEventListener("storage", refreshAuthState);
			window.removeEventListener("auth-changed", refreshAuthState);
		};
	}, []);

	const toasterTheme = useMemo(() => (theme === "light" ? "light" : "dark"), [theme]);
	const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dim" : "light"));
	const logout = () => {
		localStorage.removeItem("userToken");
		localStorage.removeItem("username");
		localStorage.removeItem("ownerToken");
		window.dispatchEvent(new Event("auth-changed"));
	};

	return (
		<BrowserRouter>
			<AppShell
				theme={theme}
				onToggleTheme={toggleTheme}
				isAuthenticated={authState.isAuthenticated}
				username={authState.username}
				onLogout={logout}
			>
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
