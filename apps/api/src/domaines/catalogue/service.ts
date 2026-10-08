import { Catalogue, nouvelId, validerManifeste } from '@janus/contrats'
import { instantEnMs } from '@janus/moteur'
import type { Horloge } from '../../horloge.ts'
import { empreinteDuTexte, extraireManifeste, extraireSons } from './adaptateur.ts'
import type { Stockage } from './adaptateur.ts'
import type { CompteCartes, CompteImportCatalogue, DepotCatalogue } from './depot.ts'

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
