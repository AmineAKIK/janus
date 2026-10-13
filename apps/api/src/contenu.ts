import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Base } from './base/base.ts'
import { ErreurImport, monterImportation } from './domaines/catalogue/composition.ts'
import { lireLesFiches } from './fiches.ts'
import type { Horloge } from './horloge.ts'

/** Le dossier `contenu/` du dépôt, copié tel quel dans l'image : un dossier par formation. */
export const DOSSIER_CONTENU = join(dirname(fileURLToPath(import.meta.url)), '../../../contenu')

/**
 * Importe au démarrage le plan de chaque formation du dépôt (`contenu/<formation>/catalogue.json`).
 * Le fichier fait foi et l'import est idempotent : un déploiement suffit pour publier une formation.
 * Puis importe les fiches de la formation (`contenu/<formation>/fiches/<bloc>.html`), dans l'ordre
 * des noms : relancer rend les versions déjà importées sans rien changer.
 * Un catalogue ou une fiche invalide arrête le démarrage, comme une migration qui échoue :
 * l'ancienne version, déjà en marche, reste en place. `pnpm fiches:verifier` le détecte avant la fusion.
 */
export async function importerLesCatalogues(
  base: Base,
  horloge: Horloge,
  dossierFiches: string,
  dossier = DOSSIER_CONTENU,
): Promise<string[]> {
  const service = monterImportation(base, horloge, dossierFiches)
  const formations = (await readdir(dossier, { withFileTypes: true }))
    .filter((entree) => entree.isDirectory())
    .map((entree) => entree.name)
    .sort()
  const bilans: string[] = []
  for (const formation of formations) {
    const fichier = join(dossier, formation, 'catalogue.json')
    let json: unknown
    try {
      json = JSON.parse(await readFile(fichier, 'utf8'))
    } catch (cause) {
      throw new Error(`Catalogue illisible : ${fichier}`, { cause })
    }
    try {
      const compte = await service.importerCatalogue(json)
      bilans.push(
        `Catalogue ${formation} : ${String(compte.formations)} formation, ${String(compte.modules)} modules, ${String(compte.parties)} parties, ${String(compte.blocs)} blocs créés.`,
      )
    } catch (erreur) {
      if (!(erreur instanceof ErreurImport)) throw erreur
      throw new Error(`Catalogue ${formation} invalide :\n${erreur.problemes.join('\n')}`)
    }
    for (const fiche of await lireLesFiches(dossier, formation)) {
      try {
        const importee = await service.importerFiche(fiche.html)
        bilans.push(
          `Fiche ${fiche.nom} : ${importee.bloc} version ${String(importee.version)} ${importee.dejaImportee ? 'déjà importée' : 'importée'}.`,
        )
      } catch (erreur) {
        if (!(erreur instanceof ErreurImport)) throw erreur
        throw new Error(`Fiche ${fiche.nom} invalide :\n${erreur.problemes.join('\n')}`)
      }
    }
  }
  return bilans
}
