import { Readable } from 'node:stream'
import { z } from 'zod'
import { Manifeste, NoteCarte, Reglages } from '@janus/contrats'
import type { TypeJournal } from '@janus/contrats'
import type { BlocImporte, Periode } from '@janus/moteur'
import {
  composerExport,
  composerJournal,
  composerTableau,
  instantEnIso,
  instantEnMs,
  ligneDuJournal,
} from '@janus/moteur'
import { nouvelId } from '@janus/contrats'
import { maintenantActif, maintenantDeLaFormation } from '../../base/axeTemps.ts'
import type { Base } from '../../base/base.ts'
import { formationActiveDe } from '../../base/formationActive.ts'
import { verrouBloc } from '../../base/transaction.ts'
import { Conflit, ContenuDifferent, Introuvable } from '../../erreurs.ts'
import { lireFaits } from '../../base/faits.ts'
import type { Horloge } from '../../horloge.ts'
import type { LireAujourdhui } from '../../types.ts'
import type { DepotSuivi } from './depot.ts'
import { controlesDe, mesuresDeTemps, notesCourantes } from './policy.ts'

/** Les lignes d'une table que l'export écrit d'un seul tenant avant de rendre la main. */
const LIGNES_PAR_MORCEAU = 1_000

function rendreLaMain(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

/**
 * Le JSON de l'export, par morceaux : octet pour octet celui qu'écrirait `JSON.stringify` sur
 * l'objet entier, mais sans jamais construire la chaîne entière (320 Mo à 500 000 faits) ni bloquer la
 * boucle d'événements pendant qu'on la sérialise.
 */
async function* morceauxDeLExport(
  genereLe: string,
  donnees: Readonly<Record<string, readonly unknown[]>>,
): AsyncGenerator<string> {
  yield `{"version":1,"genere_le":${JSON.stringify(genereLe)},"donnees":{`
  let premiere = true
  for (const [nom, lignes] of Object.entries(donnees)) {
    yield `${premiere ? '' : ','}${JSON.stringify(nom)}:[`
    premiere = false
    for (let debut = 0; debut < lignes.length; debut += LIGNES_PAR_MORCEAU) {
      const morceau = lignes
        .slice(debut, debut + LIGNES_PAR_MORCEAU)
        .map((ligne) => JSON.stringify(ligne))
        .join(',')
      yield debut === 0 ? morceau : `,${morceau}`
      await rendreLaMain()
    }
    yield ']'
  }
  yield '}}'
}

const JOUR_MS = 86_400_000
/** Le mois en cours tient dans les 45 derniers jours, quelle que soit la bascule. */
const HISTORIQUE_DES_COUTS_JOURS = 45

/** Les blocs importés tels que le moteur les compose : module, partie et manifeste lu. */
function blocsImportes(
  modules: readonly { readonly id: string; readonly code: string }[],
  blocs: readonly {
    readonly code: string
    readonly moduleId: string
    readonly partieCode: string | null
    readonly partieTitre: string | null
    readonly manifeste: unknown
  }[],
): BlocImporte[] {
  const codeDuModule = new Map(modules.map(({ id, code }) => [id, code]))
  return blocs.map(({ code, moduleId, partieCode, partieTitre, manifeste }) => ({
    code,
    moduleCode: codeDuModule.get(moduleId) ?? moduleId,
    partie: partieCode === null ? '' : `${partieCode} ${partieTitre ?? ''}`.trim(),
    manifeste: Manifeste.parse(manifeste),
  }))
}

export interface DependancesService {
  readonly base: Base
  readonly depot: DepotSuivi
  readonly horloge: Horloge
  readonly aujourdhui: LireAujourdhui
}

export function creerServiceSuivi({ base, depot, horloge, aujourdhui }: DependancesService) {
  /** Les blocs importés avec leur module, leur partie et leur manifeste, comme le suivi les lit. */
  async function plan(reglages: Reglages) {
    const formationId = await formationActiveDe(base.db, reglages.formationActive)
    const [modules, blocs] = await Promise.all([
      depot.modulesImportes(base.db, formationId),
      depot.blocsImportes(base.db, formationId),
    ])
    return {
      formationId,
      modules: modules.map(({ code, titre }) => ({ id: code, titre })),
      lignes: blocs,
      blocs: blocsImportes(modules, blocs),
    }
  }

  /** Le plan, et tous les faits de l'utilisateur sur ses blocs. */
  async function planEtFaits(userId: string, reglages: Reglages) {
    const lePlan = await plan(reglages)
    return { ...lePlan, faits: await lireFaits(base.db, userId, lePlan.lignes) }
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
      const maintenant = await maintenantActif(base.db, horloge, userId)
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const { lignes, blocs, faits } = await planEtFaits(userId, reglages)
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
      const maintenant = await maintenantActif(base.db, horloge, userId)
      await base.enTransaction((tx) =>
        depot.ajouterVersionDeNote(tx, {
          id: identifiant(),
          noteId,
          userId,
          entree: courante.entree,
          texte,
          dateServeur: maintenant,
        }),
      )
      return noteLue(noteId, await depot.versionsDeLaNote(base.db, userId, noteId))
    },

    /** Range une idée « à explorer plus tard » ; rejouer le même message rend la même idée. */
    async ajouterIdee(userId: string, idee: { id: string; texte: string }) {
      const maintenant = await maintenantActif(base.db, horloge, userId)
      await base.enTransaction((tx) =>
        depot.ajouterIdee(tx, { id: idee.id, userId, texte: idee.texte, dateServeur: maintenant }),
      )
      const gardee = await depot.ideeParId(base.db, userId, idee.id)
      if (gardee?.texte !== idee.texte) {
        throw new ContenuDifferent()
      }
      return gardee
    },

    /** Marque la revue de la méthode comme faite, avec son texte s'il y en a un. */
    async ajouterRevue(userId: string, revue: { id: string; texte?: string | undefined }) {
      const texte = revue.texte ?? null
      const maintenant = await maintenantActif(base.db, horloge, userId)
      await base.enTransaction(async (tx) => {
        const ajoutee = await depot.ajouterRevueDeLaMethode(tx, {
          id: revue.id,
          userId,
          texte,
          dateServeur: maintenant,
        })
        if (ajoutee) return
        const gardee = await depot.revueParId(tx, revue.id)
        if (gardee?.userId !== userId || gardee.texte !== texte) {
          throw new ContenuDifferent()
        }
      })
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
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const { modules, blocs, faits, formationId } = await planEtFaits(userId, reglages)
      const maintenant = await maintenantDeLaFormation(base.db, horloge, userId, formationId)
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
      const { blocs, faits, formationId } = await planEtFaits(userId, reglages)
      return composerExport({
        blocs,
        faits,
        reglages,
        tachesReservees: await depot.tachesReservees(base.db, formationId),
        idees: await depot.idees(base.db, userId),
        derniereRevue: await depot.dernierTexteDeRevue(base.db, userId),
      })
    },

    /**
     * Toutes les données de l'utilisateur, au format versionné de l'export, en flux. Les données sont lues
     * et vérifiées avant le premier octet : une ligne illisible donne une erreur, pas un flux tronqué.
     */
    async exportJson(userId: string) {
      const donnees = z.record(z.string(), z.json()).parse(await depot.donneesDe(base.db, userId))
      const lignes = Object.fromEntries(
        Object.entries(donnees).map(([nom, valeur]) => [nom, Array.isArray(valeur) ? valeur : []]),
      )
      return Readable.from(morceauxDeLExport(horloge.maintenant(), lignes), { objectMode: false })
    },

    /** Le tableau de bord, calculé à la lecture : rien n'est gardé. */
    async tableauDeBord(
      userId: string,
      requete: { module?: string | undefined; periode?: Periode | undefined },
    ) {
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const { formationId, modules, lignes, blocs, faits } = await planEtFaits(userId, reglages)
      const maintenant = await maintenantDeLaFormation(base.db, horloge, userId, formationId)
      const codes = new Map(lignes.map(({ id, code }) => [id, code]))
      const [corrections, avis, revuesCartes, temps, derniereRevue, couts, jour] =
        await Promise.all([
          depot.correctionsRendues(base.db, userId),
          depot.avisSurCorrections(base.db, userId),
          depot.notesDeCartes(base.db, userId),
          depot.tempsActif(
            base.db,
            userId,
            lignes.map(({ id }) => id),
          ),
          depot.derniereRevueDeLaMethode(base.db, userId),
          depot.coutsDepuis(
            base.db,
            userId,
            instantEnIso(instantEnMs(horloge.maintenant()) - HISTORIQUE_DES_COUTS_JOURS * JOUR_MS),
          ),
          aujourdhui(userId),
        ])
      return composerTableau({
        modules,
        module: requete.module,
        periode: requete.periode,
        blocs,
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
