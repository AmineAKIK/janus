import { ErreurApi, ROUTES } from '@janus/contrats'
import type { EtatDemo, LigneJournal } from '@janus/contrats'
import { exportTexte, lignesDuJournal, pageDuJournal } from '@janus/moteur'
import { catalogueGraine, MANIFESTES_GRAINE } from '../graine.ts'
import { resultatDuBloc } from './calculs.ts'
import { definir } from './definir.ts'

const introuvable = (detail: string) =>
  new ErreurApi({ status: 404, code: 'introuvable', titre: 'Introuvable', detail })

/** Toutes les lignes du journal, depuis les faits gardés. */
const lignesDeLEtat = (etat: EtatDemo) =>
  lignesDuJournal(etat.faits, { manifestes: MANIFESTES_GRAINE, reglages: etat.reglages })

/** Le journal au format de la méthode. Les tâches inédites réservées et la dernière revue n'ont pas encore de données en démo. */
export function exportDuJournal(etat: EtatDemo): string {
  const manifestes = catalogueGraine().modules.flatMap((module) =>
    module.importe
      ? module.parties.flatMap(({ blocs }) =>
          blocs.flatMap((code) => {
            const manifeste = MANIFESTES_GRAINE[code]
            return manifeste === undefined ? [] : [manifeste]
          }),
        )
      : [],
  )
  return exportTexte({
    manifestes,
    faits: etat.faits,
    reglages: etat.reglages,
    tachesReservees: [],
    idees: etat.idees.map(({ texte }) => texte),
    derniereRevue: null,
  })
}

export const ROUTES_JOURNAL_DEMO = [
  definir(ROUTES['GET /journal'], ({ magasin, horloge, requete }) => {
    const etat = magasin.lire()
    const importes = catalogueGraine().modules.flatMap((candidat) =>
      candidat.importe ? [candidat] : [],
    )
    const module = importes.find(({ code }) => code === requete.module)
    const blocsDuModule =
      module === undefined ? null : new Set(module.parties.flatMap(({ blocs }) => blocs))
    const lignes = lignesDeLEtat(etat).filter(
      ({ bloc }) => blocsDuModule === null || blocsDuModule.has(bloc),
    )
    const page = pageDuJournal(lignes, {
      ...(requete.bloc === undefined ? {} : { bloc: requete.bloc }),
      ...(requete.type === undefined ? {} : { type: requete.type }),
      ...(requete.avant === undefined ? {} : { avant: requete.avant }),
    })
    const maintenant = horloge.maintenant()
    const codes = (module ?? importes[0])?.parties.flatMap(({ blocs }) => blocs) ?? []
    return {
      modules: importes.map(({ code, titre }) => ({ id: code, titre })),
      entrees: page.lignes.map((ligne): LigneJournal => ({
        ...ligne,
        detail: [...ligne.detail],
        note: Object.values(etat.notesJournal).find(({ entree }) => entree === ligne.id) ?? null,
      })),
      suivant: page.suivant,
      blocs: codes.flatMap((code) => {
        const manifeste = MANIFESTES_GRAINE[code]
        return manifeste === undefined
          ? []
          : [
              {
                bloc: code,
                titre_court: manifeste.titre_court,
                statut: resultatDuBloc(etat, code, maintenant).statut,
              },
            ]
      }),
      idees: [...etat.idees].reverse(),
    }
  }),

  definir(ROUTES['GET /journal/export.txt'], ({ magasin }) => exportDuJournal(magasin.lire())),

  definir(ROUTES['POST /journal/notes'], ({ magasin, horloge, corps }) => {
    const etat = magasin.lire()
    const deja = etat.notesJournal[corps.id]
    if (deja !== undefined) return deja
    if (!lignesDeLEtat(etat).some(({ id }) => id === corps.entree)) {
      throw introuvable(`La ligne « ${corps.entree} » n’existe pas dans le journal.`)
    }
    if (Object.values(etat.notesJournal).some(({ entree }) => entree === corps.entree)) {
      throw new ErreurApi({
        status: 409,
        code: 'conflit',
        titre: 'Conflit',
        detail: 'Cette ligne a déjà une note : modifie-la.',
      })
    }
    const note = {
      id: corps.id,
      entree: corps.entree,
      date: horloge.maintenant(),
      texte: corps.texte,
    }
    magasin.ecrire((courant) => ({
      ...courant,
      notesJournal: { ...courant.notesJournal, [note.id]: note },
    }))
    return note
  }),

  definir(ROUTES['PATCH /journal/notes/:id'], ({ magasin, params, corps }) => {
    const note = magasin.lire().notesJournal[params.id]
    if (note === undefined) throw introuvable(`La note « ${params.id} » n’existe pas.`)
    const modifiee = { ...note, texte: corps.texte }
    magasin.ecrire((courant) => ({
      ...courant,
      notesJournal: { ...courant.notesJournal, [modifiee.id]: modifiee },
    }))
    return modifiee
  }),

  definir(ROUTES['POST /journal/idees'], ({ magasin, horloge, corps }) => {
    const deja = magasin.lire().idees.find(({ id }) => id === corps.id)
    if (deja !== undefined) return deja
    const idee = { id: corps.id, date: horloge.maintenant(), texte: corps.texte }
    magasin.ecrire((courant) => ({ ...courant, idees: [...courant.idees, idee] }))
    return idee
  }),
]
