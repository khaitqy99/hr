# Fix Vercel Build Errors

## Các lỗi phổ biến và cách khắc phục

### 1. Build Command không đúng

**Lỗi**: `Command "vite build" exited with 1`

**Giải pháp**: Đảm bảo Vercel detect đúng build command:
- Vercel tự động detect Vite projects
- Build Command: `npm run build` (hoặc `vite build`)
- Output Directory: `dist`

### 2. Node Version không tương thích

**Lỗi**: `Error: Node version mismatch`

**Giải pháp**: Thêm file `.nvmrc` hoặc cấu hình trong `package.json`:

```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

Hoặc tạo file `.nvmrc`:
```
18
```

### 3. TypeScript Errors

**Lỗi**: `Type error: ...`

**Giải pháp**: 
- Kiểm tra `tsconfig.json` có đúng không
- Chạy `npm run build` local để test trước
- Fix tất cả TypeScript errors

### 4. Missing Dependencies

**Lỗi**: `Cannot find module ...`

**Giải pháp**:
- Đảm bảo tất cả dependencies trong `package.json`
- Chạy `npm install` local để test
- Kiểm tra `package-lock.json` có commit không

### 5. Environment Variables Missing

**Lỗi**: `VITE_SUPABASE_URL is not defined`

**Giải pháp**:
- Vào Vercel Dashboard > Settings > Environment Variables
- Thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`
- Redeploy

### 6. Build Output không đúng

**Lỗi**: `No Output Directory found`

**Giải pháp**: Kiểm tra Vercel Project Settings:
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### 7. Terser/Minify Errors

**Lỗi**: `Terser error: ...`

**Giải pháp**: Nếu gặp lỗi với terser, có thể tắt minify tạm thời:

```typescript
build: {
  minify: false, // Tạm thời tắt để debug
  // hoặc
  minify: 'esbuild', // Dùng esbuild thay vì terser
}
```

### 8. Chunk Size quá lớn

**Lỗi**: `Chunk size exceeds the limit`

**Giải pháp**: Đã được fix trong `vite.config.ts`:
- `chunkSizeWarningLimit: 1000`
- Manual chunks để tách các libraries lớn

### 9. React Chunk Errors

**Lỗi**: `Cannot set properties of undefined (setting 'Activity')`

**Giải pháp**: Đã được fix trong `vite.config.ts`:
- React và React DOM được bundle cùng chunk
- Xem `FIX_REACT_CHUNK_ERROR.md` để biết thêm

### 10. PWA Plugin Errors

**Lỗi**: `VitePWA plugin error`

**Giải pháp**: Kiểm tra:
- Icons có tồn tại không (`icon-192.png`, `icon-512.png`)
- `manifest.json` config đúng không

## Checklist trước khi deploy

- [ ] `npm run build` thành công local
- [ ] `npm run preview` hoạt động local
- [ ] Không có TypeScript errors
- [ ] Tất cả dependencies trong `package.json`
- [ ] Environment Variables đã được thêm trên Vercel
- [ ] `vercel.json` đã được tạo
- [ ] `.gitignore` đúng (không commit `node_modules`, `.env.local`)

## Cách xem Build Logs trên Vercel

1. Vào Vercel Dashboard
2. Chọn project của bạn
3. Vào tab **Deployments**
4. Click vào deployment mới nhất
5. Xem **Build Logs** để tìm lỗi cụ thể

## Test Build Local

```bash
# Install dependencies
npm install

# Build
npm run build

# Preview build
npm run preview
```

Nếu build local thành công nhưng Vercel fail, có thể do:
- Environment variables
- Node version
- Build settings trên Vercel

## Liên hệ

Nếu vẫn gặp lỗi, vui lòng cung cấp:
1. Full error message từ Vercel Build Logs
2. Screenshot (nếu có)
3. Output của `npm run build` local
