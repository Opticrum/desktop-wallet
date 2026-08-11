import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Opticrum Desktop 前端。
// 端口用 5174（mockup 参考项目独占 5173，避免冲突）。
// clearScreen/strictPort 是 Tauri WebView 对接 vite dev server 的要求。
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5174,
    strictPort: true,
  },
})
