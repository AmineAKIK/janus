import { describe, expect, it } from 'vitest'
import demo from '../fixtures/manifeste-demo.json' with { type: 'json' }
import { validerManifeste, type Probleme } from './validerManifeste.ts'

/** Copie modifiable du manifeste de démonstration. */
function copie(): Record<string, unknown> & {
  restitution: Record<string, unknown>[]
  consolidation: Record<string, unknown>[]
  rappel: Record<string, unknown>[]
  differees: Record<string, unknown>[]
  pratique: { reussite: number; items: unknown[] }[]
  erreurs_critiques: unknown[]
  prerequis: string[]
  sources: { id: string }[]
} {
  return structuredClone(demo)
}

function problemesDe(donnees: unknown): readonly Probleme[] {
  const resultat = validerManifeste(donnees)
  if (resultat.ok) throw new Error('Le manifeste aurait dû être refusé.')
  return resultat.problemes
}

describe('validerManifeste, manifeste de démonstration', () => {
  it('est valide', () => {
    const resultat = validerManifeste(demo)
    expect(resultat.ok).toBe(true)
    if (resultat.ok) expect(resultat.manifeste.titre).toBe('Bloc de démonstration')
  })

  it('décrit le bloc fictif D01', () => {
    expect(demo.bloc).toBe('D01')
  })
})

describe('validerManifeste, structure', () => {
  it('refuse autre chose qu’un objet', () => {
    expect(problemesDe(null)).toEqual([{ chemin: '', message: 'Ce champ doit être un objet.' }])
  })

  it('refuse un champ obligatoire absent', () => {
    const m = copie()
    delete m['titre']
    expect(problemesDe(m)).toEqual([{ chemin: 'titre', message: 'Ce champ est obligatoire.' }])
  })

  it('refuse un mauvais type', () => {
    const m = copie()
    m['version'] = 'un'
    expect(problemesDe(m)).toEqual([
      { chemin: 'version', message: 'Ce champ doit être un nombre.' },
    ])
  })

  it('refuse une version à zéro', () => {
    const m = copie()
    m['version'] = 0
    expect(problemesDe(m)).toEqual([
      { chemin: 'version', message: 'Cette valeur doit être au moins 1.' },
    ])
  })

  it('refuse un texte vide', () => {
    const m = copie()
    m['objectif'] = '  '
    expect(problemesDe(m)).toEqual([
      { chemin: 'objectif', message: 'Ce texte ne doit pas être vide.' },
    ])
  })

  it('refuse un schéma autre que 2, avec les valeurs possibles', () => {
    const m = copie()
    m['schema'] = 1
    expect(problemesDe(m)).toEqual([
      { chemin: 'schema', message: 'Valeur non autorisée. Valeurs possibles : 2.' },
    ])
  })

  it('refuse un type d’étape inconnu', () => {
    const m = copie()
    const etapes = m['etapes'] as { type: string }[]
    etapes[0] = { ...etapes[0], type: 'inconnu' }
    const [probleme] = problemesDe(m)
    expect(probleme?.chemin).toBe('etapes[0].type')
    expect(probleme?.message).toContain('Valeurs possibles : carte, pretest')
  })

  it('refuse un champ inconnu', () => {
    const m = copie()
    m['restitutions'] = []
    expect(problemesDe(m)).toEqual([{ chemin: '', message: 'Champ inconnu : restitutions.' }])
  })

  it('refuse un code de bloc mal formé', () => {
    const m = copie()
    m['bloc'] = 'bloc-1'
    expect(problemesDe(m)).toEqual([
      { chemin: 'bloc', message: 'Le format de ce champ n’est pas valide.' },
    ])
  })

  it('refuse une vérification d’un mode inconnu', () => {
    const m = copie()
    const tache = m.differees.find((d) => d['type'] === 'tache')
    if (tache === undefined) throw new Error('tâche absente')
    tache['verification'] = { mode: 'devine' }
    const [probleme] = problemesDe(m)
    expect(probleme?.chemin).toMatch(/^differees\[\d+\]\.verification\.mode$/)
  })

  it('refuse une liste là où un texte est attendu', () => {
    const m = copie()
    m['titre_court'] = ['a']
    expect(problemesDe(m)).toEqual([
      { chemin: 'titre_court', message: 'Ce champ doit être un texte.' },
    ])
  })

  it('refuse un nombre non entier', () => {
    const m = copie()
    m['pont'] = 1.5
    const [probleme] = problemesDe(m)
    expect(probleme?.chemin).toBe('pont')
    expect(probleme?.message).toBe('Ce champ doit être un nombre entier.')
  })

  it('accepte les champs facultatifs absents', () => {
    const m = copie()
    delete m['atelier']
    delete m['aisance']
    expect(validerManifeste(m).ok).toBe(true)
  })
})

