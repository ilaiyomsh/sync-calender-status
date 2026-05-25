#!/usr/bin/env node
// Generates index.html with fresh Axiom data.
// Run locally:   AXIOM_TOKEN=xaat-... node scripts/generate.mjs
// In CI:         secrets.AXIOM_TOKEN

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '..');
const OUT_FILE = resolve(OUT_DIR, 'index.html');

const TOKEN = process.env.AXIOM_TOKEN;
const ORG = process.env.AXIOM_ORG_ID || 'twyst-jffk';
const DATASET = process.env.AXIOM_DATASET || 'calendar-sync';

if (!TOKEN) {
  console.error('AXIOM_TOKEN env var is required');
  process.exit(1);
}

async function apl(query) {
  const res = await fetch('https://api.axiom.co/v1/datasets/_apl?format=tabular', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-Axiom-Org-Id': ORG,
    },
    body: JSON.stringify({ apl: query }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Axiom ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = await res.json();
  const t = json.tables?.[0];
  if (!t) return [];
  const fields = t.fields.map(f => f.name);
  const cols = t.columns || [];
  const nrows = cols[0]?.length || 0;
  const rows = [];
  for (let i = 0; i < nrows; i++) {
    const row = {};
    fields.forEach((f, j) => { row[f] = cols[j][i]; });
    rows.push(row);
  }
  return rows;
}

// ---------- queries ----------
const q = (s) => s.replaceAll('DATASET', `['${DATASET}']`);

const Q = {
  // sync_done outcomes per provider
  sync24h: q(`DATASET | where _time > ago(24h) and message == 'sync_done'
    | summarize syncs=count(), created=sum(created), updated=sum(updated), deleted=sum(deleted), skipped=sum(skipped) by prv`),
  sync7d: q(`DATASET | where _time > ago(7d) and message == 'sync_done'
    | summarize syncs=count(), created=sum(created), updated=sum(updated), deleted=sum(deleted), skipped=sum(skipped) by prv`),

  // webhooks hourly (24h) and daily (7d)
  hooks24h: q(`DATASET | where _time > ago(24h) and message == 'webhook_received'
    | summarize n=count() by bin(_time, 1h), prv | order by _time asc`),
  hooks7d: q(`DATASET | where _time > ago(7d) and message == 'webhook_received'
    | summarize n=count() by bin(_time, 1d), prv | order by _time asc`),

  // counters
  counters: q(`DATASET | where _time > ago(7d) | summarize
    subs_renewed_24h = countif(message=='subscription_renewed' and _time > ago(24h)),
    subs_renewed_7d  = countif(message=='subscription_renewed'),
    token_fail_24h   = countif(message=='token refresh failed' and _time > ago(24h)),
    token_fail_7d    = countif(message=='token refresh failed'),
    policy_24h       = countif(message=='policy_updated' and _time > ago(24h)),
    policy_7d        = countif(message=='policy_updated'),
    cond_24h         = countif(message=='conditionals_updated' and _time > ago(24h)),
    cond_7d          = countif(message=='conditionals_updated'),
    cfg_other_24h    = countif(tag=='configs' and message != 'conditionals_updated' and _time > ago(24h)),
    cfg_other_7d    = countif(tag=='configs' and message != 'conditionals_updated'),
    install_24h      = countif(message=='installed' and _time > ago(24h)),
    install_7d       = countif(message=='installed'),
    oauth_24h        = countif(message=='connected' and _time > ago(24h)),
    oauth_7d         = countif(message=='connected'),
    err_24h          = countif(level=='error' and _time > ago(24h)),
    err_7d           = countif(level=='error'),
    warn_24h         = countif(level=='warn' and _time > ago(24h)),
    warn_7d          = countif(level=='warn')`),

  // oauth connects
  oauth: q(`DATASET | where _time > ago(7d) and message == 'connected'
    | project _time, prv, usr | order by _time desc | take 20`),

  // errors by cause
  errors: q(`DATASET | where _time > ago(7d) and (level=='error' or level=='warn')
    | summarize n=count() by level, tag, message, cause, reason | top 15 by n`),

  // per-account
  byAcc: q(`DATASET | where _time > ago(7d) and isnotnull(acc)
    | summarize n=count(), users=dcount(usr), objects=dcount(obj), configs=dcount(cfg) by acc`),

  // per-object
  byObj: q(`DATASET | where _time > ago(7d) and isnotnull(obj)
    | summarize n=count(), users=dcount(usr), configs=dcount(cfg) by obj | top 10 by n`),
};

console.log('Running queries…');
const r = Object.fromEntries(await Promise.all(
  Object.entries(Q).map(async ([k, v]) => [k, await apl(v)])
));
console.log('Queries done.');

// ---------- shape data ----------
const counters = r.counters[0] || {};
const num = (x) => Number(x || 0);

function syncTotals(rows) {
  const out = { syncs:0, created:0, updated:0, deleted:0, skipped:0, google:{syncs:0,created:0,updated:0,deleted:0,skipped:0}, microsoft:{syncs:0,created:0,updated:0,deleted:0,skipped:0} };
  for (const row of rows) {
    const p = row.prv === 'google' ? 'google' : row.prv === 'microsoft' ? 'microsoft' : null;
    out.syncs    += num(row.syncs);
    out.created  += num(row.created);
    out.updated  += num(row.updated);
    out.deleted  += num(row.deleted);
    out.skipped  += num(row.skipped);
    if (p) {
      out[p].syncs   = num(row.syncs);
      out[p].created = num(row.created);
      out[p].updated = num(row.updated);
      out[p].deleted = num(row.deleted);
      out[p].skipped = num(row.skipped);
    }
  }
  return out;
}

const s24 = syncTotals(r.sync24h);
const s7d = syncTotals(r.sync7d);

// hourly buckets (24h)
function bucketsHourly(rows) {
  // group by _time, datasets per prv
  const times = [...new Set(rows.map(r => r._time))].sort();
  const ds = { google: [], microsoft: [] };
  for (const t of times) {
    for (const p of ['google','microsoft']) {
      const row = rows.find(r => r._time === t && r.prv === p);
      ds[p].push(num(row?.n));
    }
  }
  const labels = times.map(t => {
    const d = new Date(t);
    return `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:00`;
  });
  return { labels, datasets: ds };
}

function bucketsDaily(rows) {
  const times = [...new Set(rows.map(r => r._time))].sort();
  const ds = { google: [], microsoft: [] };
  for (const t of times) {
    for (const p of ['google','microsoft']) {
      const row = rows.find(r => r._time === t && r.prv === p);
      ds[p].push(num(row?.n));
    }
  }
  const labels = times.map(t => {
    const d = new Date(t);
    return `${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  });
  return { labels, datasets: ds };
}

const h24 = bucketsHourly(r.hooks24h);
const h7d = bucketsDaily(r.hooks7d);

// errors — collapse to readable list
const errList = r.errors.map(e => ({
  msg: `${e.tag || '?'} · ${e.message || '?'}`,
  cause: e.cause || e.reason || '—',
  count: num(e.n),
  sev: e.level === 'warn' ? 'warn' : 'err',
}));

// oauth connects
const connects = r.oauth.map(e => ({
  time: new Date(e._time).toISOString().replace('T',' ').slice(0,19),
  prv: e.prv || '?',
  usr: e.usr || '?',
}));

// accounts / objects
const acc = r.byAcc.map(a => ({
  id: a.acc, users: num(a.users), objects: num(a.objects), configs: num(a.configs), n: num(a.n),
}));
const obj = r.byObj.map(o => ({
  id: o.obj, users: num(o.users), configs: num(o.configs), n: num(o.n),
}));
const maxAccN = Math.max(1, ...acc.map(a => a.n));
const maxObjN = Math.max(1, ...obj.map(o => o.n));

// incidents calc — dedupe sync+monday_api Column not found pair
const colNotFound = errList.find(e => /Column not found/i.test(e.cause))?.count || 0;
const colNotFoundApi = errList.find(e => /missing_column/i.test(e.cause))?.count || 0;
const incidents = Math.max(colNotFound, colNotFoundApi) + errList.filter(e => !/Column not found/i.test(e.cause) && !/missing_column/i.test(e.cause) && e.sev==='err').reduce((s,e)=>s+e.count,0);
const incidentTypes = new Set(errList.filter(e => e.sev==='err').map(e => e.cause)).size;

const data = {
  generatedAt: new Date().toISOString(),
  account: acc[0]?.id || '—',
  s24, s7d,
  counters: {
    subsRenewed24: num(counters.subs_renewed_24h), subsRenewed7: num(counters.subs_renewed_7d),
    tokenFail24: num(counters.token_fail_24h), tokenFail7: num(counters.token_fail_7d),
    policy24: num(counters.policy_24h), policy7: num(counters.policy_7d),
    cond24: num(counters.cond_24h), cond7: num(counters.cond_7d),
    cfgOther24: num(counters.cfg_other_24h), cfgOther7: num(counters.cfg_other_7d),
    install24: num(counters.install_24h), install7: num(counters.install_7d),
    oauth24: num(counters.oauth_24h), oauth7: num(counters.oauth_7d),
    err24: num(counters.err_24h), err7: num(counters.err_7d),
    warn24: num(counters.warn_24h), warn7: num(counters.warn_7d),
  },
  h24, h7d,
  errList, connects, acc, obj,
  maxAccN, maxObjN,
  incidents, incidentTypes,
};

// ---------- HTML template ----------
import template from './template.mjs';
const html = template(data);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, html);
console.log(`Wrote ${OUT_FILE} (${(html.length/1024).toFixed(1)} KB)`);
