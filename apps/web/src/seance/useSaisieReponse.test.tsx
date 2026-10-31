import { TAILLE_MAX_REPONSE } from '@janus/contrats'
import { ZoneDeTexte } from '@janus/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useSaisieReponse } from './useSaisieReponse.ts'

function Essai({ depart }: { readonly depart?: Parameters<typeof useSaisieReponse>[0] }) {
  const { confiance, reponse, colle, vide, champ } = useSaisieReponse(depart ?? null)
  return (
    <>
      <ZoneDeTexte libelle="Ta réponse" {...champ} />
      <p data-testid="etat">
        {JSON.stringify({ confiance, reponse, colle, vide, max: champ.maxLength })}
      </p>
    </>
  )
}

const attendu = (confiance: string | null, reponse: string, colle: boolean, vide: boolean) =>
  JSON.stringify({ confiance, reponse, colle, vide, max: TAILLE_MAX_REPONSE })
const etat = () => screen.getByTestId('etat').textContent

describe('useSaisieReponse', () => {
  it('part vide, sans confiance, avec la taille maximale du contrat', () => {
    render(<Essai />)

    expect(etat()).toBe(attendu(null, '', false, true))
  })

  it('reprend une saisie de départ', () => {
    render(<Essai depart={{ confiance: 'sur', reponse: 'Déjà écrit', colle: true }} />)

    expect(etat()).toBe(attendu('sur', 'Déjà écrit', true, false))
  })

  it('suit la frappe, et une réponse faite d’espaces reste vide', async () => {
    const utilisateur = userEvent.setup()
    render(<Essai />)

    await utilisateur.type(screen.getByLabelText('Ta réponse'), '  ')
    expect(etat()).toBe(attendu(null, '  ', false, true))

    await utilisateur.type(screen.getByLabelText('Ta réponse'), 'ok')
    expect(etat()).toBe(attendu(null, '  ok', false, false))
  })

  it('retient que du texte a été collé', async () => {
    const utilisateur = userEvent.setup()
    render(<Essai />)

    await utilisateur.click(screen.getByLabelText('Ta réponse'))
    await utilisateur.paste('copié')

    expect(etat()).toBe(attendu(null, 'copié', true, false))
  })

  it('oublie le collage quand le champ est vidé puis réécrit à la main', async () => {
    const utilisateur = userEvent.setup()
    render(<Essai />)
    const zone = screen.getByLabelText('Ta réponse')

    await utilisateur.click(zone)
    await utilisateur.paste('copié')
    await utilisateur.clear(zone)
    expect(etat()).toBe(attendu(null, '', false, true))

    await utilisateur.type(zone, 'écrit')
    expect(etat()).toBe(attendu(null, 'écrit', false, false))
  })

  it('garde le collage tant qu’il en reste dans le champ', async () => {
    const utilisateur = userEvent.setup()
    render(<Essai />)
    const zone = screen.getByLabelText('Ta réponse')

    await utilisateur.click(zone)
    await utilisateur.paste('copié')
    await utilisateur.type(zone, ' et complété')

    expect(etat()).toBe(attendu(null, 'copié et complété', true, false))
  })
})
