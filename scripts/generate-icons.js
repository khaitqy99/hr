import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const logoPath = path.join(__dirname, '..', 'logoy.png');

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
// Safe zone: logo chỉ dùng ~80% khung để không bị cắt khi OS bo góc icon (iOS/Android)
const SAFE_ZONE_RATIO = 0.8;

// Đọc logo PNG (giữ alpha từ nguồn)
const logoBuffer = fs.readFileSync(logoPath);

// Copy logo ra public, giữ nguyên tỉ lệ, nền trong suốt
await sharp(logoBuffer)
  .resize(128, 128, { fit: 'inside', withoutEnlargement: true, background: TRANSPARENT })
  .png({ palette: false })
  .toFile(path.join(publicDir, 'logo.png'));
console.log('✅ Generated logo.png (aspect ratio preserved, no background)');

// Generate các icon sizes: logo nằm trong safe zone, nền trong suốt
for (const size of [192, 512]) {
  const innerSize = Math.round(size * SAFE_ZONE_RATIO);
  const padding = Math.round((size - innerSize) / 2);
  const resizedLogo = await sharp(logoBuffer)
    .resize(innerSize, innerSize, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: TRANSPARENT }
  })
    .composite([{ input: resizedLogo, left: padding, top: padding }])
    .png()
    .toFile(path.join(publicDir, `icon-${size}.png`));
  console.log(`✅ Generated icon-${size}.png (safe zone, no background)`);
}

// Generate favicon.svg từ logo (resize nhỏ, nền trong suốt)
const faviconSize = 32;
const faviconBuffer = await sharp(logoBuffer)
  .resize(faviconSize, faviconSize, { fit: 'contain', background: TRANSPARENT })
  .png()
  .toBuffer();

// Convert PNG to SVG (tạo SVG wrapper với embedded PNG base64)
const base64Image = faviconBuffer.toString('base64');
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${faviconSize}" height="${faviconSize}" viewBox="0 0 ${faviconSize} ${faviconSize}">
  <image width="${faviconSize}" height="${faviconSize}" xlink:href="data:image/png;base64,${base64Image}"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent);
console.log(`✅ Generated favicon.svg (no background)`);
