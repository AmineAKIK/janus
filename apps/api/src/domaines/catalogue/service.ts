import {
  Catalogue,
  EtatPage,
  IdUuid,
  Manifeste,
  Reglages,
  Statut,
  nouvelId,
  validerManifeste,
} from '@janus/contrats'
import type { CinqPreuves } from '@janus/contrats'
import { accesBloc, calculerBloc, instantEnMs, preuvesDuBloc } from '@janus/moteur'
import type { ResultatBloc } from '@janus/moteur'
import { z } from 'zod'
import type { Base } from '../../base/base.ts'
import { lireFaits } from '../../base/faits.ts'
import { verrouBloc } from '../../base/transaction.ts'
import type { Db, Tx } from '../../base/transaction.ts'
import { ContenuDifferent, ErreurProtocole, Introuvable } from '../../erreurs.ts'
import type { Horloge } from '../../horloge.ts'
import { recalculer, versStatutBloc } from '../../recalcul.ts'
import { empreinteDuTexte, extraireManifeste, extraireSons } from './adaptateur.ts'
import type { Stockage } from './adaptateur.ts'
import type { CompteCartes, CompteImportCatalogue, DepotCatalogue } from './depot.ts'
import { peutOuvrir, serieOuverte } from './policy.ts'

/** Un import refusé, avec tous ses problèmes (la ligne de commande les affiche et sort en erreur). */
export class ErreurImport extends Error {
  readonly problemes: readonly string[]
  constructor(problemes: readonly string[]) {
    super(problemes.join('\n'))
    this.name = 'ErreurImport'
    this.problemes = problemes
  }
}

export interface FicheImportee {
  readonly bloc: string
  readonly version: number
  readonly empreinte: string
  /** Le poids de la fiche écrite, en octets. */
  readonly octets: number
  /** Les sons sortis de la fiche. */
  readonly sons: number
  /** Vrai si cette version était déjà importée à l'identique : rien n'a changé. */
  readonly dejaImportee: boolean
  readonly cartes: CompteCartes
}

export interface DependancesService {
  readonly depot: DepotCatalogue
  readonly stockage: Stockage
  readonly horloge: Horloge
}

export function creerServiceCatalogue({ depot, stockage, horloge }: DependancesService) {
  const identifiant = () => nouvelId(instantEnMs(horloge.maintenant()))

  return {
    /** Importe le plan d'une formation. Relancer le même fichier ne crée rien de plus. */
    async importerCatalogue(json: unknown): Promise<CompteImportCatalogue> {
      const lu = Catalogue.safeParse(json)
      if (!lu.success) {
        throw new ErreurImport(
          lu.error.issues.map(
            ({ path, message }) => `${path.map(String).join('.') || 'catalogue'} : ${message}`,
          ),
        )
      }
      const { formation, modules } = lu.data
      return depot.importerCatalogue(
        formation,
        modules.map((leModule) => ({
          code: leModule.code,
          titre: leModule.titre,
          description: leModule.description,
          ordre: leModule.ordre,
          importe: leModule.importe,
          parties: leModule.importe ? leModule.parties : [],
        })),
        identifiant,
      )
    },

    /** Importe une fiche HTML : valide son manifeste, la range sous son empreinte, crée sa version et ses cartes. */
    async importerFiche(html: string): Promise<FicheImportee> {
      const texte = extraireManifeste(html)
      if (texte === undefined) {
        throw new ErreurImport([
          'Aucun manifeste : la fiche doit contenir <script type="application/json" id="bloc-manifest">.',
        ])
      }
      let brut: unknown
      try {
        brut = JSON.parse(texte)
      } catch {
        throw new ErreurImport(['Le manifeste n’est pas du JSON valide.'])
      }
      const resultat = validerManifeste(brut)
      if (!resultat.ok) {
        throw new ErreurImport(
          resultat.problemes.map(({ chemin, message }) =>
            chemin === '' ? message : `${chemin} : ${message}`,
          ),
        )
      }
      const { manifeste } = resultat

      const blocs = await depot.blocsParCode(manifeste.bloc)
      const [leBloc] = blocs
      if (leBloc === undefined) {
        throw new ErreurImport([
          `Le bloc ${manifeste.bloc} n’existe pas dans le catalogue. Importe d’abord le catalogue.`,
        ])
      }
      if (blocs.length > 1) {
        throw new ErreurImport([`Le code ${manifeste.bloc} désigne plusieurs blocs du catalogue.`])
      }

      const extraction = extraireSons(html)
      const empreinte = empreinteDuTexte(extraction.html)
      const existantes = await depot.versionsDuBloc(leBloc.id)
      const memeVersion = existantes.find(({ version }) => version === manifeste.version)
      const octets = Buffer.byteLength(extraction.html)
      if (memeVersion !== undefined) {
        if (memeVersion.empreinte !== empreinte) {
          throw new ErreurImport([
            `La version ${String(manifeste.version)} de ${manifeste.bloc} est déjà importée avec un autre contenu. Incrémente la version du manifeste.`,
          ])
        }
        return {
          bloc: manifeste.bloc,
          version: manifeste.version,
          empreinte,
          octets,
          sons: extraction.fichiers.length,
          dejaImportee: true,
          cartes: { ajoutees: 0, retirees: 0, total: manifeste.cartes.length },
        }
      }
      for (const fichier of extraction.fichiers) {
        await stockage.ecrire(manifeste.bloc, fichier.nom, fichier.contenu)
      }
      const chemin = await stockage.ecrire(manifeste.bloc, `${empreinte}.html`, extraction.html)
      const cartes = await depot.ajouterVersion(
        {
          id: identifiant(),
          blocId: leBloc.id,
          version: manifeste.version,
          empreinte,
          chemin,
          manifeste,
          creeLe: horloge.maintenant(),
          titreBloc: manifeste.titre,
          cartes: manifeste.cartes.map(({ id, recto, verso }) => ({ carteId: id, recto, verso })),
        },
        identifiant,
      )
      return {
        bloc: manifeste.bloc,
        version: manifeste.version,
        empreinte,
        octets,
        sons: extraction.fichiers.length,
        dejaImportee: false,
        cartes,
      }
    },
  }
}
export type ServiceCatalogue = ReturnType<typeof creerServiceCatalogue>

