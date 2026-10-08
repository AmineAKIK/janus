import { lancerImport } from './importer.ts'

await lancerImport(
  'pnpm catalogue:importer <catalogue.json>',
  async (service, fichier, contenu) => {
    let json: unknown
    try {
      json = JSON.parse(contenu)
    } catch {
      json = undefined
    }
    const compte = await service.importerCatalogue(json)
    return `Catalogue ${fichier} importé : ${String(compte.formations)} formation, ${String(compte.modules)} modules, ${String(compte.parties)} parties, ${String(compte.blocs)} blocs créés.`
  },
)
