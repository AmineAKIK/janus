import type { SVGProps } from 'react'

/** Spirale de Janus : on boucle, mais jamais au même point, on monte. Prend la couleur du texte courant (`currentColor`). */
export function MarqueJanus({
  taille = 56,
  ...autres
}: { taille?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="40 40 120 110"
      width={taille}
      height={(taille * 110) / 120}
      aria-hidden="true"
      focusable="false"
      {...autres}
    >
      <path
        d="M90 100 A10 10 0 0 1 110 100 A20 20 0 0 1 70 100 A30 30 0 0 1 130 100 A40 40 0 0 1 50 100 A50 50 0 0 1 150 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  )
}
