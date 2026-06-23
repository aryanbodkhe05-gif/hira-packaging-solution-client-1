import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // On GitHub Pages the site is served from /<repo>/. Derive the base from
  // GITHUB_REPOSITORY ("owner/repo", set by Actions) so this works for both the
  // packflow-erp and hira-packaging-solution-client-1 repos. Local dev uses '/'.
  base: process.env.GITHUB_PAGES
    ? `/${(process.env.GITHUB_REPOSITORY || 'packflow-erp').split('/')[1]}/`
    : '/',
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
