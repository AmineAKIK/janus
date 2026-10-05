import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, expect } from 'vitest'
import * as matchersAxe from 'vitest-axe/matchers'

expect.extend(matchersAxe)

afterEach(() => {
  cleanup()
})
