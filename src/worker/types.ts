import type { Context } from "hono";

export type Bindings = {
	DB: D1Database;
	VAPID_PUBLIC_KEY?: string;
	VAPID_PRIVATE_JWK?: string;
	VAPID_SUBJECT?: string;
	ROOM_OWNER_JWT_SECRET?: string;
	USER_JWT_SECRET?: string;
};

export type AppEnv = { Bindings: Bindings };
export type AppContext = Context<AppEnv>;

export type PushSubscriptionInput = {
	endpoint: string;
	p256dh: string;
	auth: string;
	userAgent?: string;
	memberId?: string;
	displayName?: string;
};

export type SendPayload = {
	title: string;
	body: string;
	url?: string;
};
