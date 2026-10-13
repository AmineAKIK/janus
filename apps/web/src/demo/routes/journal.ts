import { ErreurApi, ROUTES } from '@janus/contrats'
import type { EtatDemo } from '@janus/contrats/demo'
import { composerExport, composerJournal, ligneDuJournal } from '@janus/moteur'
import { blocsImportesDeLaDemo, modulesImportesDeLaDemo } from './calculs.ts'
import { definir } from './definir.ts'

const introuvable = (detail: string) =>
  new ErreurApi({ status: 404, code: 'introuvable', titre: 'Introuvable', detail })

/** Ce que la démo fournit au moteur : les blocs importés, les faits et les réglages gardés. */
const contexteDeLEtat = (etat: EtatDemo) => ({
  blocs: blocsImportesDeLaDemo(),
  faits: etat.faits,
  reglages: etat.reglages,
})

/** Le journal au format de la méthode. Les tâches inédites réservées et la dernière revue n'ont pas encore de données en démo. */
const exportDuJournal = (etat: EtatDemo): string =>
  composerExport({
    ...contexteDeLEtat(etat),
    tachesReservees: [],
    idees: etat.idees,
    derniereRevue: etat.revuesMethode.findLast(({ texte }) => texte !== undefined)?.texte ?? null,
  })

export const ROUTES_JOURNAL_DEMO = [
  definir(ROUTES['GET /journal'], ({ magasin, horloge, requete }) => {
    const etat = magasin.lire()
    return composerJournal({
      ...contexteDeLEtat(etat),
      modules: modulesImportesDeLaDemo().map(({ code, titre }) => ({ id: code, titre })),
      maintenant: horloge.maintenant(),
      requete,
      notes: Object.values(etat.notesJournal),
      idees: etat.idees,
    })
  }),

  definir(ROUTES['GET /journal/export.txt'], ({ magasin }) => exportDuJournal(magasin.lire())),

  definir(ROUTES['POST /journal/notes'], ({ magasin, horloge, corps }) => {
    const etat = magasin.lire()
    const deja = etat.notesJournal[corps.id]
    if (deja !== undefined) return deja
    if (ligneDuJournal(corps.entree, contexteDeLEtat(etat)) === undefined) {
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
  definir(ROUTES['POST /revues-methode'], ({ magasin, horloge, corps }) => {
    if (magasin.lire().revuesMethode.some(({ id }) => id === corps.id)) return null
    const revue = {
      id: corps.id,
      date: horloge.maintenant(),
      ...(corps.texte === undefined ? {} : { texte: corps.texte }),
    }
    magasin.ecrire((courant) => ({ ...courant, revuesMethode: [...courant.revuesMethode, revue] }))
    return null
  }),
]
