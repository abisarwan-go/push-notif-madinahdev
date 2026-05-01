import { z } from "zod";
import { isValidHandle, normalizeHandle } from "./crypto";

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const handleString = z
	.string()
	.trim()
	.min(3)
	.max(32)
	.transform((value) => normalizeHandle(value))
	.refine((value) => isValidHandle(value), {
		message: "Must match ^[a-z][a-z0-9_]{2,31}$",
	});

export const roomSlugParamSchema = z.object({
	roomSlug: trimmed(120),
});

export const authHeaderSchema = z.object({
	authorization: z.string().trim().min(1),
});

export const roomCreateSchema = z.object({
	roomName: handleString,
	joinPassword: z.string().trim().max(120).optional(),
});

export const ownerLoginSchema = z.object({
	roomName: handleString,
	ownerPassword: trimmed(120),
});

export const roomJoinSchema = z
	.object({
		roomName: handleString,
		displayName: trimmed(60),
		joinPassword: z.string().trim().max(120).optional(),
		password: z.string().trim().max(120).optional(),
	})
	.transform((value) => ({
		roomName: value.roomName,
		displayName: value.displayName,
		joinPassword: value.joinPassword || value.password || undefined,
	}));

export const userAuthSchema = z.object({
	username: handleString,
	password: trimmed(120),
});

export const subscriptionSchema = z.object({
	endpoint: trimmed(4000),
	p256dh: trimmed(2000),
	auth: trimmed(1000),
	userAgent: z.string().trim().max(300).optional(),
	memberId: z.string().trim().min(1).max(120).optional(),
	displayName: z.string().trim().min(1).max(60).optional(),
});

export const sendPayloadSchema = z.object({
	title: trimmed(200),
	body: trimmed(4000),
	url: z.string().trim().max(2000).optional(),
});
