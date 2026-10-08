import { lancerImport } from './importer.ts'

const KO = 1024

await lancerImport('pnpm fiche:importer <fichier.html>', async (service, _fichier, contenu) => {
  const fiche = await service.importerFiche(contenu)
  const taille = `${(fiche.octets / KO).toFixed(1)} Ko`
  const sons = fiche.sons === 0 ? '' : `, ${String(fiche.sons)} sons extraits`
  if (fiche.dejaImportee) {
    return `Fiche ${fiche.bloc} version ${String(fiche.version)} déjà importée, rien n’a changé (${taille}).`
  }
  return `Fiche ${fiche.bloc} version ${String(fiche.version)} importée (${taille}${sons}), ${String(fiche.cartes.total)} cartes : ${String(fiche.cartes.ajoutees)} ajoutées, ${String(fiche.cartes.retirees)} retirées.`
})
