import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DonneesSuivi } from '../useSuivi.ts'
import { libelleSemaine, texteAideMoyenne, texteMeilleur, texteReussites } from './textes.ts'
import { ZoneAisance, ZoneAutonomie, ZoneCalibration, ZoneRetention } from './Zones.tsx'

type Autonomie = DonneesSuivi['mesures']['autonomie']

const semaines = (parts: readonly (number | null)[]): Autonomie['semaines'] =>
  parts.map((part, rang) => ({
    debut: `2026-09-${String(14 + 7 * rang)}`,
    sans_aide: part === null ? 0 : Math.round(part * 4),
    total: part === null ? 0 : 4,
    part,
  }))

describe('textes des mesures', () => {
  it('nomme les semaines du plus ancien au plus récent', () => {
    expect([0, 1, 2, 3].map((rang) => libelleSemaine(rang, 4))).toEqual([
      'Il y a 3 semaines',
      'Il y a 2 semaines',
      'Semaine dernière',
      'Cette semaine',
    ])
  })

  it('écrit l’aide, le meilleur temps et les réussites', () => {
    expect(texteAideMoyenne(0.5)).toBe('Aide moyenne cette semaine : 0,5')
    expect(texteMeilleur(45, 60)).toBe('45 s · objectif 60 s')
    expect(texteMeilleur(null, 30)).toBe('aucun temps · objectif 30 s')
    expect(texteReussites(1, 3, 2)).toBe('1 réussite sur 3, sur 2 jours différents')
    expect(texteReussites(2, 2, 1)).toBe('2 réussites sur 2, sur 1 jour différent')
  })
})

describe('Autonomie', () => {
  it('montre les 4 semaines et la phrase de comparaison', () => {
    render(
      <ZoneAutonomie donnees={{ semaines: semaines([0.5, null, 0.75, 1]), aide_moyenne: 0.5 }} />,
    )

    expect(screen.getByRole('heading', { name: 'Autonomie' })).toBeVisible()
    expect(screen.getByText('Réponses correctes sans aide')).toBeVisible()
    expect(screen.getAllByRole('progressbar')).toHaveLength(4)
    expect(screen.getByText('Il y a 3 semaines')).toBeVisible()
    expect(screen.getByText('Cette semaine')).toBeVisible()
    expect(
      screen.getByText('100 % sans aide cette semaine, contre 50 % il y a 3 semaines'),
    ).toBeVisible()
    expect(screen.getByText('Aide moyenne cette semaine : 0,5')).toBeVisible()
  })

  it('omet la phrase quand une semaine manque, et dit qu’il n’y a rien sans pratique', () => {
    const { rerender } = render(
      <ZoneAutonomie donnees={{ semaines: semaines([null, null, null, 1]), aide_moyenne: null }} />,
    )
    expect(screen.queryByText(/contre/)).toBeNull()
    expect(screen.queryByText(/Aide moyenne/)).toBeNull()

    rerender(
      <ZoneAutonomie
        donnees={{ semaines: semaines([null, null, null, null]), aide_moyenne: null }}
      />,
    )
    expect(screen.getByText('Pas encore d’exercice de pratique.')).toBeVisible()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})

describe('Rétention', () => {
  it('montre un tableau par semaine, sans total global', () => {
    render(
      <ZoneRetention
        donnees={[
          {
            debut: '2026-09-16',
            cartes: { reussis: 8, total: 10 },
            questions: { reussis: 4, total: 6 },
            verifications: { reussis: 1, total: 1 },
          },
          {
            debut: '2026-09-23',
            cartes: { reussis: 0, total: 0 },
            questions: { reussis: 0, total: 0 },
            verifications: { reussis: 0, total: 0 },
          },
        ]}
      />,
    )

    expect(screen.getByText('Mesures par semaine, sans agrégat global')).toBeVisible()
    const lignes = screen.getAllByRole('row').map((ligne) => ligne.textContent)
    expect(lignes).toEqual([
      'Semaine duCartesQuestions de débutVérifications',
      '16 sept.10 · 80 %4 sur 61 sur 1',
      '23 sept.–––',
    ])
  })
})

describe('Calibration', () => {
  it('croise la confiance et le résultat, et liste les erreurs en étant sûr', () => {
    render(
      <ZoneCalibration
        donnees={{
          lignes: [
            { confiance: 'sur', justes: 6, faux: 1 },
            { confiance: 'hesitant', justes: 2, faux: 2 },
            { confiance: 'hasard', justes: 0, faux: 1 },
          ],
          erreurs_sures: [{ bloc: 'B04', question: 'R1', date: '2026-10-14T10:00:00Z' }],
        }}
      />,
    )

    expect(screen.getByText('Confiance déclarée avant correction')).toBeVisible()
    const lignes = screen.getAllByRole('row').map((ligne) => ligne.textContent)
    expect(lignes).toEqual(['ConfianceJusteFaux', 'Sûr61', 'Hésitant22', 'Au hasard01'])
    expect(screen.getByText('Erreurs en étant sûr : 1 cette semaine')).toBeVisible()
    expect(screen.getByRole('link', { name: 'B04' })).toHaveAttribute('href', '#/blocs/B04')
    expect(screen.getByText('Une erreur en étant sûr vaut une révision.')).toBeVisible()
  })

  it('n’affiche aucune liste sans erreur en étant sûr', () => {
    render(
      <ZoneCalibration
        donnees={{
          lignes: [{ confiance: 'sur', justes: 1, faux: 0 }],
          erreurs_sures: [],
        }}
      />,
    )
    expect(screen.getByText('Erreurs en étant sûr : 0 cette semaine')).toBeVisible()
    expect(screen.queryByRole('list')).toBeNull()
  })
})

describe('Aisance', () => {
  it('montre une ligne par bloc, avec « non requis » sans cible', () => {
    render(
      <ZoneAisance
        donnees={[
          {
            bloc: 'B01',
            titre_court: 'Bits',
            cible: {
              libelle: 'Dire les étapes',
              objectif_s: 30,
              meilleur_s: 25,
              reussites: 1,
              reussites_requises: 2,
              jours: 1,
              jours_requis: 2,
            },
          },
          { bloc: 'B02', titre_court: 'Logique', cible: null },
        ]}
      />,
    )

    const [premiere, seconde] = screen.getAllByRole('listitem').map((ligne) => within(ligne))
    expect(premiere?.getByRole('link')).toHaveAttribute('href', '#/blocs/B01')
    expect(
      premiere?.getByText('25 s · objectif 30 s · 1 réussite sur 2, sur 2 jours différents'),
    ).toBeVisible()
    expect(seconde?.getByText('non requis')).toBeVisible()
  })
})
