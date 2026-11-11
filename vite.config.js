import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

function git(...args) {
  try { return execFileSync('git', args, { encoding: 'utf8' }).trim() }
  catch { return null }
}

// Readable provenance for Pages without adding work to the visitor's frame loop.
// Asset hashes also detect an older deployment overwriting this branch's build.
function buildInfo() {
  return {
    name: 'build-info',
    apply: 'build',
    generateBundle: { order: 'post', handler(_, bundle) {
      const assets = Object.fromEntries(Object.entries(bundle).map(([name, file]) => [
        name, createHash('sha256').update(file.type === 'chunk' ? file.code : file.source).digest('hex'),
      ]))
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({
        revision: process.env.GITHUB_SHA || git('rev-parse', 'HEAD'),
        branch: process.env.GITHUB_REF_NAME || git('branch', '--show-current'),
        dirty: !!git('status', '--porcelain', '--untracked-files=no'),
        builtAt: new Date().toISOString(),
        assets,
      }, null, 2) + '\n' })
    } },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    buildInfo(),
  ],
  // Ensures GitHub Pages finds files correctly
  base: '/', 
})
