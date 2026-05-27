// Shared APL queries + data shaping. Computes BOTH time windows (24h, 7d) for
// EACH scope (all / per-account / per-instance) so the dashboard can filter and
// switch windows entirely client-side (no re-query at view time).
//
// Per-app overrides: point `config.queriesPath` to a module exporting the same
// `runQueries(app, token)` signature.

const DEFAULT_ORG = 'twyst-jffk';
const MAX_ACCOUNTS = 10;   // cap scope explosion
const MAX_INSTANCES = 12;

async function apl(query, token, org) {
  const res = await fetch('https://api.axiom.co/v1/datasets/_apl?format=tabular', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Axiom-Org-Id': org,
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

const num = (x) => Number(x || 0);
// APL string literal escaping — values are monday ids (digits) but be safe.
const lit = (v) => `'${String(v).replace(/'/g, "\\'")}'`;

function syncTotals(rows, providers) {
  const out = { syncs: 0, created: 0, updated: 0, deleted: 0, skipped: 0 };
  for (const p of providers) out[p] = { syncs: 0, created: 0, updated: 0, deleted: 0, skipped: 0 };
  for (const row of rows) {
    out.syncs   += num(row.syncs);
    out.created += num(row.created);
    out.updated += num(row.updated);
    out.deleted += num(row.deleted);
    out.skipped += num(row.skipped);
    if (providers.includes(row.prv)) {
      out[row.prv] = {
        syncs: num(row.syncs), created: num(row.created),
        updated: num(row.updated), deleted: num(row.deleted), skipped: num(row.skipped),
      };
    }
  }
  return out;
}

function buckets(rows, providers, grain) {
  const times = [...new Set(rows.map(r => r._time))].sort();
  const datasets = Object.fromEntries(providers.map(p => [p, []]));
  for (const t of times) {
    for (const p of providers) {
      const row = rows.find(r => r._time === t && r.prv === p);
      datasets[p].push(num(row?.n));
    }
  }
  const labels = times.map(t => {
    const d = new Date(t);
    if (grain === 'hour') return `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:00`;
    return `${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  });
  return { labels, datasets };
}

function shapeErrors(rows) {
  const list = rows.map(e => ({
    msg: `${e.tag || '?'} · ${e.message || '?'}`,
    cause: e.cause || e.reason || '—',
    count: num(e.n),
    sev: e.level === 'warn' ? 'warn' : 'err',
  }));
  const colNotFound = list.find(e => /Column not found/i.test(e.cause))?.count || 0;
  const colNotFoundApi = list.find(e => /missing_column/i.test(e.cause))?.count || 0;
  const incidents = Math.max(colNotFound, colNotFoundApi)
    + list.filter(e => !/Column not found/i.test(e.cause) && !/missing_column/i.test(e.cause) && e.sev === 'err').reduce((s, e) => s + e.count, 0);
  const incidentTypes = new Set(list.filter(e => e.sev === 'err').map(e => e.cause)).size;
  return { list, incidents, incidentTypes };
}

// Runs every windowed query for one range + one scope filter, then shapes it.
async function windowData(range, filter, { q, token, ORG, providers }) {
  const grain = range === '24h' ? '1h' : '1d';
  // `filter` is an APL fragment like " and acc == '14334098'" (or '').
  const F = filter || '';
  const Q = {
    sync: q(`DATASET | where _time > ago(${range})${F} and message == 'sync_done'
      | summarize syncs=count(), created=sum(created), updated=sum(updated), deleted=sum(deleted), skipped=sum(skipped) by prv`),
    hooks: q(`DATASET | where _time > ago(${range})${F} and message == 'webhook_received'
      | summarize n=count() by bin(_time, ${grain}), prv | order by _time asc`),
    counters: q(`DATASET | where _time > ago(${range})${F} | summarize
      subs_renewed = countif(message=='subscription_renewed'),
      token_fail   = countif(message=='token refresh failed'),
      policy       = countif(message=='policy_updated'),
      cond         = countif(message=='conditionals_updated'),
      cfg_other    = countif(tag=='configs' and message != 'conditionals_updated'),
      install      = countif(message=='installed'),
      oauth        = countif(message=='connected'),
      err          = countif(level=='error'),
      warn         = countif(level=='warn')`),
    oauth: q(`DATASET | where _time > ago(${range})${F} and message == 'connected'
      | project _time, prv, usr | order by _time desc | take 20`),
    errors: q(`DATASET | where _time > ago(${range})${F} and (level=='error' or level=='warn')
      | summarize n=count() by level, tag, message, cause, reason | top 15 by n`),
    byAcc: q(`DATASET | where _time > ago(${range})${F} and isnotnull(acc)
      | summarize n=count(), users=dcount(usr), objects=dcount(obj), configs=dcount(cfg) by acc | top ${MAX_ACCOUNTS} by n`),
    byObj: q(`DATASET | where _time > ago(${range})${F} and isnotnull(obj)
      | summarize n=count(), users=dcount(usr), configs=dcount(cfg) by obj | top ${MAX_INSTANCES} by n`),
  };

  const r = Object.fromEntries(await Promise.all(
    Object.entries(Q).map(async ([k, v]) => [k, await apl(v, token, ORG)])
  ));

  const c = r.counters[0] || {};
  const errors = shapeErrors(r.errors);
  const acc = r.byAcc.map(a => ({ id: a.acc, users: num(a.users), objects: num(a.objects), configs: num(a.configs), n: num(a.n) }));
  const obj = r.byObj.map(o => ({ id: o.obj, users: num(o.users), configs: num(o.configs), n: num(o.n) }));

  return {
    sync: syncTotals(r.sync, providers),
    hooks: buckets(r.hooks, providers, range === '24h' ? 'hour' : 'day'),
    counters: {
      subsRenewed: num(c.subs_renewed), tokenFail: num(c.token_fail),
      policy: num(c.policy), cond: num(c.cond), cfgOther: num(c.cfg_other),
      install: num(c.install), oauth: num(c.oauth),
      err: num(c.err), warn: num(c.warn),
    },
    errList: errors.list, incidents: errors.incidents, incidentTypes: errors.incidentTypes,
    connects: r.oauth.map(e => ({ time: new Date(e._time).toISOString().replace('T', ' ').slice(0, 19), prv: e.prv || '?', usr: e.usr || '?' })),
    acc, obj,
    maxAccN: Math.max(1, ...acc.map(a => a.n)),
    maxObjN: Math.max(1, ...obj.map(o => o.n)),
  };
}

export async function runQueries(app, token) {
  const ORG = app.org || DEFAULT_ORG;
  const DATASET = app.dataset;
  const providers = app.providers || ['google', 'microsoft'];
  const q = (s) => s.replaceAll('DATASET', `['${DATASET}']`);
  const ctx = { q, token, ORG, providers };

  // 1. Discover accounts + instances over 7d to build the scope list.
  const [accRows, objRows] = await Promise.all([
    apl(q(`DATASET | where _time > ago(7d) and isnotnull(acc) | summarize n=count() by acc | top ${MAX_ACCOUNTS} by n`), token, ORG),
    apl(q(`DATASET | where _time > ago(7d) and isnotnull(obj) | summarize n=count() by obj | top ${MAX_INSTANCES} by n`), token, ORG),
  ]);
  const accIds = accRows.map(r => r.acc).filter(Boolean);
  const objIds = objRows.map(r => r.obj).filter(Boolean);

  // 2. Build scopes: all + per account + per instance.
  const scopes = [{ key: 'all', label: 'כל החשבונות והמופעים', kind: 'all' }];
  for (const id of accIds) scopes.push({ key: `acc:${id}`, label: `Account ${id}`, kind: 'acc', id });
  for (const id of objIds) scopes.push({ key: `obj:${id}`, label: `Instance ${id}`, kind: 'obj', id });

  const filterFor = (s) =>
    s.kind === 'acc' ? ` and acc == ${lit(s.id)}` :
    s.kind === 'obj' ? ` and obj == ${lit(s.id)}` : '';

  // 3. Compute both windows for every scope (in parallel).
  const scopeData = {};
  await Promise.all(scopes.map(async (s) => {
    const filter = filterFor(s);
    const [w24, w7d] = await Promise.all([
      windowData('24h', filter, ctx),
      windowData('7d', filter, ctx),
    ]);
    scopeData[s.key] = { '24h': w24, '7d': w7d };
  }));

  const account = accIds[0] || '—';

  return {
    generatedAt: new Date().toISOString(),
    org: ORG,
    providers,
    account,
    scopes: scopes.map(({ key, label }) => ({ key, label })),
    scopeData,
  };
}
