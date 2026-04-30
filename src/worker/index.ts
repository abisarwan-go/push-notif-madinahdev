import { Hono } from "hono";
import roomsApp from "./routes/rooms";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));
app.route("/v1/rooms", roomsApp);

export default app;
