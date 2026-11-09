import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Offline support: a service worker keeps the app's files on the phone,
    // and the last data downloaded from the API, so the app opens without internet.
    VitePWA({
      registerType: 'autoUpdate', // new versions install themselves the next time the app opens
      manifest: false,            // we keep our own public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webmanifest}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // last known roster (teacher) and profile (student): fresh when online, cached when offline
            urlPattern: ({ url }) => ['/api/teacher/state', '/api/me', '/api/attendance'].includes(url.pathname),            handler: 'NetworkFirst',
            options: { cacheName: 'api-data', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
})