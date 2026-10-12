import { describe, expect, it, vi } from 'vitest'
import { creerInstallation } from './installation.ts'

function fausseFenetre(
  options: { standalone?: boolean; userAgent?: string; toucher?: number } = {},
) {
  const ecouteurs = new Map<string, Set<(evenement: Event) => void>>()
  const fenetre = {
    navigator: {
      userAgent: options.userAgent ?? 'Mozilla/5.0 (X11; Linux)',
      maxTouchPoints: options.toucher ?? 0,
    },
    matchMedia: (requete: string) => ({
      matches: options.standalone === true && requete.includes('standalone'),
    }),
    addEventListener: (nom: string, ecouteur: (evenement: Event) => void) => {
      ecouteurs.set(nom, (ecouteurs.get(nom) ?? new Set()).add(ecouteur))
    },
    removeEventListener: (nom: string, ecouteur: (evenement: Event) => void) => {
      ecouteurs.get(nom)?.delete(ecouteur)
    },
  }
  const emettre = (nom: string, evenement: Event) => {
    ecouteurs.get(nom)?.forEach((ecouteur) => {
      ecouteur(evenement)
    })
  }
  // `Window` complet n'est pas utile aux tests : seul ce que l'installation lit est simulé.
  return { fenetre: fenetre as unknown as Window, emettre }
}

function invitation(accepte: boolean) {
  const evenement = new Event('beforeinstallprompt', { cancelable: true })
  const prompt = vi.fn(() => Promise.resolve())
  Object.assign(evenement, {
    prompt,
    userChoice: Promise.resolve({ outcome: accepte ? 'accepted' : 'dismissed' }),
  })
  return { evenement, prompt }
}

describe('installation', () => {
  it('n’a rien à proposer tant que le navigateur n’a pas invité', () => {
    const { fenetre } = fausseFenetre()
    expect(creerInstallation(fenetre).etat()).toBe('indisponible')
  })

  it('garde l’invitation du navigateur et la propose d’un geste', async () => {
    const { fenetre, emettre } = fausseFenetre()
    const installation = creerInstallation(fenetre)
    const abonne = vi.fn()
    installation.abonner(abonne)
    installation.demarrer()

    const { evenement, prompt } = invitation(true)
    emettre('beforeinstallprompt', evenement)
    expect(evenement.defaultPrevented).toBe(true)
    expect(installation.etat()).toBe('installable')
    expect(abonne).toHaveBeenCalled()

    await expect(installation.installer()).resolves.toBe(true)
    expect(prompt).toHaveBeenCalledOnce()
    expect(installation.etat()).toBe('indisponible')
  })

  it('rend faux quand l’utilisateur refuse, ou quand il n’y a pas d’invitation', async () => {
    const { fenetre, emettre } = fausseFenetre()
    const installation = creerInstallation(fenetre)
    installation.demarrer()
    await expect(installation.installer()).resolves.toBe(false)

    emettre('beforeinstallprompt', invitation(false).evenement)
    await expect(installation.installer()).resolves.toBe(false)
  })

  it('devient installée à l’événement appinstalled', () => {
    const { fenetre, emettre } = fausseFenetre()
    const installation = creerInstallation(fenetre)
    installation.demarrer()
    emettre('beforeinstallprompt', invitation(true).evenement)

    emettre('appinstalled', new Event('appinstalled'))
    expect(installation.etat()).toBe('installee')
  })

  it('se sait installée quand elle s’ouvre en fenêtre autonome', () => {
    const { fenetre } = fausseFenetre({ standalone: true })
    expect(creerInstallation(fenetre).etat()).toBe('installee')
  })

  it('indique la marche à suivre sur iPhone et iPad, sans invitation possible', () => {
    const iphone = fausseFenetre({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' })
    expect(creerInstallation(iphone.fenetre).etat()).toBe('manuelle')
    const ipad = fausseFenetre({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', toucher: 5 })
    expect(creerInstallation(ipad.fenetre).etat()).toBe('manuelle')
    const mac = fausseFenetre({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' })
    expect(creerInstallation(mac.fenetre).etat()).toBe('indisponible')
  })

  it('arrête d’écouter', () => {
    const { fenetre, emettre } = fausseFenetre()
    const installation = creerInstallation(fenetre)
    const arreter = installation.demarrer()
    arreter()
    emettre('beforeinstallprompt', invitation(true).evenement)
    expect(installation.etat()).toBe('indisponible')
  })
})
