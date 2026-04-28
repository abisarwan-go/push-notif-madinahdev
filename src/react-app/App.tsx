import { useEffect, useState } from "react";
import "./App.css";

type PublicProjectConfig = {
	id: string;
	name: string;
	vapidPublicKey: string;
};

function urlBase64ToUint8Array(base64String: string) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
	return outputArray;
}

function App() {
	const [projectId, setProjectId] = useState(localStorage.getItem("projectId") ?? "");
	const [dashboardToken, setDashboardToken] = useState(
		localStorage.getItem("dashboardToken") ?? "",
	);
	const [apiKey, setApiKey] = useState(localStorage.getItem("apiKey") ?? "");
	const [title, setTitle] = useState("Test notification");
	const [body, setBody] = useState("Hello from your Push SaaS MVP");
	const [status, setStatus] = useState("Idle");
	const [config, setConfig] = useState<PublicProjectConfig | null>(null);
	const [notifications, setNotifications] = useState<
		Array<{ id: string; title: string; status: string; createdAt: string }>
	>([]);

	useEffect(() => {
		localStorage.setItem("projectId", projectId);
	}, [projectId]);

	useEffect(() => {
		localStorage.setItem("dashboardToken", dashboardToken);
	}, [dashboardToken]);

	useEffect(() => {
		localStorage.setItem("apiKey", apiKey);
	}, [apiKey]);

	async function loadConfig() {
		if (!projectId) return;
		const res = await fetch(`/v1/public/${projectId}/config`);
		if (!res.ok) throw new Error(`Config fetch failed (${res.status})`);
		const data = (await res.json()) as PublicProjectConfig;
		setConfig(data);
	}

	async function subscribe() {
		setStatus("Subscribing...");
		if (!projectId) throw new Error("Missing projectId");
		await loadConfig();

		const currentConfig = config
			? config
			: ((await (await fetch(`/v1/public/${projectId}/config`)).json()) as PublicProjectConfig);
		if (!currentConfig.vapidPublicKey) {
			throw new Error("Missing VAPID public key for this project");
		}

		if (!("serviceWorker" in navigator)) throw new Error("Service Worker not supported");
		const permission = await Notification.requestPermission();
		if (permission !== "granted") throw new Error("Notification permission denied");

		await navigator.serviceWorker.register("/sw.js");
		const registration = await navigator.serviceWorker.ready;

		const existing = await registration.pushManager.getSubscription();
		const pushSubscription =
			existing ??
			(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(currentConfig.vapidPublicKey),
		}));
		const json = pushSubscription.toJSON();

		const payload = {
			endpoint: json.endpoint,
			p256dh: json.keys?.p256dh ?? "",
			auth: json.keys?.auth ?? "",
			userAgent: navigator.userAgent,
		};

		const res = await fetch(`/v1/public/${projectId}/subscribe`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!res.ok) throw new Error(`Subscribe failed (${res.status})`);
		setStatus("Subscribed successfully.");
	}

	async function sendByDashboard() {
		if (!projectId || !dashboardToken) throw new Error("Missing projectId/dashboardToken");
		setStatus("Sending (dashboard)...");
		const res = await fetch(`/v1/dashboard/projects/${projectId}/notifications`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-dashboard-token": dashboardToken,
			},
			body: JSON.stringify({ title, body }),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error ?? "Dashboard send failed");
		setStatus(`Dashboard sent. sent=${data.sent}, failed=${data.failed}`);
	}

	async function sendByApi() {
		if (!apiKey) throw new Error("Missing API key");
		setStatus("Sending (api key)...");
		const res = await fetch("/v1/notify", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-api-key": apiKey,
			},
			body: JSON.stringify({ title, body }),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error ?? "API send failed");
		setStatus(`API sent. sent=${data.sent}, failed=${data.failed}`);
	}

	async function loadNotifications() {
		if (!projectId || !dashboardToken) return;
		const res = await fetch(`/v1/dashboard/projects/${projectId}/notifications`, {
			headers: { "x-dashboard-token": dashboardToken },
		});
		if (!res.ok) throw new Error(`List failed (${res.status})`);
		const data = (await res.json()) as {
			items: Array<{ id: string; title: string; status: string; createdAt: string }>;
		};
		setNotifications(data.items);
	}

	return (
		<>
			<h1>Push SaaS MVP (Android PWA)</h1>
			<div className="card">
				<p>Project setup</p>
				<input
					placeholder="projectId"
					value={projectId}
					onChange={(e) => setProjectId(e.target.value)}
				/>
				<input
					placeholder="dashboardToken"
					value={dashboardToken}
					onChange={(e) => setDashboardToken(e.target.value)}
				/>
				<input placeholder="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
				<button onClick={() => loadConfig().catch((e: Error) => setStatus(e.message))}>
					Load public config
				</button>
				<button onClick={() => subscribe().catch((e: Error) => setStatus(e.message))}>
					Enable push on this device
				</button>
			</div>
			<div className="card">
				<p>Send notification</p>
				<input placeholder="title" value={title} onChange={(e) => setTitle(e.target.value)} />
				<input placeholder="body" value={body} onChange={(e) => setBody(e.target.value)} />
				<button
					onClick={() => sendByDashboard().catch((e: Error) => setStatus(e.message))}
				>
					Send via dashboard
				</button>
				<button onClick={() => sendByApi().catch((e: Error) => setStatus(e.message))}>
					Send via API key
				</button>
				<button onClick={() => loadNotifications().catch((e: Error) => setStatus(e.message))}>
					Refresh notification logs
				</button>
			</div>
			<div className="card">
				<p>Status: {status}</p>
				<p>Project: {config?.name ?? "not loaded"}</p>
				<ul>
					{notifications.map((item) => (
						<li key={item.id}>
							{item.title} - {item.status}
						</li>
					))}
				</ul>
			</div>
		</>
	);
}

export default App;
