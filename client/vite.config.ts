import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // On GitHub Pages the site is served from /<repo>/. Derive the base from
  // GITHUB_REPOSITORY ("owner/repo", set by Actions) so this works for both the
  // packflow-erp and hira-packaging-solution-client-1 repos. Local dev uses '/'.
  base: process.env.GITHUB_PAGES
    ? `/${(process.env.GITHUB_REPOSITORY || 'packflow-erp').split('/')[1]}/`
    : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'favicon-32.png', 'favicon-16.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Hira Packaging ERP',
        short_name: 'Hira ERP',
        description: 'Production & inventory management for Hira Packaging',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1B4FA8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell so it opens when installed. No offline data-sync here.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      // Let the SW work in `vite preview` / dev testing.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3001', changeOrigin: true, ws: true },
    },
  },
});
