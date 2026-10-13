import { fireEvent, render, screen } from '@testing-library/react'
import type { FocusEvent } from 'react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fermerSiFocusSort } from './surface.tsx'

function Banc({ fermer }: { readonly fermer: () => void }) {
  const ancre = createRef<HTMLButtonElement>()
  const surface = createRef<HTMLDivElement>()
  return (
    <>
      <button ref={ancre}>ancre</button>
      <div
        ref={surface}
        onBlur={(evenement: FocusEvent<HTMLDivElement>) => {
          fermerSiFocusSort(evenement, [surface, ancre], fermer)
        }}
      >
        <button>dedans</button>
        <button>dedans bis</button>
      </div>
      <button>dehors</button>
    </>
  )
}

describe('fermerSiFocusSort', () => {
  it('ne ferme pas quand le focus reste dans la surface', () => {
    const fermer = vi.fn()
    render(<Banc fermer={fermer} />)
    fireEvent.blur(screen.getByText('dedans'), { relatedTarget: screen.getByText('dedans bis') })
    expect(fermer).not.toHaveBeenCalled()
  })

  it('ne ferme pas quand le focus passe à l’ancre', () => {
    const fermer = vi.fn()
    render(<Banc fermer={fermer} />)
    fireEvent.blur(screen.getByText('dedans'), { relatedTarget: screen.getByText('ancre') })
    expect(fermer).not.toHaveBeenCalled()
  })

  it('ne ferme pas quand le focus ne va nulle part', () => {
    const fermer = vi.fn()
    render(<Banc fermer={fermer} />)
    fireEvent.blur(screen.getByText('dedans'), { relatedTarget: null })
    expect(fermer).not.toHaveBeenCalled()
  })

  it('ferme quand le focus part ailleurs', () => {
    const fermer = vi.fn()
    render(<Banc fermer={fermer} />)
    fireEvent.blur(screen.getByText('dedans'), { relatedTarget: screen.getByText('dehors') })
    expect(fermer).toHaveBeenCalledTimes(1)
  })
})
