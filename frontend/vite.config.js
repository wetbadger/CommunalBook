// frontend/vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:3000',  // Use service name from docker-compose
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      },
      '/socket.io': {
        target: 'http://backend:3000',
        changeOrigin: true,
        ws: true
      }
    }
  }
})