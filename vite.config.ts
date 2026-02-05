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
        chunkSizeWarningLimit: 1000, // Tăng limit để giảm cảnh báo (kb)
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              // Đơn giản hóa chunking để tránh lỗi React 19
              // Chỉ chunk các libraries lớn nhất, để Vite tự động optimize React
              if (id.includes('node_modules')) {
                // Recharts - chunk riêng vì khá lớn và chỉ dùng trong một số components
                if (id.includes('recharts')) {
                  return 'recharts-vendor';
                }
                
                // Appwrite - chunk riêng (nếu có dùng)
                if (id.includes('appwrite')) {
                  return 'appwrite-vendor';
                }
                
                // Để tất cả các libraries khác (bao gồm React, React DOM, Supabase)
                // được Vite tự động optimize vào vendor chunk
                // Điều này đảm bảo React và React DOM luôn cùng chunk
                return 'vendor';
              }
            },
          },
        },
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'prompt',
          includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
          strategies: 'injectManifest',
          srcDir: 'public',
          filename: 'sw.js',
          manifest: {
            name: 'Y99 HR',
            short_name: 'Y99 HR',
            description: 'Hệ thống quản lý nhân sự 4.0 - Check-in, lịch làm việc và quản trị HR',
            theme_color: '#0c4a6e',
            background_color: '#f0f9ff',
            display: 'standalone',
            orientation: 'portrait',
            scope: '/',
            start_url: '/?utm_source=pwa',
            lang: 'vi',
            categories: ['business', 'productivity', 'utilities'],
            shortcuts: [
              {
                name: 'Chấm công',
                short_name: 'Check-in',
                description: 'Chấm công nhanh',
                url: '/employee/checkin?utm_source=pwa_shortcut',
                icons: [{ src: '/icon-192.png', sizes: '192x192' }]
              },
              {
                name: 'Dashboard',
                short_name: 'Dashboard',
                description: 'Xem tổng quan',
                url: '/employee/dashboard?utm_source=pwa_shortcut',
                icons: [{ src: '/icon-192.png', sizes: '192x192' }]
              },
              {
                name: 'Lịch làm việc',
                short_name: 'Shifts',
                description: 'Xem lịch làm việc',
                url: '/employee/shifts?utm_source=pwa_shortcut',
                icons: [{ src: '/icon-192.png', sizes: '192x192' }]
              }
            ],
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
            share_target: {
              action: '/share',
              method: 'POST',
              enctype: 'multipart/form-data',
              params: {
                title: 'title',
                text: 'text',
                url: 'url'
              }
            },
            screenshots: [
              {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                form_factor: 'narrow',
                label: 'Y99 HR Dashboard'
              }
            ]
          },
          injectManifest: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          },
          devOptions: {
            enabled: true,
            type: 'classic', // Service workers không hỗ trợ ES modules tốt
          },
        }),
      ],
      define: {},
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
