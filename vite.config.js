import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_PAGES || process.env.GITHUB_ACTIONS ? "/infinity-mirror/" : "/",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
