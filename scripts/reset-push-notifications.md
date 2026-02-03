# Reset và Test Push Notifications

## Bước 1: Unregister Service Workers cũ

Mở Console trong browser và chạy:

```javascript
// Unregister tất cả service workers
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => {
    console.log('Unregistering:', reg.scope);
    reg.unregister();
  });
});

// Clear push subscriptions
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    if (sub) {
      sub.unsubscribe().then(() => console.log('Unsubscribed'));
    }
  });
});

// Clear caches
caches.keys().then(keys => {
  keys.forEach(key => {
    caches.delete(key).then(() => console.log('Deleted cache:', key));
  });
});
```

## Bước 2: Rebuild Service Worker

```bash
# Xóa build cũ
rm -rf dev-dist
rm -rf dist

# Hoặc trong PowerShell:
Remove-Item -Recurse -Force dev-dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# Restart dev server
npm run dev
```

## Bước 3: Test VAPID Key

1. Mở file `scripts/test-vapid-key.html` trong browser
2. Paste VAPID key: `BOStaxGqlcRRkOuLd6DRb_P9dW6VR9nEMD16uLGxw7_ba-fhrll2m1Sy5QwZUO7jozYNBvlIfmo3l4MUJ0b_j40`
3. Click "Test Key" để kiểm tra format
4. Click "Test Push Subscription" để test đăng ký

## Bước 4: Test trong App

1. Refresh trang app (Ctrl+F5 để hard refresh)
2. Mở DevTools > Application > Service Workers
3. Kiểm tra service worker đã được đăng ký và active
4. Vào trang Thông báo và thử bật push notifications

## Debug trong Console

Nếu vẫn lỗi, chạy các lệnh sau trong Console:

```javascript
// 1. Kiểm tra VAPID key
const key = 'BOStaxGqlcRRkOuLd6DRb_P9dW6VR9nEMD16uLGxw7_ba-fhrll2m1Sy5QwZUO7jozYNBvlIfmo3l4MUJ0b_j40';
console.log('Key length:', key.length);
console.log('Valid format:', /^[A-Za-z0-9_-]+$/.test(key));

// 2. Kiểm tra service worker
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs.length);
  regs.forEach(reg => {
    console.log('Scope:', reg.scope);
    console.log('Active:', reg.active?.state);
    console.log('Installing:', reg.installing?.state);
    console.log('Waiting:', reg.waiting?.state);
  });
});

// 3. Test convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const cleaned = base64String.trim();
  const padding = '='.repeat((4 - cleaned.length % 4) % 4);
  const base64 = (cleaned + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

try {
  const converted = urlBase64ToUint8Array(key);
  console.log('✅ Convert thành công:', converted.length, 'bytes');
} catch (e) {
  console.error('❌ Lỗi convert:', e);
}

// 4. Test push subscription
navigator.serviceWorker.ready.then(async (reg) => {
  const applicationServerKey = urlBase64ToUint8Array(key);
  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    console.log('✅ Subscription thành công:', sub.endpoint);
    await sub.unsubscribe();
  } catch (error) {
    console.error('❌ Lỗi:', error.name, error.message);
  }
});
```

## Nếu vẫn không hoạt động

1. **Kiểm tra HTTPS**: Push chỉ hoạt động trên HTTPS hoặc localhost
2. **Kiểm tra Browser**: Đảm bảo đang dùng Chrome/Edge/Firefox mới nhất
3. **Tạo VAPID key mới**: Có thể key hiện tại có vấn đề
   ```bash
   node scripts/generate-vapid-keys.mjs
   ```
4. **Kiểm tra Network**: Đảm bảo có thể kết nối đến push service