const SANS_STATUT: Statut = 'non_commence'

export interface DependancesLecture {
  readonly base: Base
  readonly depot: DepotCatalogue
  readonly horloge: Horloge
  /** L'adresse d'où les fiches sont servies. */
  readonly fichesUrl: string
}

function introuvable(quoi: string): Introuvable {
  return new Introuvable(`${quoi} n’existe pas.`)
}

/** Les routes de lecture du catalogue, et l'ouverture d'un bloc. */
export function creerServiceLecture({ base, depot, horloge, fichesUrl }: DependancesLecture) {
  // Le validateur rejoue la fiche une fois par version en service : un validateur plus strict peut
  // refuser une fiche déjà importée.
  const problemesParVersion = new Map<string, readonly string[]>()
  const racine = fichesUrl.replace(/\/+$/, '')

  function problemesDe(versionId: string, manifeste: unknown): readonly string[] {
    const connus = problemesParVersion.get(versionId)
    if (connus !== undefined) return connus
    const resultat = validerManifeste(manifeste)
    const problemes = resultat.ok
      ? []
      : resultat.problemes.map(({ chemin, message }) =>
          chemin === '' ? message : `${chemin} : ${message}`,
        )
    problemesParVersion.set(versionId, problemes)
    return problemes
  }

  async function statutsDesPrerequis(
    lecteur: Db | Tx,
    userId: string,
    prerequis: readonly string[],
  ): Promise<Statut[]> {
    const statuts = await depot.statutsCourants(lecteur, userId, prerequis)
    return prerequis.map((code) => Statut.parse(statuts.get(code) ?? SANS_STATUT))
  }

  async function bloc(lecteur: Db | Tx, code: string) {
    const trouve = await depot.blocEtVersion(lecteur, code)
    if (trouve?.version === undefined) throw introuvable(`Le bloc « ${code} »`)
    return {
      bloc: trouve.bloc,
      version: trouve.version,
      manifeste: Manifeste.parse(trouve.version.manifeste),
    }
  }

  return {
    async formations() {
      return { formations: await depot.formations(base.db) }
    },

    async modules(formationId: string) {
      if (
        !IdUuid.safeParse(formationId).success ||
        !(await depot.formationExiste(base.db, formationId))
      ) {
        throw introuvable(`La formation « ${formationId} »`)
      }
      return { modules: await depot.modulesDeLaFormation(base.db, formationId) }
    },

    async blocsDuModule(userId: string, moduleId: string) {
      const leModule = IdUuid.safeParse(moduleId).success
        ? await depot.moduleParId(base.db, moduleId)
        : undefined
      if (leModule === undefined) throw introuvable(`Le module « ${moduleId} »`)
      if (!leModule.importe) return { blocs: [] }
      const lignes = await depot.blocsDuModule(base.db, moduleId, userId)
      return {
        blocs: lignes.map((ligne) => ({
          bloc: ligne.code,
          titre: ligne.titre,
          titre_court: ligne.titreCourt ?? ligne.titre,
          partie:
            ligne.partieCode === null
              ? ''
              : `${ligne.partieCode} ${ligne.partieTitre ?? ''}`.trim(),
          prerequis: z.array(z.string()).parse(ligne.prerequis),
          statut: Statut.parse(ligne.statut ?? SANS_STATUT),
        })),
      }
    },

    async bloc(userId: string, code: string) {
      const maintenant = horloge.maintenant()
      const { bloc: leBloc, version, manifeste } = await bloc(base.db, code)
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const faits = await lireFaits(base.db, userId, [leBloc])
      const resultat = calculerBloc(faits, manifeste, reglages, maintenant)
      const page = await depot.etatPage(base.db, userId, leBloc.id)
      return {
        ...versStatutBloc(resultat),
        bloc: leBloc.code,
        module: leBloc.moduleId,
        version: version.version,
        manifeste,
        problemes: [...problemesDe(version.id, version.manifeste)],
        serie_ouverte: serieOuverte(
          resultat.statut,
          resultat.manque.some(({ code: manque }) => manque === 'consolidation_trop_tot'),
        ),
        force: resultat.force,
        acces: accesBloc(await statutsDesPrerequis(base.db, userId, manifeste.prerequis)),
        preuves: preuvesDeLApi(resultat, reglages),
        fiche_url: `${racine}/${version.chemin}`,
        etat_page:
          page === undefined ? null : { version: page.version, etat: EtatPage.parse(page.etat) },
      }
    },

    /**
     * Ouvre un bloc : le verrou du bloc, la règle d'accès, le fait d'ouverture, le recalcul. Le même
     * identifiant avec le même contenu rend l'état d'origine ; avec un autre contenu, 422.
     */
    async ouvrir(
      userId: string,
      code: string,
      demande: { id: string; hors_prerequis: boolean; raison?: string | undefined },
    ) {
      const { bloc: leBloc, version, manifeste } = await bloc(base.db, code)
      const reglages = Reglages.parse(await depot.reglagesDe(base.db, userId))
      const empreinte = empreinteDuTexte(
        JSON.stringify({
          bloc: code,
          hors_prerequis: demande.hors_prerequis,
          raison: demande.raison ?? null,
        }),
      )
      return base.enTransaction(async (tx) => {
        await verrouBloc(tx, userId, leBloc.id)
        const maintenant = horloge.maintenant()
        const acces = accesBloc(await statutsDesPrerequis(tx, userId, manifeste.prerequis))
        const existant = await depot.evenementParId(tx, demande.id)
        if (existant === undefined) {
          if (
            !peutOuvrir(acces, { horsPrerequis: demande.hors_prerequis, raison: demande.raison })
          ) {
            throw new ErreurProtocole(
              400,
              'donnees_invalides',
              'Raison exigée',
              'Ce bloc a des prérequis pas encore acquis : donne la raison de ton choix.',
            )
          }
          await depot.ajouterOuverture(tx, {
            id: demande.id,
            userId,
            blocId: leBloc.id,
            ficheVersionId: version.id,
            donnees: {
              horsPrerequis: demande.hors_prerequis,
              ...(demande.raison === undefined ? {} : { raison: demande.raison }),
            },
            empreinte,
            dateServeur: maintenant,
          })
        } else if (existant.userId !== userId || existant.empreinte !== empreinte) {
          throw new ContenuDifferent('Cet identifiant a déjà servi pour un autre contenu.')
        }
        const resultat = await recalculer(tx, {
          userId,
          bloc: leBloc,
          manifeste,
          reglages,
          maintenant,
        })
        return { acces, ...versStatutBloc(resultat) }
      })
    },
  }
}
export type ServiceLecture = ReturnType<typeof creerServiceLecture>

/** Le panneau « Cinq preuves » tel que l'API le rend. */
function preuvesDeLApi(resultat: ResultatBloc, reglages: Reglages): CinqPreuves {
  const preuves = preuvesDuBloc(resultat, reglages)
  return {
    comprendre: preuves.comprendre,
    faire_seul: preuves.faireSeul,
    transferer: preuves.transferer,
    retenir:
      preuves.retenir === null
        ? null
        : {
            date: preuves.retenir.date,
            prochaine:
              preuves.retenir.prochaine === null
                ? null
                : { type: preuves.retenir.prochaine.type, apres: preuves.retenir.prochaine.apres },
          },
    aisance: preuves.aisance,
  }
}
