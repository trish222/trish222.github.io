// Emits dist/third-party-licenses.txt: the full license text of every library in the Credits window's
// "Code libraries" list. Minification keeps only some banners (meshoptimizer's and 98.css's are dropped), and
// MIT, Zlib and Apache-2.0 ask for the notice to travel with the code.
import { readFileSync } from 'node:fs';
import { CREDITS } from '../src/content/credits.js';

const NOTICES = {
  'three.js': 'node_modules/three/LICENSE',
  postprocessing: 'node_modules/postprocessing/LICENSE.md',
  GSAP: null, // no license file in the package; its header comment is kept in the bundle
  meshoptimizer: 'node_modules/meshoptimizer/LICENSE.md',
  'Basis Universal': 'public/basis/LICENSE.txt',
  '98.css': 'node_modules/98.css/LICENSE',
  'Tailwind CSS': 'node_modules/tailwindcss/LICENSE',
  Vite: 'node_modules/vite/LICENSE.md',
};

function notice({ title, author, license, href }) {
  if (!(title in NOTICES)) throw new Error(`third-party-licenses: no notice file for ${title}`);
  const file = NOTICES[title];
  // Vite's file appends the licenses of its own dev-time dependencies; only its core license ships.
  const text = file ? readFileSync(file, 'utf8').split('# Licenses of bundled dependencies')[0].trim()
    : `Copyright 2008-2026, GreenSock. All rights reserved.\nSubject to the terms at ${href.replace(/\/$/, '')}/standard-license`;
  return `${'='.repeat(72)}\n${title} (${license}) by ${author}\n${href}\n${'='.repeat(72)}\n\n${text}\n`;
}

export function thirdPartyLicenses() {
  return {
    name: 'third-party-licenses',
    apply: 'build',
    generateBundle() {
      const source = `Third-party code shipped with this site, and its licenses.\n\n${CREDITS.libraries.map(notice).join('\n')}`;
      this.emitFile({ type: 'asset', fileName: 'third-party-licenses.txt', source });
    },
  };
}
