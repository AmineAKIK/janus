import { configureAxe } from 'vitest-axe'

// jsdom ne dessine rien : le contraste (AA) ne peut pas être mesuré ici, il vient des tokens.
export const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } })
