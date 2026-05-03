/**
 * Client bundle audit (lucide-react): `vite build` emits one main JS chunk (~330kB raw, ~98kB gzip
 * including React, router, DaisyUI CSS-in-JS paths, etc.). Named imports from `lucide-react` are
 * tree-shaken to used icons only — no per-icon path migration needed unless bundle analysis regresses.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [
		react(), cloudflare(), tailwindcss()],
	server: {
		port: 5174,
		allowedHosts: ['frontend-dev.work-circle.com']
	},
});
