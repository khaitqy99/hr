# Fix React Vendor Chunk Error

## Lỗi hiện tại

```
react-vendor-BqTWcMZt.js:1 Uncaught TypeError: Cannot set properties of undefined (setting 'Activity')
```

## Nguyên nhân

Lỗi này xảy ra khi React và React DOM bị tách thành các chunks khác nhau hoặc load không đúng thứ tự. React 19 có thể nhạy cảm hơn với cách chunking.

## Giải pháp đã áp dụng

### 1. Cải thiện manualChunks trong vite.config.ts

Đã cập nhật để đảm bảo:
- React, React DOM, và scheduler được bundle cùng một chunk
- Bao gồm cả jsx-runtime và jsx-dev-runtime

### 2. Nếu vẫn gặp lỗi - Giải pháp đơn giản hơn

Nếu sau khi deploy vẫn gặp lỗi, có thể đơn giản hóa chunking bằng cách:

**Option 1: Chỉ chunk các libraries lớn nhất**

```typescript
manualChunks: (id) => {
  if (id.includes('node_modules')) {
    // Chỉ tách các libraries rất lớn
    if (id.includes('recharts')) return 'recharts-vendor';
    if (id.includes('@google/genai')) return 'genai-vendor';
    // Để Vite tự động optimize React và các libraries khác
    return 'vendor';
  }
}
```

**Option 2: Disable manual chunks cho React**

```typescript
manualChunks: (id) => {
  if (id.includes('node_modules')) {
    // KHÔNG chunk React - để Vite tự động handle
    if (id.includes('react') || id.includes('react-dom')) {
      return undefined; // Let Vite handle it
    }
    
    // Chỉ chunk các libraries khác
    if (id.includes('@supabase')) return 'supabase-vendor';
    if (id.includes('recharts')) return 'recharts-vendor';
    if (id.includes('@google/genai')) return 'genai-vendor';
    
    return 'vendor';
  }
}
```

**Option 3: Disable manual chunks hoàn toàn**

Nếu vẫn gặp vấn đề, có thể tạm thời disable manual chunks:

```typescript
build: {
  // ... other config
  // Comment out rollupOptions để Vite tự động optimize
  // rollupOptions: { ... }
}
```

## Các bước khắc phục

1. **Deploy code mới** với chunking đã được cải thiện
2. **Kiểm tra** xem lỗi còn không
3. **Nếu vẫn còn**, thử Option 2 hoặc Option 3
4. **Test lại** sau mỗi thay đổi

## Kiểm tra sau khi deploy

1. Mở Browser Console (F12)
2. Kiểm tra Network tab:
   - Xem các chunks được load đúng thứ tự không
   - Xem có chunks nào fail không
3. Kiểm tra Console:
   - Xem có lỗi React không
   - Xem có warnings về chunks không

## Lưu ý

- React 19 có thể có breaking changes với cách chunking
- Nếu vấn đề persist, có thể cần downgrade về React 18
- Hoặc đợi Vite/React cập nhật để fix compatibility issues
