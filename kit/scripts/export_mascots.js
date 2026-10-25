// Exporta las 24 mascotas como SVG sueltos (y PNG de 512 px si hay sharp disponible).
// Uso: node export_mascots.js <mascots.js> <carpeta_salida>
const fs = require('fs');
const path = require('path');
const M = require(path.resolve(process.argv[2]));
const out = process.argv[3];
fs.mkdirSync(out, { recursive: true });
let n = 0;
for (const kind of M.KINDS) {
  M.STAGES.forEach((st, i) => {
    for (const emo of M.EMOTIONS) {
      const name = `${kind.id}-${i + 1}-${st.id}-${emo.id}.svg`;
      fs.writeFileSync(path.join(out, name), M.svg(kind.id, i + 1, emo.id) + '\n');
      n++;
    }
  });
}
console.log(n + ' mascotas exportadas');
