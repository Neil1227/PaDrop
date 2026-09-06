import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import os from 'os'

function getLocalLanIp(): string {
  const nets = os.networkInterfaces();
  const virtualRegex = /vEthernet|WSL|VirtualBox|VMware|Docker|Tailscale|Loopback|Hyper-V|vboxnet/i;
  
  // First pass: look for non-virtual physical/Wi-Fi/Ethernet adapters
  for (const name of Object.keys(nets)) {
    if (virtualRegex.test(name)) continue;
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  // Fallback pass: any non-internal IPv4 if no physical match
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '';
}

import type { Plugin } from 'vite'

interface DiscoveredRoomServer {
  roomId: string;
  displayName: string;
  deviceType: string;
  status: string;
  timestamp: number;
  isDiscoverable: boolean;
  lanIp?: string;
}

const activeRoomsRegistry = new Map<string, DiscoveredRoomServer>();
const ROOM_TTL_MS = 15000;

function discoveryServerPlugin(): Plugin {
  return {
    name: 'padrop-discovery-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/discovery')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        const now = Date.now();
        // Clean stale rooms
        for (const [key, val] of activeRoomsRegistry.entries()) {
          if (now - val.timestamp > ROOM_TTL_MS) {
            activeRoomsRegistry.delete(key);
          }
        }

        if (req.url.startsWith('/api/discovery/rooms') && req.method === 'GET') {
          const list = Array.from(activeRoomsRegistry.values()).filter((r) => r.isDiscoverable);
          res.statusCode = 200;
          return res.end(JSON.stringify({ ok: true, rooms: list }));
        }

        if (req.url.startsWith('/api/discovery/announce') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data && data.roomId) {
                if (data.isDiscoverable !== false) {
                  activeRoomsRegistry.set(data.roomId.toLowerCase(), {
                    roomId: data.roomId.toLowerCase(),
                    displayName: data.displayName || `Host ${data.roomId}`,
                    deviceType: data.deviceType || 'desktop',
                    status: data.status || 'available',
                    timestamp: Date.now(),
                    isDiscoverable: true,
                    lanIp: data.lanIp,
                  });
                } else {
                  activeRoomsRegistry.delete(data.roomId.toLowerCase());
                }
              }
              res.statusCode = 200;
              return res.end(JSON.stringify({ ok: true }));
            } catch {
              res.statusCode = 400;
              return res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
            }
          });
          return;
        }

        if (req.url.startsWith('/api/discovery/tombstone') && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data && data.roomId) {
                activeRoomsRegistry.delete(data.roomId.toLowerCase());
              }
              res.statusCode = 200;
              return res.end(JSON.stringify({ ok: true }));
            } catch {
              res.statusCode = 400;
              return res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  define: {
    __LOCAL_LAN_IP__: JSON.stringify(command === 'serve' ? getLocalLanIp() : ''),
  },
  server: {
    host: true,
    port: 5173,
  },
  plugins: [
    discoveryServerPlugin(),
    react(),

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'favicon-48x48.png',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'PaDrop-no-bg.png',
        'PaDrop-with-bg.png',
      ],
      manifest: {
        name: 'PaDrop — P2P Web Clipboard & File Drop',
        short_name: 'PaDrop',
        description: 'Instant, zero-cloud peer-to-peer clipboard and file transfers.',
        theme_color: '#1A1A2E',
        background_color: '#1A1A2E',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
    }),
  ],
}))

