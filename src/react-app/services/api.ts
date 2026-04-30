export type RoomCreateResponse = {
	ok: boolean;
	roomName: string;
	roomSlug: string;
};

export type MemberJoinResponse = {
	ok: boolean;
	memberId: string;
	roomName: string;
	roomSlug: string;
	roomId: string;
	displayName: string;
};

export type RoomConfig = {
	roomSlug: string;
	roomName: string;
	vapidPublicKey: string;
};

type RoomStats = {
	roomId: string;
	roomName: string;
	roomSlug: string;
	membersCount: number;
	activeSubscriptions: number;
	notifications: Array<{ id: string; title: string; status: string; createdAt: string }>;
};

async function parseJson<T>(res: Response): Promise<T> {
	const data = (await res.json().catch(() => ({}))) as T & { error?: string };
	if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
	return data;
}

export async function createRoom(payload: {
	roomName: string;
	ownerPassword: string;
	joinPassword?: string;
	ownerDisplayName?: string;
}) {
	const res = await fetch("/v1/rooms/create", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});
	return parseJson<RoomCreateResponse>(res);
}

export async function createRoomFromForm(
	roomName: string,
	ownerPassword: string,
	joinPassword?: string,
	ownerDisplayName = "Owner",
) {
	return createRoom({ roomName, ownerPassword, joinPassword, ownerDisplayName });
}

export async function ownerLogin(roomName: string, ownerPassword: string) {
	const res = await fetch("/v1/rooms/owner/login", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ roomName, ownerPassword }),
	});
	return parseJson<{ ok: true; token: string; expiresInSec: number; roomSlug: string; roomName: string }>(res);
}

export async function joinRoom(roomName: string, displayName: string, joinPassword?: string) {
	const res = await fetch("/v1/rooms/join", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ roomName, displayName, joinPassword }),
	});
	return parseJson<MemberJoinResponse>(res);
}

export async function getRoomStats(roomName: string) {
	const token = localStorage.getItem("ownerToken") ?? "";
	if (!token) throw new Error("Missing owner token");
	const res = await fetch(`/v1/rooms/${roomName}/dashboard`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	return parseJson<RoomStats>(res);
}

export async function loadConfig(roomSlug: string) {
	const res = await fetch(`/v1/rooms/${roomSlug}/config`);
	return parseJson<RoomConfig>(res);
}

export async function subscribeDevice(roomSlug: string, payload: Record<string, unknown>) {
	const res = await fetch(`/v1/rooms/${roomSlug}/subscribe`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});
	return parseJson<{ ok: true }>(res);
}

export async function sendNotification(roomSlug: string, title: string, body: string) {
	const token = localStorage.getItem("ownerToken") ?? "";
	if (!token) throw new Error("Missing owner token in local storage");
	const res = await fetch(`/v1/rooms/${roomSlug}/notifications`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ title, body }),
	});
	return parseJson<{ ok: true; sent: number; failed: number }>(res);
}
