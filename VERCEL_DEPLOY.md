# Hướng dẫn Deploy lên Vercel

## Vấn đề màn trắng khi deploy

Màn trắng thường do các nguyên nhân sau:
1. **Environment Variables chưa được cấu hình**
2. **SPA Routing không được handle đúng**
3. **Build errors**
4. **Asset loading issues**

## Giải pháp đã áp dụng

### 1. File `vercel.json` ✅

Đã tạo file `vercel.json` để:
- Handle SPA routing (rewrite tất cả routes về `/index.html`)
- Cache static assets để tối ưu performance

### 2. Error Boundary ✅

Đã thêm Error Boundary trong `index.tsx` để:
- Catch và hiển thị lỗi thay vì màn trắng
- Hiển thị thông báo lỗi rõ ràng
- Cho phép reload trang

### 3. Environment Variables

**QUAN TRỌNG**: Phải cấu hình Environment Variables trên Vercel!

## Các bước deploy lên Vercel

### Bước 1: Cấu hình Environment Variables trên Vercel

1. Vào Vercel Dashboard > Project Settings > Environment Variables
2. Thêm các biến sau:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Lưu ý**:
- Tất cả biến phải bắt đầu với `VITE_`
- Thêm cho cả 3 environments: Production, Preview, Development
- Sau khi thêm, cần **redeploy** để áp dụng

### Bước 2: Deploy

#### Cách 1: Deploy qua Vercel Dashboard

1. Push code lên GitHub/GitLab/Bitbucket
2. Vào [Vercel Dashboard](https://vercel.com)
3. Click **"Add New Project"**
4. Import repository của bạn
5. Vercel sẽ tự động detect Vite project
6. **QUAN TRỌNG**: Thêm Environment Variables trước khi deploy
7. Click **"Deploy"**

#### Cách 2: Deploy qua Vercel CLI

```bash
# Cài đặt Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy production
vercel --prod
```

### Bước 3: Kiểm tra Build Logs

Sau khi deploy, kiểm tra:
1. **Build Logs**: Xem có lỗi build không
2. **Runtime Logs**: Xem có lỗi runtime không
3. **Network Tab**: Xem có assets nào fail không

## Troubleshooting

### Màn trắng vẫn xuất hiện

#### 1. Kiểm tra Environment Variables

```bash
# Trong Vercel Dashboard > Project Settings > Environment Variables
# Đảm bảo có:
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

**Test**: Thêm vào code để debug:
```typescript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing');
```

#### 2. Kiểm tra Browser Console

Mở Browser Console (F12) và kiểm tra:
- **Errors**: Xem có lỗi JavaScript không
- **Network**: Xem có requests nào fail không
- **Console logs**: Xem có warnings về environment variables không

#### 3. Kiểm tra Build Output

Trong Vercel Dashboard > Deployments > [Latest] > Build Logs:
- Xem có warnings về chunk size không
- Xem có errors trong quá trình build không

#### 4. Kiểm tra Routing

- Thử truy cập trực tiếp: `https://your-app.vercel.app/index.html`
- Nếu hoạt động → Vấn đề là routing
- Nếu không → Vấn đề là build hoặc environment variables

### Lỗi: "Failed to fetch" hoặc "Network error"

**Nguyên nhân**: Supabase URL hoặc Key không đúng

**Giải pháp**:
1. Kiểm tra lại Environment Variables trên Vercel
2. Đảm bảo không có khoảng trắng thừa
3. Redeploy sau khi sửa

### Lỗi: "Module not found" hoặc "Cannot resolve"

**Nguyên nhân**: Build failed hoặc dependencies thiếu

**Giải pháp**:
1. Kiểm tra `package.json` có đầy đủ dependencies không
2. Chạy `npm install` local để test
3. Kiểm tra Build Logs trên Vercel

### Assets không load (404)

**Nguyên nhân**: Asset paths không đúng

**Giải pháp**:
1. Kiểm tra `vite.config.ts` có `base` path không
2. Đảm bảo assets được build vào `dist/` folder
3. Kiểm tra `vercel.json` có đúng không

## Best Practices

### 1. Environment Variables

- ✅ Luôn thêm Environment Variables trên Vercel
- ✅ Sử dụng `VITE_` prefix cho tất cả biến
- ✅ Thêm cho cả 3 environments
- ✅ Không commit `.env.local` lên Git

### 2. Build Configuration

- ✅ Kiểm tra `vite.config.ts` không có hardcoded paths
- ✅ Đảm bảo `base` path đúng (nếu deploy vào subdirectory)
- ✅ Test build local trước khi deploy: `npm run build`

### 3. Error Handling

- ✅ Đã có Error Boundary để catch errors
- ✅ Console logs để debug (chỉ trong development)
- ✅ User-friendly error messages

### 4. Performance

- ✅ Code splitting với manualChunks
- ✅ Asset caching trong `vercel.json`
- ✅ PWA support với VitePWA plugin

## Checklist trước khi deploy

- [ ] Environment Variables đã được thêm trên Vercel
- [ ] Build thành công local: `npm run build`
- [ ] File `vercel.json` đã được tạo
- [ ] Không có hardcoded URLs trong code
- [ ] Error Boundary đã được thêm
- [ ] Test preview deployment trước khi deploy production

## Tài liệu tham khảo

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#vercel)
- [Environment Variables on Vercel](https://vercel.com/docs/concepts/projects/environment-variables)
