# Troubleshooting Push Notifications

## Lỗi: "registration failed - push service error"

Lỗi này thường xảy ra khi:

### 1. Service Worker chưa được build đúng cách

**Giải pháp:**
```bash
# Xóa cache và rebuild
rm -rf dev-dist
rm -rf dist
npm run dev
```

Hoặc trong Windows PowerShell:
```powershell
Remove-Item -Recurse -Force dev-dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
npm run dev
```

### 2. Service Worker chưa active

**Kiểm tra:**
1. Mở DevTools (F12)
2. Vào tab **Application** > **Service Workers**
3. Kiểm tra xem service worker có status là "activated" không
4. Nếu không, click "Unregister" và refresh trang

### 3. VAPID Key không đúng format

**Kiểm tra:**
- VAPID key phải là base64 URL-safe string
- Độ dài thường khoảng 87 ký tự
- Không có khoảng trắng hoặc ký tự đặc biệt

**Test VAPID key:**
```javascript
// Mở Console và chạy:
const key = 'BOStaxGqlcRRkOuLd6DRb_P9dW6VR9nEMD16uLGxw7_ba-fhrll2m1Sy5QwZUO7jozYNBvlIfmo3l4MUJ0b_j40';
console.log('Key length:', key.length); // Nên là ~87
console.log('Valid format:', /^[A-Za-z0-9_-]+$/.test(key)); // Nên là true
```

### 4. Browser không hỗ trợ hoặc đã block

**Kiểm tra:**
- Chrome/Edge: ✅ Hỗ trợ tốt
- Firefox: ✅ Hỗ trợ tốt
- Safari: ⚠️ Chỉ hỗ trợ từ iOS 16.4+ và macOS
- Opera: ✅ Hỗ trợ tốt

**Kiểm tra permissions:**
1. DevTools > Application > Notifications
2. Đảm bảo permission là "Allow"

### 5. HTTPS không được sử dụng

Push notifications chỉ hoạt động trên:
- ✅ HTTPS
- ✅ localhost (development)
- ❌ HTTP (không hoạt động)

### 6. Service Worker path không đúng

**Kiểm tra trong Console:**
```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registered SWs:', regs.map(r => r.scope));
});
```

**Nếu không có registration:**
- Kiểm tra file `public/sw.js` có tồn tại không
- Kiểm tra VitePWA config trong `vite.config.ts`

## Debug Steps

### Bước 1: Kiểm tra Service Worker
```javascript
// Mở Console và chạy:
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    console.log('Service Workers:', regs);
    if (regs.length > 0) {
      console.log('Active:', regs[0].active);
      console.log('Installing:', regs[0].installing);
      console.log('Waiting:', regs[0].waiting);
    }
  });
} else {
  console.error('Service Worker không được hỗ trợ');
}
```

### Bước 2: Kiểm tra Push Manager
```javascript
// Sau khi service worker ready:
navigator.serviceWorker.ready.then(reg => {
  console.log('Push Manager:', reg.pushManager);
  reg.pushManager.getSubscription().then(sub => {
    console.log('Current subscription:', sub);
  });
});
```

### Bước 3: Test VAPID Key Conversion
```javascript
// Test function convert VAPID key:
const key = 'BOStaxGqlcRRkOuLd6DRb_P9dW6VR9nEMD16uLGxw7_ba-fhrll2m1Sy5QwZUO7jozYNBvlIfmo3l4MUJ0b_j40';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

try {
  const result = urlBase64ToUint8Array(key);
  console.log('✅ VAPID key conversion thành công:', result.length, 'bytes');
} catch (e) {
  console.error('❌ Lỗi convert VAPID key:', e);
}
```

### Bước 4: Test Push Subscription
```javascript
// Test subscribe:
navigator.serviceWorker.ready.then(async (reg) => {
  const key = 'BOStaxGqlcRRkOuLd6DRb_P9dW6VR9nEMD16uLGxw7_ba-fhrll2m1Sy5QwZUO7jozYNBvlIfmo3l4MUJ0b_j40';
  
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  
  try {
    const applicationServerKey = urlBase64ToUint8Array(key);
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    console.log('✅ Subscription thành công:', subscription.endpoint);
  } catch (error) {
    console.error('❌ Lỗi subscription:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
  }
});
```

## Common Errors và Solutions

### Error: "NotAllowedError"
- **Nguyên nhân:** Browser đã từ chối push subscription
- **Giải pháp:** Kiểm tra browser settings và permissions

### Error: "InvalidStateError"
- **Nguyên nhân:** Đã có subscription hoặc service worker không active
- **Giải pháp:** Unsubscribe trước, sau đó subscribe lại

### Error: "AbortError"
- **Nguyên nhân:** Request bị hủy hoặc timeout
- **Giải pháp:** Kiểm tra network connection và thử lại

### Error: "TypeError: Failed to execute 'subscribe'"
- **Nguyên nhân:** VAPID key không đúng format hoặc service worker chưa ready
- **Giải pháp:** Đảm bảo service worker đã active và VAPID key đúng format

## Reset và Thử Lại

Nếu vẫn gặp lỗi, thử reset:

```javascript
// Unregister tất cả service workers
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});

// Clear push subscriptions
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    if (sub) sub.unsubscribe();
  });
});

// Clear cache
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key));
});

// Reload page
location.reload();
```

## Kiểm tra Logs

Mở DevTools Console và kiểm tra các log:
- ✅ "Service Worker đã đăng ký"
- ✅ "Service worker đã ready"
- ✅ "Đang subscribe push với VAPID key"
- ✅ "Push subscription thành công"

Nếu không thấy các log này, có thể service worker chưa được đăng ký đúng cách.
