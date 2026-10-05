import { ErreurApi, ErreurReseau, ROUTES } from '@janus/contrats'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useEcriture } from '../api/requetes.tsx'
import { CLE_MOI } from '../routes/garde.ts'

export type Phase = 'repos' | 'chargement' | 'erreur' | 'trop_d_essais' | 'hors_connexion'

/** Ce que l'écran sait de la dernière tentative. */
type Echec =
  | { readonly type: 'identifiants' }
  | { readonly type: 'trop_d_essais'; readonly secondes: number }
  | { readonly type: 'reseau' }

const enLigne = () => navigator.onLine

/**
 * L'état de l'écran de connexion : la saisie, la tentative en cours et son issue. Un mauvais couple
 * donne toujours le même message ; trop d'échecs bloquent le bouton le temps du compte à rebours ; sans
 * réseau on garde la saisie et on réessaie tout seul au retour du réseau.
 */
export function useConnexion(retour: string | undefined) {
  const routeur = useRouter()
  const client = useQueryClient()
  const ecriture = useEcriture(ROUTES['POST /session'])
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [rester, setRester] = useState(false)
  const [echec, setEchec] = useState<Echec | null>(null)
  const [restant, setRestant] = useState(0)
  const [horsLigne, setHorsLigne] = useState(!enLigne())
  const champMotDePasse = useRef<HTMLInputElement>(null)

  const envoyer = useCallback(
    (nom: string, mot: string) => {
      if (nom.trim() === '' || mot === '') {
        setEchec({ type: 'identifiants' })
        setMotDePasse('')
        champMotDePasse.current?.focus()
        return
      }
      setEchec(null)
      ecriture.mutate(
        { corps: { nom_utilisateur: nom.trim(), mot_de_passe: mot } },
        {
          onSuccess: (moi) => {
            client.setQueryData(CLE_MOI, moi)
            routeur.history.push(retour ?? '/')
          },
          onError: (erreur) => {
            if (erreur instanceof ErreurApi && erreur.status === 429) {
              const secondes = erreur.retryAfter ?? 60
              setEchec({ type: 'trop_d_essais', secondes })
              setRestant(secondes)
            } else if (erreur instanceof ErreurApi && erreur.status === 401) {
              setEchec({ type: 'identifiants' })
              setMotDePasse('')
              champMotDePasse.current?.focus()
            } else if (erreur instanceof ErreurReseau) {
              setEchec({ type: 'reseau' })
              setHorsLigne(true)
            } else {
              throw erreur
            }
          },
        },
      )
    },
    [client, ecriture, retour, routeur],
  )

  // Le compte à rebours de « Trop d’essais ».
  const compteARebours = restant > 0
  useEffect(() => {
    if (!compteARebours) return
    const minuteur = setInterval(() => {
      setRestant((valeur) => Math.max(0, valeur - 1))
    }, 1000)
    return () => {
      clearInterval(minuteur)
    }
  }, [compteARebours])

  // Le réseau : bandeau tant qu'il manque, nouvel essai automatique à son retour.
  const aReessayer = useRef(false)
  aReessayer.current = echec?.type === 'reseau'
  const reessayer = useRef<() => void>(() => undefined)
  reessayer.current = () => {
    envoyer(identifiant, motDePasse)
  }
  useEffect(() => {
    const perdu = () => {
      setHorsLigne(true)
    }
    const retrouve = () => {
      setHorsLigne(false)
      if (aReessayer.current) reessayer.current()
    }
    window.addEventListener('offline', perdu)
    window.addEventListener('online', retrouve)
    return () => {
      window.removeEventListener('offline', perdu)
      window.removeEventListener('online', retrouve)
    }
  }, [])

  const bloque = echec?.type === 'trop_d_essais' && restant > 0
  let phase: Phase = 'repos'
  if (ecriture.isPending) phase = 'chargement'
  else if (horsLigne) phase = 'hors_connexion'
  else if (bloque) phase = 'trop_d_essais'
  else if (echec?.type === 'identifiants') phase = 'erreur'

  return {
    phase,
    identifiant,
    motDePasse,
    rester,
    restant,
    secondesDuBlocage: echec?.type === 'trop_d_essais' ? echec.secondes : 0,
    champMotDePasse,
    changerIdentifiant: setIdentifiant,
    changerMotDePasse: setMotDePasse,
    changerRester: setRester,
    soumettre: (evenement: SyntheticEvent) => {
      evenement.preventDefault()
      if (phase === 'chargement' || phase === 'trop_d_essais' || phase === 'hors_connexion') return
      envoyer(identifiant, motDePasse)
    },
  }
}
