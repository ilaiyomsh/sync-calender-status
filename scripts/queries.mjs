// Shared APL queries + data shaping. Returns the `data` object that
// scripts/template.mjs expects. Per-app overrides can be added later by
// pointing `config.queriesPath` to an alternative module that exports the
// same `runQueries(app, token)` signature.

const DEFAULT_ORG = 'twyst-jffk';

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
      out[row.prv].syncs   = num(row.syncs);
      out[row.prv].created = num(row.created);
      out[row.prv].updated = num(row.updated);
      out[row.prv].deleted = num(row.deleted);
      out[row.prv].skipped = num(row.skipped);
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

export async function runQueries(app, token) {
  const ORG = app.org || DEFAULT_ORG;
  const DATASET = app.dataset;
  const providers = app.providers || ['google', 'microsoft'];
  const q = (s) => s.replaceAll('DATASET', `['${DATASET}']`);

  const Q = {
    sync24h: q(`DATASET | where _time > ago(24h) and message == 'sync_done'
      | summarize syncs=count(), created=sum(created), updated=sum(updated), deleted=sum(deleted), skipped=sum(skipped) by prv`),
    sync7d: q(`DATASET | where _time > ago(7d) and message == 'sync_done'
      | summarize syncs=count(), created=sum(created), updated=sum(updated), deleted=sum(deleted), skipped=sum(skipped) by prv`),
    hooks24h: q(`DATASET | where _time > ago(24h) and message == 'webhook_received'
      | summarize n=count() by bin(_time, 1h), prv | order by _time asc`),
    hooks7d: q(`DATASET | where _time > ago(7d) and message == 'webhook_received'
      | summarize n=count() by bin(_time, 1d), prv | order by _time asc`),
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
      cfg_other_7d     = countif(tag=='configs' and message != 'conditionals_updated'),
      install_24h      = countif(message=='installed' and _time > ago(24h)),
      install_7d       = countif(message=='installed'),
      oauth_24h        = countif(message=='connected' and _time > ago(24h)),
      oauth_7d         = countif(message=='connected'),
      err_24h          = countif(level=='error' and _time > ago(24h)),
      err_7d           = countif(level=='error'),
      warn_24h         = countif(level=='warn' and _time > ago(24h)),
      warn_7d          = countif(level=='warn')`),
    oauth: q(`DATASET | where _time > ago(7d) and message == 'connected'
      | project _time, prv, usr | order by _time desc | take 20`),
    errors: q(`DATASET | where _time > ago(7d) and (level=='error' or level=='warn')
      | summarize n=count() by level, tag, message, cause, reason | top 15 by n`),
    byAcc: q(`DATASET | where _time > ago(7d) and isnotnull(acc)
      | summarize n=count(), users=dcount(usr), objects=dcount(obj), configs=dcount(cfg) by acc`),
    byObj: q(`DATASET | where _time > ago(7d) and isnotnull(obj)
      | summarize n=count(), users=dcount(usr), configs=dcount(cfg) by obj | top 10 by n`),
  };

  const r = Object.fromEntries(await Promise.all(
    Object.entries(Q).map(async ([k, v]) => [k, await apl(v, token, ORG)])
  ));

  const counters = r.counters[0] || {};
  const s24 = syncTotals(r.sync24h, providers);
  const s7d = syncTotals(r.sync7d, providers);
  const h24 = buckets(r.hooks24h, providers, 'hour');
  const h7d = buckets(r.hooks7d, providers, 'day');

  const errList = r.errors.map(e => ({
    msg: `${e.tag || '?'} · ${e.message || '?'}`,
    cause: e.cause || e.reason || '—',
    count: num(e.n),
    sev: e.level === 'warn' ? 'warn' : 'err',
  }));

  const connects = r.oauth.map(e => ({
    time: new Date(e._time).toISOString().replace('T', ' ').slice(0, 19),
    prv: e.prv || '?',
    usr: e.usr || '?',
  }));

  const acc = r.byAcc.map(a => ({
    id: a.acc, users: num(a.users), objects: num(a.objects), configs: num(a.configs), n: num(a.n),
  }));
  const obj = r.byObj.map(o => ({
    id: o.obj, users: num(o.users), configs: num(o.configs), n: num(o.n),
  }));
  const maxAccN = Math.max(1, ...acc.map(a => a.n));
  const maxObjN = Math.max(1, ...obj.map(o => o.n));

  const colNotFound = errList.find(e => /Column not found/i.test(e.cause))?.count || 0;
  const colNotFoundApi = errList.find(e => /missing_column/i.test(e.cause))?.count || 0;
  const incidents = Math.max(colNotFound, colNotFoundApi)
    + errList.filter(e => !/Column not found/i.test(e.cause) && !/missing_column/i.test(e.cause) && e.sev === 'err').reduce((s, e) => s + e.count, 0);
  const incidentTypes = new Set(errList.filter(e => e.sev === 'err').map(e => e.cause)).size;

  return {
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
    org: ORG,
  };
}
