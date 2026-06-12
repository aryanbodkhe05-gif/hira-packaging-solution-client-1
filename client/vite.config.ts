import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served from https://aryanbodkhe05-gif.github.io/packflow-erp/ on GitHub Pages
  base: process.env.GITHUB_PAGES ? '/packflow-erp/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
