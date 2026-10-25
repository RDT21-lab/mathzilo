// StarMath — genera los iconos PNG de la PWA a partir de los SVG del logo.
// Uso: NODE_PATH=<ruta a node_modules con sharp> node render_icons.js <carpeta_logo> <carpeta_iconos>
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [logoDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const jobs = [
  { svg: 'logo-marca.svg', size: 192, name: 'icon-192.png' },
  { svg: 'logo-marca.svg', size: 512, name: 'icon-512.png' },
  { svg: 'icono-adaptable.svg', size: 512, name: 'icon-maskable-512.png' },
  { svg: 'icono-adaptable.svg', size: 180, name: 'apple-touch-icon-180.png' },
  { svg: 'favicon.svg', size: 32, name: 'favicon-32.png' },
  { svg: 'favicon.svg', size: 16, name: 'favicon-16.png' },
];

(async () => {
  for (const j of jobs) {
    const buf = fs.readFileSync(path.join(logoDir, j.svg));
    await sharp(buf, { density: Math.max(72, Math.round((j.size / 512) * 72 * 4)) })
      .resize(j.size, j.size)
      .png()
      .toFile(path.join(outDir, j.name));
    console.log('ok', j.name);
  }
})();
