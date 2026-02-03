/**
 * VAPID Public Key cho Web Push Notifications
 * 
 * Public key này có thể được hardcode vì nó là PUBLIC (không phải secret).
 * Private key phải được giữ bí mật và chỉ dùng ở backend (Supabase Edge Function).
 * 
 * Để tạo VAPID keys mới: node scripts/generate-vapid-keys.mjs
 */

export const VAPID_PUBLIC_KEY = 'BIiiNL77EAPkhCNDQILgQ1oLzGEecohTTH1mMtwIvgZz3kNUFO2pD_M3iKsV9A19c7cgdT9VhsLWEZwwJLxs2E8';
