import { Hono } from "hono";
import roomsApp from "./routes/rooms";
import usersApp from "./routes/users";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));
app.route("/v1/users", usersApp);
export const routes = app.route("/v1/rooms", roomsApp);

export type AppType = typeof routes;
export default app;
