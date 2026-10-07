import { Manifeste } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { apres, DEBUT, fabrique, jusquaProvisoire, MANIFESTE, REGLAGES } from '../fabrique.ts'
import { exportTexte } from './exportTexte.ts'
import type { ContexteExport } from './exportTexte.ts'

const VIDE: ContexteExport = {
  manifestes: [],
  faits: [],
  reglages: REGLAGES,
  tachesReservees: [],
  idees: [],
  derniereRevue: null,
}

const TITRES = [
  '## En-tête',
  "### Blocs dans l'ordre",
  '### Tâches inédites réservées',
  '### À explorer plus tard',
  '### Dernière revue',
  '## Séances',
]

describe('exportTexte', () => {
  it('écrit les titres dans l’ordre du format de la méthode, même sans rien', () => {
    const texte = exportTexte(VIDE)
    const positions = TITRES.map((titre) => texte.indexOf(`${titre}\n`))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(texte).toContain('Aucun bloc.')
    expect(texte).toContain('Aucune.')
    expect(texte).toContain('Aucune idée.')
    expect(texte).toContain('Aucune revue.')
    expect(texte).toContain(
      '| Date | Bloc / tâche | Statut | Erreur précise | Aide utilisée (0-4) | Temps | Prochaine vérification |',
    )
    expect(texte.endsWith('| --- | --- | --- | --- | --- | --- | --- |\n')).toBe(true)
  })

  it('liste les blocs dans l’ordre avec prérequis et erreurs critiques, puis tâches, idées et revue', () => {
    const second = Manifeste.parse({ ...MANIFESTE, bloc: 'D02', prerequis: [MANIFESTE.bloc] })
    const texte = exportTexte({
      ...VIDE,
      manifestes: [MANIFESTE, second],
      tachesReservees: ['Maquette du portfolio'],
      idees: ['Un mode révision rapide.'],
      derniereRevue: 'Les retests marchent moins bien.',
    })

    expect(texte).toContain(`1. ${MANIFESTE.bloc} ${MANIFESTE.titre} (prérequis : aucun)`)
    expect(texte).toContain(`2. D02 ${MANIFESTE.titre} (prérequis : ${MANIFESTE.bloc})`)
    expect(texte).toContain(
      `   - Erreur critique E1 : ${MANIFESTE.erreurs_critiques[0]?.libelle ?? ''}`,
    )
    expect(texte).toContain('- Maquette du portfolio')
    expect(texte).toContain('- Un mode révision rapide.')
    expect(texte).toContain('Les retests marchent moins bien.')
  })

  it('met une ligne par bloc et par jour, avec statut, erreur, aide, temps et prochaine échéance', () => {
    const f = fabrique()
    const faits = [
      ...jusquaProvisoire(f),
      f.cochee(apres(DEBUT, 0, 3), 'E1'),
      f.cochee(apres(DEBUT, 0, 4), 'E404'),
      f.aisance(apres(DEBUT, 0, 6), 40),
      f.verification(apres(DEBUT, 5)),
    ]

    const texte = exportTexte({ ...VIDE, manifestes: [MANIFESTE], faits })
    const lignes = texte.split('\n').filter((ligne) => ligne.startsWith('| 2026'))

    expect(lignes).toHaveLength(2)
    expect(lignes[0]).toContain('| 2026-06-01 |')
    expect(lignes[0]).toContain('À reprendre')
    expect(lignes[0]).toContain(`${MANIFESTE.erreurs_critiques[0]?.libelle ?? ''} ; E404`)
    expect(lignes[0]).toContain('| 0 | 40 s |')
    expect(lignes[1]).toContain('| 2026-06-06 |')
    expect(lignes[1]).toContain('| - | - | - |')
  })

  it('trie par jour puis par ordre du plan, et protège les barres verticales', () => {
    const a = fabrique('D01')
    const b = fabrique('D02')
    const manifeste = (bloc: string, titre: string) =>
      Manifeste.parse({ ...MANIFESTE, bloc, titre })
    const texte = exportTexte({
      ...VIDE,
      manifestes: [manifeste('D01', 'Premier | bloc'), manifeste('D02', 'Second')],
      faits: [b.ouverture(DEBUT), a.ouverture(apres(DEBUT, 1)), a.ouverture(apres(DEBUT, 0, 1))],
    })
    const lignes = texte.split('\n').filter((ligne) => ligne.startsWith('| 2026'))

    expect(lignes.map((ligne) => ligne.split(' | ')[1])).toEqual([
      'D01 Premier / bloc',
      'D02 Second',
      'D01 Premier / bloc',
    ])
  })

  it('rend le même texte pour la même entrée', () => {
    const f = fabrique()
    const contexte = { ...VIDE, manifestes: [MANIFESTE], faits: jusquaProvisoire(f) }

    expect(exportTexte(contexte)).toBe(exportTexte(contexte))
  })
})
