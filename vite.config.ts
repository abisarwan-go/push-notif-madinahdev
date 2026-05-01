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
