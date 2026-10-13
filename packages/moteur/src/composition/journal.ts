import type { Fait, Reglages, TypeJournal } from '@janus/contrats'
import { calculerBloc } from '../statut.ts'
import { exportTexte, lignesDuJournal, pageDuJournal } from '../journal/index.ts'
import type { BlocImporte } from './bloc.ts'

/** Une note du journal telle que l'écran la lit : la dernière version du texte, la date de la première. */
export interface NoteLue {
  readonly id: string
  readonly entree: string
  readonly date: string
  readonly texte: string
}

export interface EntreeJournal {
  readonly modules: readonly { readonly id: string; readonly titre: string }[]
  readonly blocs: readonly BlocImporte[]
  readonly faits: readonly Fait[]
  readonly reglages: Reglages
  readonly maintenant: string
  readonly requete: {
    readonly module?: string | undefined
    readonly bloc?: string | undefined
    readonly type?: TypeJournal | undefined
    readonly avant?: string | undefined
  }
  readonly notes: readonly NoteLue[]
  readonly idees: readonly { readonly id: string; readonly date: string; readonly texte: string }[]
}

const manifestesParCode = (blocs: readonly BlocImporte[]) =>
  Object.fromEntries(blocs.map(({ code, manifeste }) => [code, manifeste]))

/** Une page du journal : les lignes du moteur, filtrées, avec les notes d'Amine. */
export function composerJournal(entree: EntreeJournal) {
  const { blocs, faits, reglages, maintenant, requete } = entree
  const manifestes = manifestesParCode(blocs)
  const module = entree.modules.find(({ id }) => id === requete.module)
  const blocsDuModule =
    module === undefined
      ? null
      : new Set(blocs.filter(({ moduleCode }) => moduleCode === module.id).map(({ code }) => code))
  const lignes = lignesDuJournal(faits, { manifestes, reglages }).filter(
    ({ bloc }) => blocsDuModule === null || blocsDuModule.has(bloc),
  )
  const page = pageDuJournal(lignes, {
    ...(requete.bloc === undefined ? {} : { bloc: requete.bloc }),
    ...(requete.type === undefined ? {} : { type: requete.type }),
    ...(requete.avant === undefined ? {} : { avant: requete.avant }),
  })
  const affiche = module ?? entree.modules[0]
  return {
    modules: entree.modules.map(({ id, titre }) => ({ id, titre })),
    entrees: page.lignes.map((ligne) => ({
      id: ligne.id,
      date: ligne.date,
      bloc: ligne.bloc,
      type: ligne.type,
      resume: ligne.resume,
      detail: [...ligne.detail],
      ...(ligne.contestationEnAttente === undefined
        ? {}
        : { contestation_en_attente: ligne.contestationEnAttente }),
      note: entree.notes.find(({ entree: cible }) => cible === ligne.id) ?? null,
    })),
    suivant: page.suivant,
    blocs: blocs
      .filter(({ moduleCode }) => moduleCode === affiche?.id)
      .map(({ code, manifeste }) => ({
        bloc: code,
        titre_court: manifeste.titre_court,
        statut: calculerBloc(
          faits.filter((fait) => fait.bloc === code),
          manifeste,
          reglages,
          maintenant,
        ).statut,
      })),
    idees: [...entree.idees].reverse(),
  }
}

/** Le journal au format de la méthode, en texte brut. */
export function composerExport(entree: {
  readonly blocs: readonly BlocImporte[]
  readonly faits: readonly Fait[]
  readonly reglages: Reglages
  readonly tachesReservees: readonly string[]
  readonly idees: readonly { readonly texte: string }[]
  readonly derniereRevue: string | null
}): string {
  return exportTexte({
    manifestes: entree.blocs.map(({ manifeste }) => manifeste),
    faits: entree.faits,
    reglages: entree.reglages,
    tachesReservees: entree.tachesReservees,
    idees: entree.idees.map(({ texte }) => texte),
    derniereRevue: entree.derniereRevue,
  })
}

/** La ligne du journal qui porte cet identifiant, avec le code de son bloc. */
export function ligneDuJournal(
  entree: string,
  contexte: {
    readonly blocs: readonly BlocImporte[]
    readonly faits: readonly Fait[]
    readonly reglages: Reglages
  },
): { readonly id: string; readonly bloc: string } | undefined {
  return lignesDuJournal(contexte.faits, {
    manifestes: manifestesParCode(contexte.blocs),
    reglages: contexte.reglages,
  }).find(({ id }) => id === entree)
}
