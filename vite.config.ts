import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      external: [
        'path',
        'fs',
        'crypto',
        'stream',
        'util',
        'zlib',
        'events',
        './dist/cpexcel.js'
      ]
    }
  },
  optimizeDeps: {
    include: ['recharts', 'xlsx']
  }
})
