import { NoteCarte, Reglages } from '@janus/contrats'
import type { TypeJournal } from '@janus/contrats'
import type { Periode } from '@janus/moteur'
import { instantEnIso, instantEnMs } from '@janus/moteur'
import { nouvelId } from '@janus/contrats'
import type { Base } from '../../base/base.ts'
import { verrouBloc } from '../../base/transaction.ts'
import { Conflit, ContenuDifferent, Introuvable } from '../../erreurs.ts'
import { lireFaits } from '../../base/faits.ts'
import type { Horloge } from '../../horloge.ts'
import type { LireAujourdhui } from '../../types.ts'
import type { DepotSuivi } from './depot.ts'
import {
  composerExport,
  composerJournal,
  composerTableau,
  controlesDe,
  ligneDuJournal,
  mesuresDeTemps,
  notesCourantes,
} from './policy.ts'

const JOUR_MS = 86_400_000
/** Le mois en cours tient dans les 45 derniers jours, quelle que soit la bascule. */
const HISTORIQUE_DES_COUTS_JOURS = 45

export interface DependancesService {
  readonly base: Base
  readonly depot: DepotSuivi
  readonly horloge: Horloge
  readonly aujourdhui: LireAujourdhui
}

export function creerServiceSuivi({ base, depot, horloge, aujourdhui }: DependancesService) {
  /** Les blocs importés avec leur module, leur partie et leur manifeste, comme le suivi les lit. */
  async function plan() {
    const [modules, blocs] = await Promise.all([
      depot.modulesImportes(base.db),
      depot.blocsImportes(base.db),
    ])
    const codeDuModule = new Map(modules.map(({ id, code }) => [id, code]))
    return {
      modules: modules.map(({ code, titre }) => ({ id: code, titre })),
      lignes: blocs,
      blocs: blocs.map(({ code, moduleId, partieCode, partieTitre, manifeste }) => ({
        code,
        moduleCode: codeDuModule.get(moduleId) ?? moduleId,
        partie: partieCode === null ? '' : `${partieCode} ${partieTitre ?? ''}`.trim(),
        manifeste,
      })),
    }
  }

  const identifiant = () => nouvelId(instantEnMs(horloge.maintenant()))

  /** Une note, telle que l'écran la lit, depuis ses versions. */
  function noteLue(
    id: string,
    versions: readonly { entree: string; texte: string; date: string }[],
  ) {
    const premiere = versions[0]
    const derniere = versions.at(-1)
    if (premiere === undefined || derniere === undefined) {
      throw new Introuvable(`La note « ${id} » n'existe pas.`)
    }
    return { id, entree: premiere.entree, date: premiere.date, texte: derniere.texte }
  }

  return {
    /** Annote une ligne du journal ; rejouer le même message rend la même note. */
    async ajouterNote(userId: string, note: { id: string; entree: string; texte: string }) {
      const deja = await depot.versionsDeLaNote(base.db, userId, note.id)
      if (deja.length > 0) return noteLue(note.id, deja)
      const maintenant = horloge.maintenant()
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const { lignes, blocs } = await plan()
      const faits = await lireFaits(
        base.db,
        userId,
        lignes.map(({ id, code }) => ({ id, code })),
      )
      const ligne = ligneDuJournal(note.entree, { blocs, faits, reglages })
      const bloc = lignes.find(({ code }) => code === ligne?.bloc)
      if (ligne === undefined || bloc === undefined) {
        throw new Introuvable(`La ligne « ${note.entree} » n'existe pas dans le journal.`)
      }
      return base.enTransaction(async (tx) => {
        await verrouBloc(tx, userId, bloc.id)
        const existante = await depot.noteDeLEntree(tx, userId, note.entree)
        if (existante !== undefined && existante !== note.id) {
          throw new Conflit('Cette ligne a déjà une note : modifie-la.')
        }
        if (existante === undefined) {
          await depot.ajouterVersionDeNote(tx, {
            id: note.id,
            noteId: note.id,
            userId,
            entree: note.entree,
            texte: note.texte,
            dateServeur: maintenant,
          })
        }
        return noteLue(note.id, await depot.versionsDeLaNote(tx, userId, note.id))
      })
    },

    /** Modifie une note : une version de plus, l'ancienne reste gardée. */
    async modifierNote(userId: string, noteId: string, texte: string) {
      const versions = await depot.versionsDeLaNote(base.db, userId, noteId)
      const courante = noteLue(noteId, versions)
      if (courante.texte === texte) return courante
      await base.enTransaction((tx) =>
        depot.ajouterVersionDeNote(tx, {
          id: identifiant(),
          noteId,
          userId,
          entree: courante.entree,
          texte,
          dateServeur: horloge.maintenant(),
        }),
      )
      return noteLue(noteId, await depot.versionsDeLaNote(base.db, userId, noteId))
    },

    /** Range une idée « à explorer plus tard » ; rejouer le même message rend la même idée. */
    async ajouterIdee(userId: string, idee: { id: string; texte: string }) {
      const maintenant = horloge.maintenant()
      await base.enTransaction((tx) =>
        depot.ajouterIdee(tx, { id: idee.id, userId, texte: idee.texte, dateServeur: maintenant }),
      )
      const gardee = await depot.ideeParId(base.db, userId, idee.id)
      if (gardee === undefined) {
        throw new ContenuDifferent('Cet identifiant a déjà servi pour un autre contenu.')
      }
      return gardee
    },

    /** Marque la revue de la méthode comme faite, avec son texte s'il y en a un. */
    async ajouterRevue(userId: string, revue: { id: string; texte?: string | undefined }) {
      await base.enTransaction((tx) =>
        depot.ajouterRevueDeLaMethode(tx, {
          id: revue.id,
          userId,
          texte: revue.texte ?? null,
          dateServeur: horloge.maintenant(),
        }),
      )
    },

    /** Une page du journal, les plus récentes lignes d'abord. */
    async journal(
      userId: string,
      requete: {
        module?: string | undefined
        bloc?: string | undefined
        type?: TypeJournal | undefined
        avant?: string | undefined
      },
    ) {
      const maintenant = horloge.maintenant()
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const { modules, lignes, blocs } = await plan()
      const faits = await lireFaits(
        base.db,
        userId,
        lignes.map(({ id, code }) => ({ id, code })),
      )
      return composerJournal({
        modules,
        blocs,
        faits,
        reglages,
        maintenant,
        requete,
        notes: notesCourantes(await depot.versionsDesNotes(base.db, userId)),
        idees: await depot.idees(base.db, userId),
      })
    },

    /** Le journal au format de la méthode, en texte brut. */
    async exportTexte(userId: string) {
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const { lignes, blocs } = await plan()
      const faits = await lireFaits(
        base.db,
        userId,
        lignes.map(({ id, code }) => ({ id, code })),
      )
      return composerExport({
        blocs,
        faits,
        reglages,
        tachesReservees: await depot.tachesReservees(base.db),
        idees: await depot.idees(base.db, userId),
        derniereRevue: await depot.dernierTexteDeRevue(base.db, userId),
      })
    },

    /** Le tableau de bord, calculé à la lecture : rien n'est gardé. */
    async tableauDeBord(
      userId: string,
      requete: { module?: string | undefined; periode?: Periode | undefined },
    ) {
      const maintenant = horloge.maintenant()
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const [modules, blocs] = await Promise.all([
        depot.modulesImportes(base.db),
        depot.blocsImportes(base.db),
      ])
      const faits = await lireFaits(
        base.db,
        userId,
        blocs.map(({ id, code }) => ({ id, code })),
      )
      const codes = new Map(blocs.map(({ id, code }) => [id, code]))
      const codeDuModule = new Map(modules.map(({ id, code }) => [id, code]))
      const [corrections, avis, revuesCartes, temps, derniereRevue, couts, jour] =
        await Promise.all([
          depot.correctionsRendues(base.db, userId),
          depot.avisSurCorrections(base.db, userId),
          depot.notesDeCartes(base.db, userId),
          depot.tempsActif(
            base.db,
            userId,
            blocs.map(({ id }) => id),
          ),
          depot.derniereRevueDeLaMethode(base.db, userId),
          depot.coutsDepuis(
            base.db,
            userId,
            instantEnIso(instantEnMs(maintenant) - HISTORIQUE_DES_COUTS_JOURS * JOUR_MS),
          ),
          aujourdhui(userId),
        ])
      return composerTableau({
        modules: modules.map(({ code, titre }) => ({ id: code, titre })),
        module: requete.module,
        periode: requete.periode,
        blocs: blocs.map(({ code, moduleId, partieCode, partieTitre, manifeste }) => ({
          code,
          moduleCode: codeDuModule.get(moduleId) ?? moduleId,
          partie: partieCode === null ? '' : `${partieCode} ${partieTitre ?? ''}`.trim(),
          manifeste,
        })),
        faits,
        reglages,
        maintenant,
        controles: controlesDe(corrections, avis),
        revuesCartes: revuesCartes.flatMap(({ date, note }) => {
          const lue = NoteCarte.safeParse(note)
          return lue.success ? [{ date, note: lue.data }] : []
        }),
        mesuresTemps: mesuresDeTemps(temps, codes),
        derniereRevue,
        couts,
        aujourdhui: jour,
      })
    },
  }
}
export type ServiceSuivi = ReturnType<typeof creerServiceSuivi>
