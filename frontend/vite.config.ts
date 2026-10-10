import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // El motor de reglas son funciones puras: no necesitan DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
