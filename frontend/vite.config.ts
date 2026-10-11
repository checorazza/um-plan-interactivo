import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo las llamadas salen relativas (`/api/...`) y las reenvía
    // Vite al Flask de al lado. Así el front y la API comparten origen,
    // igual que en Vercel, y el navegador no mete CORS en el medio.
    //
    // Esto importa porque el puerto de Vite no es fijo: si 5173 está ocupado
    // se mueve al 5174 sin avisar, y con llamadas cruzadas ese cambio
    // rompía la app con un error que parecía de red.
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
  test: {
    // El motor de reglas son funciones puras: no necesitan DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
