// Generates the app's PNG icons from public/favicon.svg.
// Run again whenever the logo changes: node scripts/make-icons.mjs
import sharp from 'sharp'

const SIZES = [
  ['public/icon-512.png', 512],
  ['public/icon-192.png', 192],
  ['public/apple-touch-icon.png', 180],
]

for (const [file, size] of SIZES) {
  await sharp('public/favicon.svg', { density: 384 }) // high density so small sizes stay sharp
    .resize(size, size)
    .png()
    .toFile(file)
  console.log(`✓ ${file} (${size}×${size})`)
}