// Script để generate VAPID keys cho push notifications
// Chạy: node scripts/generate-vapid-keys.mjs

import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n✅ VAPID Keys đã được tạo thành công!\n');
console.log('═══════════════════════════════════════════════════════');
console.log('📋 PUBLIC KEY (Thêm vào .env.local):');
console.log('═══════════════════════════════════════════════════════');
console.log(`VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}\n`);

console.log('═══════════════════════════════════════════════════════');
console.log('🔐 PRIVATE KEY (Chỉ dùng ở backend/server):');
console.log('═══════════════════════════════════════════════════════');
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}\n`);

console.log('📝 Email cho VAPID (tùy chọn, dùng ở backend):');
console.log('VAPID_EMAIL=mailto:your-email@example.com\n');

console.log('⚠️  LƯU Ý:');
console.log('   - PUBLIC KEY: Thêm vào .env.local (đã hiển thị ở trên)');
console.log('   - PRIVATE KEY: Chỉ dùng ở backend/server, KHÔNG commit vào git');
console.log('   - Sau khi thêm vào .env.local, restart dev server\n');
