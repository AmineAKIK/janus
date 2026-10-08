import { Book, Calendar, FileText, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NOM_APPLI } from '../../nomAppli.ts'
import { classes } from '../../utilitaires/classes.ts'
import styles from './Navigation.module.css'

export { NOM_APPLI }

export type CleNavigation = 'aujourdhui' | 'formations' | 'tableau' | 'journal' | 'parametres'

/** Ce que reçoit la fonction `lien` : à poser tel quel sur le lien du routeur. */
export interface ProprietesLienNavigation {
  readonly cle: CleNavigation
  readonly className: string
  readonly 'aria-current': 'page' | undefined
  readonly children: ReactNode
}

export interface ProprietesNavigation {
  readonly actif: CleNavigation
  /** Rend un lien du routeur, pour que `ui` ne dépende pas du routeur. */
  readonly lien: (proprietes: ProprietesLienNavigation) => ReactNode
  readonly className?: string
}

interface Entree {
  readonly cle: CleNavigation
  readonly libelle: string
  readonly Icone: LucideIcon
}

const ENTREES: readonly Entree[] = [
  { cle: 'aujourdhui', libelle: 'Aujourd’hui', Icone: Calendar },
  { cle: 'formations', libelle: 'Formations', Icone: Book },
  { cle: 'tableau', libelle: 'Suivi', Icone: LayoutDashboard },
  { cle: 'journal', libelle: 'Journal', Icone: FileText },
  { cle: 'parametres', libelle: 'Paramètres', Icone: Settings },
]

/** Barre latérale dès 1024 px, barre basse en dessous : la bascule est faite par le CSS. */
export function Navigation({ actif, lien, className }: ProprietesNavigation) {
  return (
    <nav aria-label="Navigation principale" className={classes(styles['navigation'], className)}>
      <p className={classes(styles['nomAppli'], 'texte-sous-titre-18')}>{NOM_APPLI}</p>
      <ul className={styles['liste']}>
        {ENTREES.map(({ cle, libelle, Icone }) => (
          <li key={cle} className={styles['element']}>
            {lien({
              cle,
              className: classes(
                styles['lien'],
                'texte-navigation',
                cle === actif && styles['actif'],
              ),
              'aria-current': cle === actif ? 'page' : undefined,
              children: (
                <>
                  <Icone className={styles['icone']} aria-hidden={true} />
                  <span className={styles['libelle']}>{libelle}</span>
                </>
              ),
            })}
          </li>
        ))}
      </ul>
    </nav>
  )
}
