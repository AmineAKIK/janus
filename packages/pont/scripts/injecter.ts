import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** L'emplacement de la bibliothèque dans une fiche : une balise vide, repérée par son identifiant. */
const BALISE = '<script id="pont"></script>'

/**
 * Insère `pont.js` en ligne dans la fiche. Le code ne peut pas contenir `</script`, qui fermerait la
 * balise : on l'écrit `<\/script`, ce que JavaScript lit de la même façon.
 */
export function injecter(html: string, code: string): string {
  if (!html.includes(BALISE)) throw new Error(`La fiche n’a pas la balise ${BALISE}.`)
  const sur = code.replaceAll('</script', '<\\/script')
  // Une fonction évite que `$&` ou `$1` du code soient pris pour des motifs de remplacement.
  return html.replace(BALISE, () => `<script id="pont">${sur}</script>`)
}

/** `node injecter.ts <fiche.html> <pont.js>` : réécrit la fiche avec le pont en ligne. */
function main(chemins: readonly string[]): void {
  const [fiche, pont] = chemins
  if (fiche === undefined || pont === undefined) {
    throw new Error('Usage : node injecter.ts <fiche.html> <pont.js>')
  }
  writeFileSync(fiche, injecter(readFileSync(fiche, 'utf8'), readFileSync(pont, 'utf8')))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2))
