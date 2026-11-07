import { describe, expect, it } from 'vitest'
import { choisirLExecution, depotDepuisLAdresse, texteDesAnnotations } from './evaluerIaCi.ts'

const execution = (id: number, created_at: string) => ({
  id,
  status: 'completed',
  conclusion: 'success',
  created_at,
  html_url: `https://exemple/${String(id)}`,
})

describe('l’exécution déclenchée', () => {
  it('est la plus ancienne créée après l’envoi, à cinq secondes près', () => {
    const depuis = new Date('2026-11-06T14:37:30Z')
    const executions = [
      execution(3, '2026-11-06T14:38:10Z'),
      execution(2, '2026-11-06T14:37:41Z'),
      execution(1, '2026-11-06T13:00:00Z'),
    ]
    expect(choisirLExecution(executions, depuis)?.id).toBe(2)
    expect(choisirLExecution([execution(1, '2026-11-06T13:00:00Z')], depuis)).toBeUndefined()
  })
})

describe('le dépôt', () => {
  it('se lit dans l’adresse du dépôt distant', () => {
    expect(depotDepuisLAdresse('https://github.com/AmineAKIK/janus.git')).toBe('AmineAKIK/janus')
    expect(depotDepuisLAdresse('git@github.com:AmineAKIK/janus.git\n')).toBe('AmineAKIK/janus')
    expect(depotDepuisLAdresse('https://github.com/AmineAKIK/janus')).toBe('AmineAKIK/janus')
    expect(depotDepuisLAdresse('https://exemple.org/x/y')).toBeUndefined()
  })
})

describe('les annotations', () => {
  it('ne gardent que l’évaluation et les messages des cas en désaccord', () => {
    expect(
      texteDesAnnotations([
        { title: 'Évaluation', message: '- Accord : 100 %' },
        { title: null, message: 'ubuntu-latest will migrate' },
        { title: 'Messages des cas en désaccord (1)', message: '### R1' },
      ]),
    ).toBe('Évaluation\n- Accord : 100 %\n\nMessages des cas en désaccord (1)\n### R1')
  })
})
