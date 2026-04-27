import { Hono } from "hono";
import prismaClients from "./lib/prismaClient";


type Bindings = {
    MY_KV: KVNamespace
    DB: D1Database
    Env: Env
}

const app = new Hono<{ Bindings: Bindings }>()

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));
app.get('/', async (c) => {
    const prisma = await prismaClients.fetch(c.env.DB)
    const users = await prisma.user.findMany()
    console.log('users', users)
    return c.json(users)
 })

export default app;
