import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true, // Cho phép tunnel (Cloudflare, ngrok, ...)
      },
      build: {
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: isProduction, // Remove console.log in production
            drop_debugger: isProduction,
          },
        },
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
          manifest: {
            name: 'HR Connect',
            short_name: 'HR Connect',
            description: 'Hệ thống quản lý nhân sự 4.0 - Check-in, lịch làm việc và quản trị HR',
            theme_color: '#0c4a6e',
            background_color: '#f0f9ff',
            display: 'standalone',
            orientation: 'portrait',
            scope: '/',
            start_url: '/',
            lang: 'vi',
            icons: [
              {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable',
              },
              {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'tailwind-cache',
                  expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
          devOptions: {
            enabled: true,
          },
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      envPrefix: 'VITE_', // Cho phép Vite load các biến môi trường bắt đầu bằng VITE_
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        dedupe: ['tslib']
      },
      optimizeDeps: {
        include: ['tslib', '@supabase/supabase-js', '@supabase/auth-js', '@supabase/functions-js']
      }
    };
});
