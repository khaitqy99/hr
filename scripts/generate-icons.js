import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const logoPath = path.join(__dirname, '..', 'logoy.png');

// Đọc logo PNG
const logoBuffer = fs.readFileSync(logoPath);

// Generate các icon sizes từ logo
for (const size of [192, 512]) {
  await sharp(logoBuffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
    })
    .png()
    .toFile(path.join(publicDir, `icon-${size}.png`));
  console.log(`✅ Generated icon-${size}.png`);
}

// Generate favicon.svg từ logo (resize nhỏ)
const faviconSize = 32;
const faviconBuffer = await sharp(logoBuffer)
  .resize(faviconSize, faviconSize, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  })
  .png()
  .toBuffer();

// Convert PNG to SVG (tạo SVG wrapper với embedded PNG base64)
const base64Image = faviconBuffer.toString('base64');
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${faviconSize}" height="${faviconSize}" viewBox="0 0 ${faviconSize} ${faviconSize}">
  <image width="${faviconSize}" height="${faviconSize}" xlink:href="data:image/png;base64,${base64Image}"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent);
console.log(`✅ Generated favicon.svg`);
