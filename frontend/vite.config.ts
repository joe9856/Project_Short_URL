import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rootShortLinkPattern } from "@short/routing";

// Vite อ่านค่าตอน dev/build: แปลง React/TSX จาก index.html → main.tsx → App เป็นไฟล์ที่ Browser โหลดได้
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
    proxy: { // ตอน dev Browser ขอ path เหล่านี้ที่พอร์ต 5173 → Vite ส่งต่อ Gateway 3000 → Service → Response กลับ Browser
      "/api/": { target: "http://127.0.0.1:3000", changeOrigin: false },
      "/s/": { target: "http://127.0.0.1:3000", changeOrigin: false },
      [`^/${rootShortLinkPattern}/?(?:\\?.*)?$`]: { // รับ Short URL ระดับ root ที่ไม่ชนชื่อหน้า React ตามกฎ packages/routing
        target: "http://127.0.0.1:3000",
        changeOrigin: false,
      },
    },
  },
});
