import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// If deploying to GitHub Pages under a repo subpath, set VITE_BASE_PATH
// e.g. VITE_BASE_PATH=/delivery-challan-eway-dashboard/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 5173
  }
})
