/// <reference types="vitest/config" />
import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

/** Set by `npm run dev:lan` so phones on Wi‑Fi can use the camera (HTTPS required). */
const enableLanHttps = process.env.VITE_LAN === "1";

export default defineConfig({
  plugins: [vue(), tailwindcss(), ...(enableLanHttps ? [basicSsl()] : [])],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: enableLanHttps ? true : undefined,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
