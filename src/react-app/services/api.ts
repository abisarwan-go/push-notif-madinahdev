export type RoomCreateResponse = {
	ok: boolean;
	roomId: string;
	roomName: string;
	roomSlug: string;
	roomJoinCode: string;
	memberId: string;
	dashboardToken: string;
	apiKey: string;
};

export type RoomJoinResponse = {
	ok: boolean;
	memberId: string;
	roomName: string;
	roomSlug: string;
	projectId: string;
	displayName: string;
};

export type PublicProjectConfig = {
	id: string;
	name: string;
	vapidPublicKey: string;
};

type RoomStats = {
	roomId: string;
	roomName: string;
	roomSlug: string;
	membersCount: number;
	activeSubscribers: number;
};

async function parseJson<T>(res: Response): Promise<T> {
	const data = (await res.json().catch(() => ({}))) as T & { error?: string };
	if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
	return data;
}

export async function createRoom(payload: {
	roomName: string;
	password: string;
	ownerName: string;
	ownerEmail?: string;
}) {
	const res = await fetch("/v1/rooms/create", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});
	return parseJson<RoomCreateResponse>(res);
}

export async function createRoomFromForm(roomName: string, password?: string, ownerName = "Owner") {
	return createRoom({ roomName, password: password ?? "", ownerName });
}

export async function joinByName(roomName: string, payload: { password: string; displayName: string }) {
	const res = await fetch("/v1/rooms/join-by-name", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ roomName, ...payload }),
	});
	return parseJson<RoomJoinResponse>(res);
}

export async function joinRoomFromForm(roomName: string, displayName: string, password?: string) {
	return joinByName(roomName, { displayName, password: password ?? "" });
}

export async function createInvite(roomName: string, ttlMinutes = 5) {
	const dashboardToken = localStorage.getItem("dashboardToken") ?? "";
	if (!dashboardToken) throw new Error("Missing dashboard token");
	const res = await fetch("/v1/rooms/invite", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-dashboard-token": dashboardToken,
		},
		body: JSON.stringify({ roomName, ttlMinutes }),
	});
	return parseJson<{ ok: true; token: string; expiresAt: string; roomSlug: string }>(res);
}

export async function joinByToken(token: string, displayName: string) {
	const res = await fetch("/v1/rooms/join-by-token", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ token, displayName }),
	});
	return parseJson<RoomJoinResponse>(res);
}

export async function getRoomStats(roomName: string) {
	const res = await fetch(`/v1/rooms/${roomName}/stats`);
	return parseJson<RoomStats>(res);
}

export async function loadConfig(projectId: string) {
	const res = await fetch(`/v1/public/${projectId}/config`);
	return parseJson<PublicProjectConfig>(res);
}

export async function subscribeDevice(projectId: string, payload: Record<string, unknown>) {
	const res = await fetch(`/v1/rooms/${projectId}/subscribe`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});
	return parseJson<{ ok: true }>(res);
}

export async function sendByDashboard(projectId: string, dashboardToken: string, payload: { title: string; body: string }) {
	const res = await fetch(`/v1/dashboard/projects/${projectId}/notifications`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-dashboard-token": dashboardToken,
		},
		body: JSON.stringify(payload),
	});
	return parseJson<{ ok: true; sent: number; failed: number }>(res);
}

export async function sendNotification(projectId: string, title: string, body: string) {
	const dashboardToken = localStorage.getItem("dashboardToken") ?? "";
	if (!dashboardToken) throw new Error("Missing dashboard token in local storage");
	return sendByDashboard(projectId, dashboardToken, { title, body });
}
