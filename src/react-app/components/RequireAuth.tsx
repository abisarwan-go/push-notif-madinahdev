import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

/** Redirects to `/` when no `userToken` (central guard for app-only routes). */
export default function RequireAuth() {
	const [hasToken, setHasToken] = useState(() => Boolean(localStorage.getItem("userToken")));

	useEffect(() => {
		const sync = () => setHasToken(Boolean(localStorage.getItem("userToken")));
		window.addEventListener("auth-changed", sync);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener("auth-changed", sync);
			window.removeEventListener("storage", sync);
		};
	}, []);

	if (!hasToken) return <Navigate to="/" replace />;
	return <Outlet />;
}
