// Garde à côté de chaque fichier texte de l'appli sa version compressée en brotli (`x.js` -> `x.js.br`).
// Caddy (`file_server { precompressed br }`) les sert telles quelles aux navigateurs qui les acceptent.
// Le niveau 11 est trop lent pour une compression à la volée, mais ne coûte ici que quelques secondes,
// une fois par construction de l'image. Un fichier qui ne rapetisse pas n'est pas gardé.
//   node infra/caddy/precompresser.js <dossier>
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'

const EXTENSIONS = new Set([
  '.js',
  '.css',
  '.html',
  '.svg',
  '.json',
  '.webmanifest',
  '.txt',
  '.xml',
])
/** En dessous, l'économie ne vaut pas un fichier de plus. */
const TAILLE_MIN = 512

const dossier = process.argv[2]
if (dossier === undefined) {
  console.error('Usage : node precompresser.js <dossier>')
  process.exit(1)
}

function* fichiers(chemin) {
  for (const nom of readdirSync(chemin)) {
    const complet = join(chemin, nom)
    if (statSync(complet).isDirectory()) yield* fichiers(complet)
    else yield complet
  }
}

let nombre = 0
let avant = 0
let apres = 0
for (const fichier of fichiers(dossier)) {
  if (!EXTENSIONS.has(extname(fichier))) continue
  const contenu = readFileSync(fichier)
  if (contenu.length < TAILLE_MIN) continue
  const compresse = brotliCompressSync(contenu, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: contenu.length,
    },
  })
  if (compresse.length >= contenu.length) continue
  writeFileSync(`${fichier}.br`, compresse)
  nombre += 1
  avant += contenu.length
  apres += compresse.length
}
console.log(`${String(nombre)} fichiers en brotli : ${String(avant)} -> ${String(apres)} octets`)
