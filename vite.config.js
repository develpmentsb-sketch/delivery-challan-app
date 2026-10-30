import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// If deploying to GitHub Pages under a repo subpath, set VITE_BASE_PATH
// e.g. VITE_BASE_PATH=/delivery-challan-eway-dashboard/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    rollupOptions: {
      output: {
        // Big libraries get their own files: they are cached between deploys and
        // only downloaded by the pages that actually use them.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (/node_modules\/(recharts|d3-[^/]+|victory-vendor|recharts-scale)\//.test(id)) return 'vendor-charts'
          if (id.includes('node_modules/xlsx')) return 'vendor-xlsx'
          return undefined
        }
      }
    }
  },
  server: {
    port: 5173
  }
})
