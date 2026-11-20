// Rasterises assets/icon.svg into the PNG sizes Chrome needs.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

await mkdir('public/icon', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await sharp('assets/icon.svg', { density: 384 }).resize(size, size).png().toFile(`public/icon/${size}.png`);
}
console.log('icons written to public/icon');
