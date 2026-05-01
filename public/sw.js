self.addEventListener("push", (event) => {
	let title = "New notification";
	let body = "You have a new update.";
	let url = "/";
	let tag = undefined;

	try {
		if (event.data) {
			const parsed = event.data.json();
			if (parsed.title != null && String(parsed.title).trim() !== "") {
				title = String(parsed.title);
			}
			if ("body" in parsed && parsed.body != null) {
				body = String(parsed.body);
			}
			if (parsed.url != null && String(parsed.url).trim() !== "") {
				url = String(parsed.url);
			}
			if (parsed.tag != null && String(parsed.tag).trim() !== "") {
				tag = String(parsed.tag);
			}
		}
	} catch (_) {
		// Keep fallback values if payload is empty or invalid JSON.
	}

	const options = {
		body,
		data: { url },
		icon: "/icon-192.png",
		badge: "/favicon-32.png",
		...(tag ? { tag } : {}),
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const targetUrl = event.notification.data?.url || "/";

	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
			for (const client of clients) {
				if ("focus" in client) {
					client.focus();
					client.navigate(targetUrl);
					return;
				}
			}
			if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
			return undefined;
		}),
	);
});
