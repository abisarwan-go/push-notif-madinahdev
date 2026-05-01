import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Route, Routes, useNavigate } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";
import "./App.css";
import RequireAuth from "./components/RequireAuth";
import Home from "./pages/Home";
import CreateRoom from "./pages/CreateRoom";
import JoinRoom from "./pages/JoinRoom";
import MyRooms from "./pages/MyRooms";
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
				<div className="navbar mx-auto max-w-7xl flex-wrap gap-y-2 px-3 py-2 sm:px-4">
					<Link to="/" className="btn btn-ghost shrink-0 text-lg normal-case sm:text-xl">
						RoomPush
					</Link>
					<nav className="flex flex-1 flex-wrap items-center justify-end gap-1 sm:ml-auto sm:flex-nowrap sm:gap-2">
						{isAuthenticated ? (
							<>
								<Link to="/rooms" className="btn btn-ghost btn-xs whitespace-nowrap sm:btn-sm">
									My rooms
								</Link>
								<Link to="/create" className="btn btn-ghost btn-xs sm:btn-sm">
									Create
								</Link>
								<Link to="/join" className="btn btn-ghost btn-xs sm:btn-sm">
									Join
								</Link>
							</>
						) : null}
						{!isAuthenticated ? (
							<Link to="/login" className="btn btn-primary btn-xs sm:btn-sm">
								Login
							</Link>
						) : (
							<>
								<span className="badge badge-outline max-w-[8rem] truncate sm:mr-1 sm:max-w-none md:inline-flex">
									{username}
								</span>
								<button className="btn btn-ghost btn-xs sm:btn-sm" onClick={onLogout} type="button">
									Logout
								</button>
							</>
						)}
						<label className="swap swap-rotate btn btn-ghost btn-xs px-2 sm:btn-sm">
							<input type="checkbox" checked={theme === "dim"} onChange={onToggleTheme} />
							<Sun className="swap-off h-4 w-4" />
							<Moon className="swap-on h-4 w-4" />
						</label>
					</nav>
				</div>
			</header>
			<main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col p-4 sm:p-6">{children}</main>
			<footer className="px-4 py-6 text-center text-sm text-base-content/60">
				&copy; {new Date().getFullYear()} Room Push
			</footer>
		</div>
	);
}

function AppRoutes() {
	const navigate = useNavigate();
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
		localStorage.removeItem("roomSlug");
		window.dispatchEvent(new Event("auth-changed"));
		navigate("/", { replace: true });
	};

	return (
		<>
			<AppShell
				theme={theme}
				onToggleTheme={toggleTheme}
				isAuthenticated={authState.isAuthenticated}
				username={authState.username}
				onLogout={logout}
			>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/register" element={<UserRegister />} />
					<Route path="/login" element={<UserLogin />} />
					<Route element={<RequireAuth />}>
						<Route path="/create" element={<CreateRoom />} />
						<Route path="/join" element={<JoinRoom />} />
						<Route path="/rooms" element={<MyRooms />} />
						<Route path="/owner-login" element={<OwnerLogin />} />
						<Route path="/dashboard/:roomName" element={<RoomDashboard />} />
					</Route>
				</Routes>
			</AppShell>
			<Toaster theme={toasterTheme} position="top-center" richColors />
		</>
	);
}

export default function App() {
	return (
		<BrowserRouter>
			<AppRoutes />
		</BrowserRouter>
	);
}
