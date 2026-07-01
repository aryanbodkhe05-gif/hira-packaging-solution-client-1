// Generates the Hira Packaging PWA icon set from a vector "H" mark.
// Dev-only tool — NOT part of the app build (icons are committed under public/).
// Regenerate: npm i -D sharp png-to-ico && node scripts/gen-pwa-icons.mjs  (from client/)
// (sharp is intentionally not a project dependency — it's a heavy native module
//  that can break the Nixpacks/Docker build.)
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { mkdirSync, writeFileSync } from 'fs';

const DARK = '#1B4FA8';   // brand blue
const LIGHT = '#3E86D0';  // lighter blue (right leg)

// Two-tone "H": left bar + crossbar in `left/cross`, right bar in `right`.
// `scale` shrinks the mark toward the centre (used for the maskable safe zone).
function hSvg({ bg, left, cross, right, scale = 1 }) {
  const off = 256 * (1 - scale);
  const mark = `<g transform="translate(${off},${off}) scale(${scale})">
      <rect x="120" y="110" width="64" height="292" rx="14" fill="${left}"/>
      <rect x="184" y="223" width="146" height="66" rx="8" fill="${cross}"/>
      <rect x="330" y="110" width="64" height="292" rx="14" fill="${right}"/>
    </g>`;
  const bgRect = bg && bg !== 'none' ? `<rect width="512" height="512" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${bgRect}${mark}</svg>`;
}

const anySvg = hSvg({ bg: '#ffffff', left: DARK, cross: DARK, right: LIGHT });          // blue H on white
const maskSvg = hSvg({ bg: DARK, left: '#ffffff', cross: '#ffffff', right: '#cfe0f7', scale: 0.72 }); // white H on brand, padded

const pub = 'public';
const iconsDir = `${pub}/icons`;
mkdirSync(iconsDir, { recursive: true });

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

const jobs = [
  [anySvg, 192, `${iconsDir}/icon-192.png`],
  [anySvg, 512, `${iconsDir}/icon-512.png`],
  [maskSvg, 192, `${iconsDir}/icon-192-maskable.png`],
  [maskSvg, 512, `${iconsDir}/icon-512-maskable.png`],
  [anySvg, 180, `${iconsDir}/apple-touch-icon.png`],
  [anySvg, 32, `${pub}/favicon-32.png`],
  [anySvg, 16, `${pub}/favicon-16.png`],
];

for (const [svg, size, out] of jobs) {
  writeFileSync(out, await png(svg, size));
  console.log('wrote', out);
}

// Crisp SVG favicon + multi-size .ico
writeFileSync(`${pub}/favicon.svg`, anySvg);
writeFileSync(`${pub}/favicon.ico`, await pngToIco([await png(anySvg, 32), await png(anySvg, 16)]));
console.log('wrote', `${pub}/favicon.svg`, 'and favicon.ico');
