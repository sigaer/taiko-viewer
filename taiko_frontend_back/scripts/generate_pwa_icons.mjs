import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const rootDir = resolve(import.meta.dirname, "..");
const publicDir = resolve(rootDir, "public");
const sourcePath = resolve(publicDir, "icon.png");
const maskableBackground = "#f4efe7";

const iconTargets = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "pwa-192x192.png", size: 192 },
  { name: "pwa-512x512.png", size: 512 }
];

const maskableTargets = [
  { name: "pwa-192x192-maskable.png", size: 192, foregroundScale: 0.8 },
  { name: "pwa-512x512-maskable.png", size: 512, foregroundScale: 0.8 }
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

const renderMaskableIcon = async ({ name, size, foregroundScale }) => {
  const outputPath = resolve(publicDir, name);
  const foregroundSize = Math.round(size * foregroundScale);
  const foregroundBuffer = await sharp(sourcePath)
    .resize(foregroundSize, foregroundSize, {
      fit: "contain"
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true
    })
    .toBuffer();

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: maskableBackground
    }
  })
    .composite([
      {
        input: foregroundBuffer,
        left: Math.round((size - foregroundSize) / 2),
        top: Math.round((size - foregroundSize) / 2)
      }
    ])
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true
    })
    .toFile(outputPath);
  console.log(`generated ${name} (${size}x${size}, maskable)`);
};

const main = async () => {
  await Promise.all([
    ...iconTargets.map(renderIcon),
    ...maskableTargets.map(renderMaskableIcon)
  ]);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