describe('validerManifeste, règles du cadrage (une règle, un test)', () => {
  it('identifiants uniques dans tout le manifeste', () => {
    const m = copie()
    m.rappel[0] = { ...m.rappel[0], id: 'S1' }
    expect(problemesDe(m)).toEqual([
      { chemin: 'rappel[0].id', message: 'L’identifiant « S1 » est déjà utilisé (sources[0].id).' },
    ])
  })

  it('identifiants uniques, y compris entre les items de pratique et le reste', () => {
    const m = copie()
    m.sources[0] = { id: 'PR1-1', titre: 'Support' } as never
    const problemes = problemesDe(m)
    expect(problemes).toHaveLength(1)
    expect(problemes[0]?.message).toContain('« PR1-1 » est déjà utilisé')
  })

  it('restitution : trop peu de questions', () => {
    const m = copie()
    m.restitution.pop()
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'restitution',
        message: 'La restitution doit avoir 5 ou 6 questions (il y en a 4).',
      },
    ])
  })

  it('restitution : trop de questions', () => {
    const m = copie()
    m.restitution.push({ ...m.restitution[0], id: 'R6' }, { ...m.restitution[0], id: 'R7' })
    m.restitution[5] = { ...m.restitution[5], question: 'Une sixième question ?' }
    m.restitution[6] = { ...m.restitution[6], question: 'Une septième question ?' }
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'restitution',
        message: 'La restitution doit avoir 5 ou 6 questions (il y en a 7).',
      },
    ])
  })

  it('restitution : 6 questions sont acceptées', () => {
    const m = copie()
    m.restitution.push({ ...m.restitution[0], id: 'R6', question: 'Une sixième question ?' })
    expect(validerManifeste(m).ok).toBe(true)
  })

  it('consolidation : au moins 3 questions', () => {
    const m = copie()
    m.consolidation.pop()
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'consolidation',
        message: 'La consolidation doit avoir au moins 3 questions (il y en a 2).',
      },
    ])
  })

  it('consolidation : pas le même identifiant qu’une question de restitution', () => {
    const m = copie()
    m.consolidation[0] = { ...m.consolidation[0], id: 'R1' }
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'consolidation[0].id',
        message:
          'La question de consolidation « R1 » reprend l’identifiant d’une question de restitution.',
      },
    ])
  })

  it('consolidation : pas le même texte qu’une question de restitution, casse et espaces ignorés', () => {
    const m = copie()
    const texte = String(m.restitution[1]?.['question'])
    m.consolidation[1] = { ...m.consolidation[1], question: `  ${texte.toUpperCase()}  ` }
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'consolidation[1].question',
        message: 'Cette question de consolidation reprend le texte d’une question de restitution.',
      },
    ])
  })

  it('rappel : au moins 6 questions', () => {
    const m = copie()
    m.rappel.pop()
    expect(problemesDe(m)).toEqual([
      { chemin: 'rappel', message: 'Le rappel doit avoir au moins 6 questions (il y en a 5).' },
    ])
  })

  it('différées : au moins 3 de chaque type', () => {
    const m = copie()
    const index = m.differees.findIndex((d) => d['type'] === 'explication')
    m.differees.splice(index, 2)
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'differees',
        message: 'Il faut au moins 3 questions différées de type « explication » (il y en a 2).',
      },
    ])
  })

  it('différées : une liste vide manque de chaque type et de chaque forme', () => {
    const m = copie()
    m.differees = []
    const problemes = problemesDe(m)
    expect(problemes).toHaveLength(7)
  })

  it('transferts : les 4 formes doivent être couvertes', () => {
    const m = copie()
    const transfert = m.differees.filter((d) => d['type'] === 'transfert')
    transfert[3] = Object.assign(transfert[3] ?? {}, { forme: 'choisir_methode' })
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'differees',
        message: 'Les transferts doivent couvrir les 4 formes : il manque « hors_champ ».',
      },
    ])
  })

  it('une tâche doit avoir une vérification', () => {
    const m = copie()
    const index = m.differees.findIndex((d) => d['type'] === 'tache')
    delete m.differees[index]?.['verification']
    expect(problemesDe(m)).toEqual([
      {
        chemin: `differees[${String(index)}].verification`,
        message: 'Une tâche doit avoir une vérification.',
      },
    ])
  })

  it('un transfert doit avoir une forme', () => {
    const m = copie()
    const transferts = m.differees.filter((d) => d['type'] === 'transfert')
    const extra: Record<string, unknown> = { ...transferts[0], id: 'DR5' }
    delete extra['forme']
    m.differees.push(extra)
    const index = m.differees.length - 1
    expect(problemesDe(m)).toEqual([
      {
        chemin: `differees[${String(index)}].forme`,
        message: 'Un transfert doit avoir une forme.',
      },
    ])
  })

  it('seul un transfert a une forme', () => {
    const m = copie()
    const index = m.differees.findIndex((d) => d['type'] === 'explication')
    Object.assign(m.differees[index] ?? {}, { forme: 'hors_champ' })
    expect(problemesDe(m)).toEqual([
      { chemin: `differees[${String(index)}].forme`, message: 'Seul un transfert a une forme.' },
    ])
  })

  it('une erreur citée doit exister, dans une question', () => {
    const m = copie()
    m.restitution[0] = { ...m.restitution[0], erreurs: ['E9'] }
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'restitution[0].erreurs[0]',
        message: 'L’erreur critique « E9 » n’existe pas dans erreurs_critiques.',
      },
    ])
  })

  it('une erreur citée doit exister, dans une question différée', () => {
    const m = copie()
    m.differees[0] = { ...m.differees[0], erreurs: ['E1', 'E9'] }
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'differees[0].erreurs[1]',
        message: 'L’erreur critique « E9 » n’existe pas dans erreurs_critiques.',
      },
    ])
  })

  it('pratique : la réussite est au moins 1', () => {
    const m = copie()
    m.pratique[0] = { ...m.pratique[0], reussite: 0 } as never
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'pratique[0].reussite',
        message: 'Le seuil de réussite doit être entre 1 et le nombre d’items (3).',
      },
    ])
  })

  it('pratique : la réussite ne dépasse pas le nombre d’items', () => {
    const m = copie()
    m.pratique[0] = { ...m.pratique[0], reussite: 4 } as never
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'pratique[0].reussite',
        message: 'Le seuil de réussite doit être entre 1 et le nombre d’items (3).',
      },
    ])
  })

  it('prérequis : pas le bloc lui-même', () => {
    const m = copie()
    m.prerequis = ['D01']
    expect(problemesDe(m)).toEqual([
      { chemin: 'prerequis', message: 'Le bloc D01 ne peut pas être son propre prérequis.' },
    ])
  })

  it('prérequis : d’autres blocs sont acceptés', () => {
    const m = copie()
    m.prerequis = ['B01', 'B02']
    expect(validerManifeste(m).ok).toBe(true)
  })
})

describe('validerManifeste, tous les problèmes d’un coup', () => {
  it('un manifeste qui viole trois règles rend trois problèmes', () => {
    const m = copie()
    m.restitution.pop()
    m.rappel.pop()
    m.prerequis = ['D01']
    const problemes = problemesDe(m)
    expect(problemes.map((p) => p.chemin).sort()).toEqual(['prerequis', 'rappel', 'restitution'])
  })

  it('plusieurs erreurs de structure sont rendues ensemble', () => {
    const m = copie()
    delete m['titre']
    m['version'] = 0
    expect(
      problemesDe(m)
        .map((p) => p.chemin)
        .sort(),
    ).toEqual(['titre', 'version'])
  })
})
