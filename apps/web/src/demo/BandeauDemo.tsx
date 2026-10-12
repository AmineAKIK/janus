import { BandeauAlerte } from '@janus/ui'
import { IDENTIFIANT_DEMO, MOT_DE_PASSE_DEMO } from './identifiants.ts'

/** Le bandeau de la page de connexion en démo. Chargé à part : le build de production ne l'embarque pas. */
export default function BandeauDemo({ className }: { readonly className?: string | undefined }) {
  return (
    <BandeauAlerte type="info" {...(className === undefined ? {} : { className })}>
      Démo : identifiant « {IDENTIFIANT_DEMO} », mot de passe « {MOT_DE_PASSE_DEMO} ».
    </BandeauAlerte>
  )
}
