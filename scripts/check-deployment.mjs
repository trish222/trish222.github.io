import { request } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const origin = process.argv[2] || 'https://trish222.github.io/';
const context = await request.newContext();
try {
  const html = await context.get(origin);
  const text = await html.text();
  const entries = [...text.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(m => m[1]);
  const assets = [];
  for (const url of entries) {
    const response = await context.get(new URL(url, origin).href);
    const bytes = await response.body();
    let matchesLocal = false;
    try { matchesLocal = bytes.equals(await readFile(`dist${url}`)); } catch { /* older asset */ }
    assets.push({ url, status: response.status(), sha256: createHash('sha256').update(bytes).digest('hex'), matchesLocal });
  }
  const metadata = await context.get(new URL('build-info.json', origin).href);
  const runs = await context.get('https://api.github.com/repos/trish222/trish222.github.io/actions/workflows/deploy.yml/runs?per_page=5');
  const deployments = await context.get('https://api.github.com/repos/trish222/trish222.github.io/deployments?environment=github-pages&per_page=5');
  console.log(JSON.stringify({ origin, localRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    headers: html.headers(), assets,
    buildInfo: metadata.ok() ? await metadata.json() : { status: metadata.status(), note: 'Not present in the current deployment' },
    workflowRuns: runs.ok() ? (await runs.json()).workflow_runs.map(r => ({ sha: r.head_sha, branch: r.head_branch, status: r.status, conclusion: r.conclusion, updated: r.updated_at, url: r.html_url })) : { status: runs.status() },
    deployments: deployments.ok() ? (await deployments.json()).map(d => ({ sha: d.sha, ref: d.ref, created: d.created_at, environment: d.environment })) : { status: deployments.status() },
  }, null, 2));
} finally { await context.dispose(); }
