import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const rootDir = resolve(import.meta.dirname, "..");
const publicDir = resolve(rootDir, "public");
const sourcePath = resolve(publicDir, "icon.png");

const iconTargets = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "pwa-192x192.png", size: 192 },
  { name: "pwa-512x512.png", size: 512 }
];

const renderIcon = async ({ name, size }) => {
  const outputPath = resolve(publicDir, name);
  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(sourcePath)
    .resize(size, size, {
      fit: "cover"
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true
    })
    .toFile(outputPath);
  console.log(`generated ${name} (${size}x${size})`);
};

const main = async () => {
  await Promise.all(iconTargets.map(renderIcon));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
