import { BandeauAlerte, Bouton, CaseACocher, ChampMotDePasse, ChampTexte } from '@janus/ui'
import { getRouteApi } from '@tanstack/react-router'
import { modeTransport } from '../api/client.ts'
import { IDENTIFIANT_DEMO, MOT_DE_PASSE_DEMO } from '../demo/routes/compte.ts'
import styles from './PageConnexion.module.css'
import { TEXTES, texteReessayer, texteTropDEssais } from './textes.ts'
import { useConnexion } from './useConnexion.ts'

const routeConnexion = getRouteApi('/connexion')

/** Ramène le champ actif dans la zone visible quand le clavier du téléphone s'ouvre. */
function ramenerDansLaVue(evenement: { currentTarget: Element }) {
  evenement.currentTarget.scrollIntoView({ block: 'center' })
}

export function PageConnexion() {
  const { retour } = routeConnexion.useSearch()
  const connexion = useConnexion(retour)
  const { phase } = connexion
  const enDemo = modeTransport(import.meta.env.VITE_TRANSPORT) === 'demo'
  const champsBloques = phase === 'chargement'
  const boutonBloque = phase === 'trop_d_essais' || phase === 'hors_connexion'

  return (
    <div className={styles['page']}>
      <section className={styles['carte']}>
        <header className={styles['identite']}>
          <h1 tabIndex={-1} className={`${styles['titre'] ?? ''} texte-titre-28`}>
            {TEXTES.titre}
          </h1>
          <p className={`${styles['sousTitre'] ?? ''} texte-corps-16`}>{TEXTES.sousTitre}</p>
        </header>

        <form className={styles['formulaire']} onSubmit={connexion.soumettre} noValidate>
          <div className={styles['champs']}>
            <ChampTexte
              libelle={TEXTES.identifiant}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={connexion.identifiant}
              disabled={champsBloques}
              onFocus={ramenerDansLaVue}
              onChange={(e) => {
                connexion.changerIdentifiant(e.target.value)
              }}
            />
            <ChampMotDePasse
              ref={connexion.champMotDePasse}
              libelle={TEXTES.motDePasse}
              name="password"
              autoComplete="current-password"
              value={connexion.motDePasse}
              disabled={champsBloques}
              erreur={phase === 'erreur'}
              onFocus={ramenerDansLaVue}
              onChange={(e) => {
                connexion.changerMotDePasse(e.target.value)
              }}
            />
          </div>

          <CaseACocher
            libelle={TEXTES.rester}
            checked={connexion.rester}
            disabled={champsBloques}
            onChange={(e) => {
              connexion.changerRester(e.target.checked)
            }}
          />

          {phase === 'erreur' && <BandeauAlerte type="erreur">{TEXTES.erreur}</BandeauAlerte>}
          {phase === 'trop_d_essais' && (
            <BandeauAlerte type="erreur">
              {texteTropDEssais(connexion.secondesDuBlocage)}
            </BandeauAlerte>
          )}
          {phase === 'hors_connexion' && (
            <BandeauAlerte type="info">{TEXTES.horsConnexion}</BandeauAlerte>
          )}

          <Bouton
            type="submit"
            pleineLargeur
            chargement={phase === 'chargement'}
            disabled={boutonBloque}
          >
            {phase === 'trop_d_essais' ? texteReessayer(connexion.restant) : TEXTES.connecter}
          </Bouton>
        </form>
      </section>

      {enDemo && (
        <BandeauAlerte type="info" className={styles['demo']}>
          Démo : identifiant « {IDENTIFIANT_DEMO} », mot de passe « {MOT_DE_PASSE_DEMO} ».
        </BandeauAlerte>
      )}
    </div>
  )
}
