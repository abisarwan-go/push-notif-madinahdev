/** Internal post-login redirect; ignores open redirects. */
export function safeNextPath(raw: string | null): string {
	if (!raw) return "/create";
	const v = decodeURIComponent(raw).trim();
	if (!v.startsWith("/") || v.startsWith("//")) return "/create";
	if (v === "/create" || v === "/join" || v === "/rooms" || v.startsWith("/dashboard/")) return v;
	return "/create";
}
