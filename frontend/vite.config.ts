import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rootShortLinkPattern } from "@short/routing";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { include: ["@short/routing"] },
  build: {
    commonjsOptions: { include: [/node_modules/, /packages[\\/]routing/] },
    rollupOptions: { output: { manualChunks: { charts: ["recharts"] } } },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/": { target: "http://127.0.0.1:3000", changeOrigin: false },
      "/s/": { target: "http://127.0.0.1:3000", changeOrigin: false },
      [`^/${rootShortLinkPattern}/?(?:\\?.*)?$`]: {
        target: "http://127.0.0.1:3000",
        changeOrigin: false,
      },
    },
  },
});
