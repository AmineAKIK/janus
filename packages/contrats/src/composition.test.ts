import { describe, expect, it } from 'vitest'
import { reservesDuType, TypeDeContenu, TypeDuBloc } from './composition.ts'

describe('les réserves exigées selon le type de contenu', () => {
  it('connaît les quatre types de la méthode', () => {
    expect(TypeDeContenu.options).toEqual(['systemes', 'procedures', 'regles_cas', 'conventions'])
  })

  it('systèmes : explication et transfert, sans tâche', () => {
    expect(reservesDuType('systemes')).toEqual({
      parties: ['explication', 'transfert'],
      formes: ['choisir_methode', 'adapter_condition', 'hors_champ'],
    })
  })

  it('procédures : tâche et transfert', () => {
    expect(reservesDuType('procedures')).toEqual({
      parties: ['tache', 'transfert'],
      formes: ['adapter_condition', 'trouver_erreur'],
    })
  })

  it('règles et cas : explication et transfert', () => {
    expect(reservesDuType('regles_cas')).toEqual({
      parties: ['explication', 'transfert'],
      formes: ['adapter_condition', 'trouver_erreur', 'hors_champ'],
    })
  })

  it('conventions : une explication courte, aucun transfert', () => {
    expect(reservesDuType('conventions')).toEqual({ parties: ['explication'], formes: [] })
  })

  it('un bloc qui mêle deux types tire l’union de leurs réserves, dans l’ordre du cadrage', () => {
    expect(reservesDuType(['systemes', 'procedures'])).toEqual({
      parties: ['explication', 'tache', 'transfert'],
      formes: ['choisir_methode', 'adapter_condition', 'trouver_erreur', 'hors_champ'],
    })
    expect(reservesDuType(['conventions', 'regles_cas'])).toEqual(reservesDuType('regles_cas'))
    expect(TypeDuBloc.safeParse(['systemes']).success).toBe(false)
    expect(TypeDuBloc.safeParse('systemes').success).toBe(true)
  })

  it('sans type : la composition complète du cadrage d’origine', () => {
    expect(reservesDuType(undefined)).toEqual({
      parties: ['explication', 'tache', 'transfert'],
      formes: ['choisir_methode', 'adapter_condition', 'trouver_erreur', 'hors_champ'],
    })
  })
})
