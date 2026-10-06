import { LegendeStatuts } from '../catalogue/RepartitionStatuts.tsx'
import { NoeudBloc } from '@janus/ui'
import type { DonneesSuivi } from './useSuivi.ts'
import styles from './Suivi.module.css'
import { TEXTES_SUIVI as T, texteCarte } from './textes.ts'

type BlocCarte = DonneesSuivi['blocs'][number]

const LARGEUR = 48
const HAUTEUR = 44
const ECART_X = 24
const ECART_Y = 40

const adresse = (lien: string) => `#${lien}`

/** Les blocs rangés par partie, dans l'ordre du plan : une rangée par partie. */
export function rangees(blocs: readonly BlocCarte[]): readonly (readonly BlocCarte[])[] {
  const resultat: BlocCarte[][] = []
  for (const bloc of blocs) {
    const derniere = resultat.at(-1)
    if (derniere !== undefined && derniere[0]?.partie === bloc.partie) derniere.push(bloc)
    else resultat.push([bloc])
  }
  return resultat
}

export function CarteDuModule({ blocs }: { readonly blocs: DonneesSuivi['blocs'] }) {
  const lignes = rangees(blocs)
  const positions = new Map<string, { x: number; y: number }>()
  lignes.forEach((ligne, rang) => {
    ligne.forEach((bloc, colonne) => {
      positions.set(bloc.bloc, {
        x: colonne * (LARGEUR + ECART_X),
        y: rang * (HAUTEUR + ECART_Y),
      })
    })
  })
  const colonnes = Math.max(0, ...lignes.map((ligne) => ligne.length))
  const largeur = Math.max(0, colonnes * (LARGEUR + ECART_X) - ECART_X)
  const hauteur = Math.max(0, lignes.length * (HAUTEUR + ECART_Y) - ECART_Y)

  const traits = blocs.flatMap((bloc) =>
    bloc.prerequis.flatMap((code) => {
      const de = positions.get(code)
      const vers = positions.get(bloc.bloc)
      return de === undefined || vers === undefined
        ? []
        : [{ cle: `${code}-${bloc.bloc}`, de, vers }]
    }),
  )

  return (
    <div>
      <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{texteCarte(blocs.length)}</p>
      <div className={styles['defilement']}>
        <div className={styles['carte']} style={{ width: largeur, height: hauteur }}>
          <svg className={styles['traits']} width={largeur} height={hauteur} aria-hidden="true">
            {traits.map(({ cle, de, vers }) => (
              <line
                key={cle}
                x1={de.x + LARGEUR / 2}
                y1={de.y + HAUTEUR / 2}
                x2={vers.x + LARGEUR / 2}
                y2={vers.y + HAUTEUR / 2}
              />
            ))}
          </svg>
          {blocs.map((bloc) => {
            const position = positions.get(bloc.bloc)
            return (
              <div
                key={bloc.bloc}
                className={styles['noeud']}
                style={{ left: position?.x ?? 0, top: position?.y ?? 0 }}
              >
                <NoeudBloc
                  code={bloc.bloc}
                  libelle={bloc.titre_court}
                  statut={bloc.statut}
                  lien={(proprietes) => <a href={adresse(`/blocs/${bloc.bloc}`)} {...proprietes} />}
                />
                {bloc.prerequis_non_valides && (
                  <span className={styles['marque']} role="img" aria-label={T.prerequisNonValide}>
                    ⚠
                  </span>
                )}
                {bloc.redescendu && (
                  <span
                    className={`${styles['marque'] ?? ''} ${styles['marqueBas'] ?? ''}`}
                    role="img"
                    aria-label={T.redescendu}
                  >
                    ↩
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <LegendeStatuts titre={T.legende} />
      <p className={`${styles['complement'] ?? ''} texte-legende-12`}>
        {T.legendePrerequis} · {T.legendeRedescendu}
      </p>
    </div>
  )
}
