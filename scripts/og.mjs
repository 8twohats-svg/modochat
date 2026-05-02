import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(__dirname, "..", "public", "og.svg"));
await sharp(svg, { density: 192 })
  .resize(1200, 630)
  .png()
  .toFile(join(__dirname, "..", "public", "og.png"));
console.log("og.png written");
