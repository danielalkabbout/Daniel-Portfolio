import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

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

/**
 * Search engines and link previews: fills %SITE_URL% in index.html (absolute URLs are required for
 * og:image), and writes robots.txt and a sitemap that lists every visible project.
 */
function seo(siteUrl: string): Plugin {
  return {
    name: 'seo',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    generateBundle() {
      let projects: string[] = []
      try {
        const content = JSON.parse(readFileSync(new URL('./src/content/fallback.json', import.meta.url), 'utf8'))
        projects = content.projects.filter((p: { visible?: boolean }) => p.visible !== false).map((p: { id: string }) => `/projects/${p.id}`)
      } catch {
        /* no snapshot: list the main pages only */
      }
      const today = new Date().toISOString().slice(0, 10)
      const urls = ['/', '/about', '/experience', '/projects', '/services', '/cv', ...projects]
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls.map((u) => `  <url><loc>${siteUrl}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
          '\n</urlset>\n',
      })
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const api = (env.VITE_API_URL || '').replace(/\/$/, '')
  // The site always calls its own /api. Locally Vite forwards it to the API; on Cloudflare a Pages Function does.
  const proxy = api ? { '/api': { target: api, changeOrigin: true } } : undefined
  const siteUrl = (env.VITE_SITE_URL || 'https://danielalkabbout.pages.dev').replace(/\/$/, '')
  return {
    plugins: [react(), versionFile(), seo(siteUrl)],
    server: { proxy },
    preview: { proxy },
    build: {
      rolldownOptions: {
        output: {
          // Libraries change rarely, so they get their own files: a site update doesn't make
          // returning visitors download React again.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/, priority: 2 },
              { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
            ],
          },
        },
      },
    },
  }
})
