import rpcClient from "./rpcClient";

export type RoomCreateResponse = {
	ok: boolean;
	roomName: string;
	roomId: string;
};

export type UserAuthResponse = {
	ok: true;
	user: { id: string; username: string };
	token: string;
	expiresInSec: number;
};

export type MemberJoinResponse = {
	ok: boolean;
	memberId: string;
	roomName: string;
	roomId: string;
	displayName: string;
};

export type RoomConfig = {
	roomName: string;
	vapidPublicKey: string;
};

export type MyRoomsResponse = {
	ok: true;
	owned: Array<{ id: string; name: string }>;
	joined: Array<{ id: string; name: string }>;
};

type RoomStats = {
	ok?: boolean;
	viewerRole: "OWNER" | "MEMBER";
	roomId: string;
	roomName: string;
	membersCount: number;
	activeSubscriptions: number;
	integrationConfigured: boolean;
	notifications: Array<{ id: string; title: string; body?: string; status: string; createdAt: string }>;
};

export type RotateIntegrationResponse = {
	ok: true;
	secret: string;
	roomName: string;
	integrationPath: string;
	hint: string;
};

async function parseJson<T>(res: Response): Promise<T> {
	const data = (await res.json().catch(() => ({}))) as T & { error?: string };
	if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
	return data;
}

export async function fetchMyRooms(): Promise<MyRoomsResponse> {
	const token = localStorage.getItem("userToken") ?? "";
	if (!token) throw new Error("Authentication required: login first");
	const res = await rpcClient.v1.rooms.mine.$get(
		{},
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	return parseJson<MyRoomsResponse>(res);
}

export async function createRoom(payload: { roomName: string; joinPassword?: string }) {
	const token = localStorage.getItem("userToken") ?? "";
	if (!token) throw new Error("Authentication required: login first");
	const res = await rpcClient.v1.rooms.create.$post(
		{ json: payload },
		{
			headers: { Authorization: `Bearer ${token}` },
		},
	);
	return parseJson<RoomCreateResponse>(res);
}

export async function createRoomFromForm(roomName: string, joinPassword?: string) {
	return createRoom({ roomName, joinPassword });
}

export async function joinRoom(roomName: string, joinPassword?: string) {
	const token = localStorage.getItem("userToken") ?? "";
	if (!token) throw new Error("Authentication required: login first");
	const res = await rpcClient.v1.rooms.join.$post(
		{ json: { roomName, joinPassword } },
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	return parseJson<MemberJoinResponse>(res);
}

export async function getRoomStats(roomName: string) {
	const token = localStorage.getItem("userToken") ?? "";
	if (!token) throw new Error("Missing user token");
	const res = await rpcClient.v1.rooms[":roomName"].dashboard.$get(
		{ param: { roomName } },
		{
			headers: { Authorization: `Bearer ${token}` },
		},
	);
	return parseJson<RoomStats>(res);
}

export async function loadConfig(roomName: string) {
	const res = await rpcClient.v1.rooms[":roomName"].config.$get({
		param: { roomName },
	});
	return parseJson<RoomConfig>(res);
}

export async function subscribeDevice(roomName: string, payload: Record<string, unknown>) {
	const res = await rpcClient.v1.rooms[":roomName"].subscribe.$post({
		param: { roomName },
		json: payload,
	});
	return parseJson<{ ok: true }>(res);
}

export async function sendNotification(roomName: string, title: string, body: string) {
	const token = localStorage.getItem("userToken") ?? "";
	if (!token) throw new Error("Missing user token in local storage");
	const res = await rpcClient.v1.rooms[":roomName"].notifications.$post(
		{
			param: { roomName },
			json: { title, body },
		},
		{
			headers: {
				Authorization: `Bearer ${token}`,
			},
		},
	);
	return parseJson<{ ok: true; sent: number; failed: number }>(res);
}

export async function rotateRoomIntegrationSecret(roomName: string) {
	const token = localStorage.getItem("userToken") ?? "";
	if (!token) throw new Error("Missing user token");
	const res = await rpcClient.v1.rooms[":roomName"].integrations.rotate.$post(
		{ param: { roomName } },
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	return parseJson<RotateIntegrationResponse>(res);
}

export async function registerUser(username: string, password: string) {
	const res = await rpcClient.v1.users.register.$post({
		json: { username, password },
	});
	return parseJson<UserAuthResponse>(res);
}

export async function loginUser(username: string, password: string) {
	const res = await rpcClient.v1.users.login.$post({
		json: { username, password },
	});
	return parseJson<UserAuthResponse>(res);
}
