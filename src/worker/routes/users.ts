import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { jsonError } from "../lib/http";
import { userAuthSchema } from "../lib/validators";
import { loginUser, registerUser } from "../services/userService";
import type { AppEnv } from "../types";

const usersApp = new Hono<AppEnv>();

const validateUserAuth = zValidator("json", userAuthSchema, (result) => {
	if (!result.success) return jsonError("Invalid user auth payload", 400);
});

usersApp.post("/register", validateUserAuth, async (c) => {
	const body = c.req.valid("json");
	const created = await registerUser(c, body.username, body.password);
	if (!created.ok) return jsonError("Username already taken", 409);
	return c.json(created);
});

usersApp.post("/login", validateUserAuth, async (c) => {
	const body = c.req.valid("json");
	const logged = await loginUser(c, body.username, body.password);
	if (logged === null || logged === false) return jsonError("Invalid username or password", 401);
	return c.json({ ok: true, ...logged });
});

export default usersApp;
