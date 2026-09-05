import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ปลายทาง backend: ใน Docker จะส่งมาเป็น http://server:4000 (ชื่อ service)
// นอก Docker ใช้ค่าเริ่มต้น http://localhost:4000
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000'
// bind mount บน Windows + Docker ต้องใช้ polling ถึงจะ hot-reload ได้
const usePolling = process.env.VITE_USE_POLLING === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 0.0.0.0 — ให้เข้าจากนอก container / เครื่องอื่นใน LAN ได้
    port: 5173,
    proxy: {
      // ส่งทุก request ที่ขึ้นต้นด้วย /api ไปยัง backend (Express :4000)
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
  },
})
