import { nomRoute, ROUTES } from '@janus/contrats'
import { Bouton } from '@janus/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useEcriture, useLecture } from '../../api/requetes.tsx'
import { instantReel } from '../../demo/horlogeDemo.ts'
import { texteIntervalle } from '../../revision/textes.ts'
import styles from '../Parametres.module.css'
import { TEXTES_COMPTE as T, texteActivite } from '../textes.ts'

const SESSIONS = [nomRoute(ROUTES['GET /sessions']), {}]

export function Sessions() {
  const client = useQueryClient()
  const lecture = useLecture(ROUTES['GET /sessions'], {})
  const retirer = useEcriture(ROUTES['DELETE /sessions/:id'])
  const maintenant = Date.parse(instantReel())

  return (
    <section aria-label={T.sessions} className={styles['lignes']}>
      <h3 className="texte-petit-14">{T.sessions}</h3>
      <ul className={styles['liste']}>
        {lecture.data?.sessions.map((session) => (
          <li key={session.id} className={styles['session']}>
            <div>
              <p className="texte-petit-14">{session.appareil}</p>
              <p className="texte-legende-12">
                {session.courante
                  ? T.cetteSession
                  : texteActivite(
                      texteIntervalle(maintenant - Date.parse(session.derniere_activite)),
                    )}
              </p>
            </div>
            {!session.courante && (
              <Bouton
                type="button"
                variante="secondaire"
                aria-label={`${T.deconnecter} ${session.appareil}`}
                onClick={() => {
                  retirer.mutate(
                    { params: { id: session.id } },
                    {
                      onSuccess: () => {
                        void client.invalidateQueries({ queryKey: SESSIONS })
                      },
                    },
                  )
                }}
              >
                {T.deconnecter}
              </Bouton>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
