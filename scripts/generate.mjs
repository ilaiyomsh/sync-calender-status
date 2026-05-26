#!/usr/bin/env node
// Hub orchestrator. Discovers every app in `apps/<slug>/config.mjs`, runs
// queries against Axiom, writes a dashboard to `<slug>/index.html`, then
// renders a landing page at `index.html` listing all apps.
//
// Run locally:   AXIOM_TOKEN=xaat-... node scripts/generate.mjs

import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runQueries } from './queries.mjs';
import renderDashboard from './template.mjs';
import renderLanding from './index-template.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const APPS_DIR = resolve(ROOT, 'apps');

const TOKEN = process.env.AXIOM_TOKEN;
if (!TOKEN) {
  console.error('AXIOM_TOKEN env var is required');
  process.exit(1);
}

// Discover apps.
const apps = [];
if (existsSync(APPS_DIR)) {
  for (const slug of readdirSync(APPS_DIR)) {
    const dir = resolve(APPS_DIR, slug);
    if (!statSync(dir).isDirectory()) continue;
    const configPath = resolve(dir, 'config.mjs');
    if (!existsSync(configPath)) continue;
    const mod = await import(pathToFileURL(configPath));
    const config = { slug, ...mod.default };
    if (!config.dataset) {
      console.warn(`! ${slug}: config has no \`dataset\` — skipping`);
      continue;
    }
    apps.push(config);
  }
}

if (apps.length === 0) {
  console.error(`No apps found under ${APPS_DIR}/`);
  process.exit(1);
}

console.log(`Found ${apps.length} app(s): ${apps.map(a => a.slug).join(', ')}\n`);

// Generate each app dashboard.
const results = [];
for (const app of apps) {
  process.stdout.write(`→ ${app.name || app.slug} (${app.dataset}) … `);
  try {
    // Allow per-app override of queries via `queriesPath` in config.
    let queryRunner = runQueries;
    if (app.queriesPath) {
      const customPath = resolve(APPS_DIR, app.slug, app.queriesPath);
      const customMod = await import(pathToFileURL(customPath));
      queryRunner = customMod.runQueries;
    }
    const data = await queryRunner(app, TOKEN);
    const html = renderDashboard(app, data);
    const outDir = resolve(ROOT, app.slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'index.html'), html);
    console.log(`✓ (${(html.length / 1024).toFixed(1)} KB)`);
    results.push({ app, data, ok: true });
  } catch (err) {
    console.log(`✗ ${err.message}`);
    results.push({ app, ok: false, error: err.message });
  }
}

// Landing page lists all apps with links + last-run health.
const landing = renderLanding(results);
writeFileSync(resolve(ROOT, 'index.html'), landing);
console.log(`\n✓ Root landing page (${(landing.length / 1024).toFixed(1)} KB)`);

const failed = results.filter(r => !r.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length}/${results.length} apps failed.`);
  process.exit(1);
}
