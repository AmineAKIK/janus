import { TitrePage } from '../gabarit/TitrePage.tsx'

/** Page vide d'un écran pas encore codé : elle affiche seulement son titre. */
export function PageSimple({ titre }: { readonly titre: string }) {
  return <TitrePage>{titre}</TitrePage>
}
