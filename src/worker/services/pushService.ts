import { postWebPushToSubscription, vapidKeysFromEnv } from "../lib/webPushSend";
import prismaClients from "../lib/prismaClient";
import type { SendPayload, AppContext } from "../types";

function pushResponseDetail(res: Response): { statusCode: number; message: string } {
	const statusCode = res.status;
	return { statusCode, message: `HTTP ${res.status}` };
}

export async function sendToProjectSubscribers(
	c: AppContext,
	roomId: string,
	roomNameForUrl: string,
	payload: SendPayload,
) {
	const prisma = await prismaClients.fetch(c.env.DB);
	const subscriptions = await prisma.subscription.findMany({ where: { roomId, status: "ACTIVE" } });
	const notification = await prisma.notification.create({
		data: { roomId, title: payload.title, body: payload.body, url: payload.url, status: "QUEUED" },
	});
	if (subscriptions.length === 0) {
		await prisma.notification.update({
			where: { id: notification.id },
			data: { status: "FAILED", sentAt: new Date() },
		});
		return { notificationId: notification.id, sent: 0, failed: 0 };
	}

	const vapid = vapidKeysFromEnv(c.env);
	const defaultClickUrl = `/dashboard/${encodeURIComponent(roomNameForUrl)}`;
	const payloadJson = {
		title: payload.title,
		body: payload.body,
		url: payload.url?.trim() || defaultClickUrl,
		tag: notification.id,
	};

	let sent = 0;
	let failed = 0;
	for (const sub of subscriptions) {
		try {
			const res = await postWebPushToSubscription(
				{ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
				payloadJson,
				vapid,
			);
			if (res.ok) {
				sent += 1;
				await prisma.deliveryLog.create({
					data: { notificationId: notification.id, subscriptionId: sub.id, status: "SENT" },
				});
			} else {
				failed += 1;
				const { statusCode, message } = pushResponseDetail(res);
				const text = await res.text();
				await prisma.deliveryLog.create({
					data: {
						notificationId: notification.id,
						subscriptionId: sub.id,
						status: "FAILED",
						errorCode: String(statusCode),
						errorMessage: (text || message).slice(0, 500),
					},
				});
				if (statusCode === 404 || statusCode === 410) {
					await prisma.subscription.update({ where: { id: sub.id }, data: { status: "INVALID" } });
				}
			}
		} catch (error) {
			failed += 1;
			await prisma.deliveryLog.create({
				data: {
					notificationId: notification.id,
					subscriptionId: sub.id,
					status: "FAILED",
					errorMessage: error instanceof Error ? error.message.slice(0, 500) : "unknown",
				},
			});
		}
	}
	const status = failed === 0 ? "SENT" : sent > 0 ? "PARTIAL" : "FAILED";
	await prisma.notification.update({ where: { id: notification.id }, data: { status, sentAt: new Date() } });
	return { notificationId: notification.id, sent, failed, status };
}
