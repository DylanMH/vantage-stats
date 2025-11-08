import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for Electron
  build: {
    outDir: '../public', // Build to public folder for Electron to serve
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' }
  }
})
