import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Writes /version.json with the commit this build came from. Cloudflare Pages sets
 * CF_PAGES_COMMIT_SHA; the deploy pipeline polls this file to know the new site is live.
 */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ commit: process.env.CF_PAGES_COMMIT_SHA || 'local', builtAt: new Date().toISOString() }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionFile()],
})
