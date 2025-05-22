import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import {VitePWA} from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        '/mintatix_ico_transparent.png'
      ],
      manifest: {
        "name": "Mintatix",
        "short_name": "Mintatix",
        "icons": [
          {
            "src": "/pwa-192x192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "/pwa-512x512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any"
          },
          {
            "src": "/pwa-maskable-192x192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "maskable"
          },
          {
            "src": "/pwa-maskable-512x512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "maskable"
          }
        ],
        "start_url": "/",
        "display": "standalone",
        "background_color": "#f0f0f0",
        "theme_color": "#f0f0f0",
        "description": "Mintatix is a descentralized ticketing platform that allows users to buy, sell and, use NFT tickets for events"
      }
    })],
  server: {
    host: '0.0.0.0'
  },
  base: '/',
})
