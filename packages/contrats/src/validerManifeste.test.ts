import { describe, expect, it } from 'vitest'
import demo from '../fixtures/manifeste-demo.json' with { type: 'json' }
import { validerManifeste, type Probleme } from './validerManifeste.ts'

type Valeur = string | number | boolean | null | undefined | Valeur[] | { [cle: string]: Valeur }
type Brouillon = { [cle: string]: Valeur }

function estBrouillon(valeur: unknown): valeur is Brouillon {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

/** Copie modifiable du manifeste de démonstration. */
function copie(): Brouillon {
  return structuredClone(demo)
}

/** Une liste d'objets du brouillon, modifiable en place. */
function liste(brouillon: Brouillon, cle: string): Brouillon[] {
  const valeur = brouillon[cle]
  if (!Array.isArray(valeur) || !valeur.every(estBrouillon)) {
    throw new Error(`« ${cle} » n’est pas une liste d’objets.`)
  }
  return valeur
}

/** Le premier élément d'une liste du brouillon, qui doit exister. */
function premier(brouillon: Brouillon, cle: string): Brouillon {
  const element = liste(brouillon, cle)[0]
  if (element === undefined) throw new Error(`« ${cle} » est vide.`)
  return element
}

/** Le premier élément d'une liste dont le champ `type` vaut `type`, avec sa position. */
function parType(brouillon: Brouillon, type: string): { index: number; element: Brouillon } {
  const differees = liste(brouillon, 'differees')
  const index = differees.findIndex((d) => d['type'] === type)
  const element = differees[index]
  if (element === undefined) throw new Error(`Aucune différée de type ${type}.`)
  return { index, element }
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
    Object.assign(premier(m, 'etapes'), { type: 'inconnu' })
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
    parType(m, 'tache').element['verification'] = { mode: 'devine' }
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
    Object.assign(premier(m, 'rappel'), { id: 'S1' })
    expect(problemesDe(m)).toEqual([
      { chemin: 'rappel[0].id', message: 'L’identifiant « S1 » est déjà utilisé (sources[0].id).' },
    ])
  })

  it('identifiants uniques, y compris entre les items de pratique et le reste', () => {
    const m = copie()
    Object.assign(premier(m, 'sources'), { id: 'PR1-1' })
    const problemes = problemesDe(m)
    expect(problemes).toHaveLength(1)
    expect(problemes[0]?.message).toContain('« PR1-1 » est déjà utilisé')
  })

  it('restitution : trop peu de questions', () => {
    const m = copie()
    liste(m, 'restitution').pop()
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'restitution',
        message: 'La restitution doit avoir 5 ou 6 questions (il y en a 4).',
      },
    ])
  })

  it('restitution : trop de questions', () => {
    const m = copie()
    liste(m, 'restitution').push(
      { ...premier(m, 'restitution'), id: 'R6', question: 'Une sixième question ?' },
      { ...premier(m, 'restitution'), id: 'R7', question: 'Une septième question ?' },
    )
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'restitution',
        message: 'La restitution doit avoir 5 ou 6 questions (il y en a 7).',
      },
    ])
  })

  it('restitution : 6 questions sont acceptées', () => {
    const m = copie()
    liste(m, 'restitution').push({
      ...premier(m, 'restitution'),
      id: 'R6',
      question: 'Une sixième question ?',
    })
    expect(validerManifeste(m).ok).toBe(true)
  })

  it('consolidation : au moins 3 questions', () => {
    const m = copie()
    liste(m, 'consolidation').pop()
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'consolidation',
        message: 'La consolidation doit avoir au moins 3 questions (il y en a 2).',
      },
    ])
  })

  it('consolidation : pas le même identifiant qu’une question de restitution', () => {
    const m = copie()
    Object.assign(premier(m, 'consolidation'), { id: 'R1' })
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
    const texte = demo.restitution[1]?.question ?? ''
    Object.assign(liste(m, 'consolidation')[1] ?? {}, { question: `  ${texte.toUpperCase()}  ` })
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'consolidation[1].question',
        message: 'Cette question de consolidation reprend le texte d’une question de restitution.',
      },
    ])
  })

  it('rappel : au moins 6 questions', () => {
    const m = copie()
    liste(m, 'rappel').pop()
    expect(problemesDe(m)).toEqual([
      { chemin: 'rappel', message: 'Le rappel doit avoir au moins 6 questions (il y en a 5).' },
    ])
  })

  it('différées : au moins 3 de chaque type', () => {
    const m = copie()
    const { index } = parType(m, 'explication')
    liste(m, 'differees').splice(index, 2)
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'differees',
        message: 'Il faut au moins 3 questions différées de type « explication » (il y en a 2).',
      },
    ])
  })

  it('différées : une liste vide manque de chaque type et de chaque forme', () => {
    const m = copie()
    m['differees'] = []
    const problemes = problemesDe(m)
    expect(problemes).toHaveLength(7)
  })

  it('transferts : les 4 formes doivent être couvertes', () => {
    const m = copie()
    const transferts = liste(m, 'differees').filter((d) => d['type'] === 'transfert')
    Object.assign(transferts[3] ?? {}, { forme: 'choisir_methode' })
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'differees',
        message: 'Les transferts doivent couvrir les 4 formes : il manque « hors_champ ».',
      },
    ])
  })

  it('une tâche doit avoir une vérification', () => {
    const m = copie()
    const { index, element } = parType(m, 'tache')
    Reflect.deleteProperty(element, 'verification')
    expect(problemesDe(m)).toEqual([
      {
        chemin: `differees[${String(index)}].verification`,
        message: 'Une tâche doit avoir une vérification.',
      },
    ])
  })

  it('un transfert doit avoir une forme', () => {
    const m = copie()
    const extra = { ...parType(m, 'transfert').element, id: 'DR5' }
    Reflect.deleteProperty(extra, 'forme')
    const differees = liste(m, 'differees')
    differees.push(extra)
    const index = differees.length - 1
    expect(problemesDe(m)).toEqual([
      {
        chemin: `differees[${String(index)}].forme`,
        message: 'Un transfert doit avoir une forme.',
      },
    ])
  })

  it('seul un transfert a une forme', () => {
    const m = copie()
    const { index, element } = parType(m, 'explication')
    Object.assign(element, { forme: 'hors_champ' })
    expect(problemesDe(m)).toEqual([
      { chemin: `differees[${String(index)}].forme`, message: 'Seul un transfert a une forme.' },
    ])
  })

  it('une erreur citée doit exister, dans une question', () => {
    const m = copie()
    Object.assign(premier(m, 'restitution'), { erreurs: ['E9'] })
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'restitution[0].erreurs[0]',
        message: 'L’erreur critique « E9 » n’existe pas dans erreurs_critiques.',
      },
    ])
  })

  it('une erreur citée doit exister, dans une question différée', () => {
    const m = copie()
    Object.assign(premier(m, 'differees'), { erreurs: ['E1', 'E9'] })
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'differees[0].erreurs[1]',
        message: 'L’erreur critique « E9 » n’existe pas dans erreurs_critiques.',
      },
    ])
  })

  it('seule une tâche a une vérification', () => {
    const m = copie()
    const { index, element } = parType(m, 'explication')
    Object.assign(element, { verification: { mode: 'exacte', reponses: ['oui'] } })
    expect(problemesDe(m)).toEqual([
      {
        chemin: `differees[${String(index)}].verification`,
        message: 'Seule une tâche a une vérification.',
      },
    ])
  })

  it('une étape citée par une erreur critique doit exister', () => {
    const m = copie()
    Object.assign(liste(m, 'erreurs_critiques')[2] ?? {}, { etape: 'ET99' })
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'erreurs_critiques[2].etape',
        message: 'L’étape « ET99 » n’existe pas dans etapes.',
      },
    ])
  })

  it('pratique : la réussite est au moins 1', () => {
    const m = copie()
    Object.assign(premier(m, 'pratique'), { reussite: 0 })
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'pratique[0].reussite',
        message: 'Le seuil de réussite doit être entre 1 et le nombre d’items (3).',
      },
    ])
  })

  it('pratique : la réussite ne dépasse pas le nombre d’items', () => {
    const m = copie()
    Object.assign(premier(m, 'pratique'), { reussite: 4 })
    expect(problemesDe(m)).toEqual([
      {
        chemin: 'pratique[0].reussite',
        message: 'Le seuil de réussite doit être entre 1 et le nombre d’items (3).',
      },
    ])
  })

  it('prérequis : pas le bloc lui-même', () => {
    const m = copie()
    m['prerequis'] = ['D01']
    expect(problemesDe(m)).toEqual([
      { chemin: 'prerequis', message: 'Le bloc D01 ne peut pas être son propre prérequis.' },
    ])
  })

  it('prérequis : d’autres blocs sont acceptés', () => {
    const m = copie()
    m['prerequis'] = ['B01', 'B02']
    expect(validerManifeste(m).ok).toBe(true)
  })
})

describe('validerManifeste, tous les problèmes d’un coup', () => {
  it('un manifeste qui viole trois règles rend trois problèmes', () => {
    const m = copie()
    liste(m, 'restitution').pop()
    liste(m, 'rappel').pop()
    m['prerequis'] = ['D01']
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
