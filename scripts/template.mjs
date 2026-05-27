// HTML template. The server emits a static shell + the full `data` object
// (all scopes × both windows) as embedded JSON. A client-side render(scope,
// window) builds the content area, so the account/instance filter and the
// 24h/7d toggle both switch instantly with no re-query.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const PRV_COLORS = { google: '#4285f4', microsoft: '#14b8a6', monday: '#ff3d57', outlook: '#0078d4' };

export default function (app, d) {
  const title = `${app.name || app.slug} · Health Dashboard`;
  // status pill reflects the "all" scope, 24h window
  const all24 = d.scopeData['all']?.['24h'] || { counters: { err: 0, warn: 0 } };
  const ok = all24.counters.err === 0 && all24.counters.warn === 0;

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  :root{
    --bg:#f5f6fb;--card:#ffffff;--card-soft:#f8fafc;
    --ink:#0f172a;--ink-soft:#64748b;--ink-mute:#94a3b8;
    --line:#e5e7eb;--line-soft:#f1f5f9;
    --brand:#6366f1;--brand-2:#8b5cf6;
    --ok:#10b981;--warn:#f59e0b;--err:#ef4444;
    --r:14px;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--ink);background:var(--bg);min-height:100vh;line-height:1.45}
  .wrap{max-width:1280px;margin:0 auto;padding:28px 20px 60px}
  header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:22px;flex-wrap:wrap}
  .brand-row{display:flex;align-items:center;gap:14px}
  .logo{width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:grid;place-items:center;color:#fff;font-size:22px;box-shadow:0 10px 30px -8px rgba(99,102,241,.5)}
  h1{margin:0;font-size:21px;font-weight:700;letter-spacing:-.02em}
  .sub{color:var(--ink-soft);font-size:12.5px;margin-top:3px}
  .sub code{font-family:ui-monospace,Menlo,monospace;font-size:.85em;color:var(--ink);background:#eef2ff;padding:1px 6px;border-radius:5px;border:1px solid #c7d2fe}
  .status-pill{display:inline-flex;align-items:center;gap:9px;padding:9px 16px;border-radius:999px;font-weight:600;font-size:13px}
  .status-pill.ok{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
  .status-pill.bad{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
  .dot{width:9px;height:9px;border-radius:50%}
  .status-pill.ok .dot{background:#10b981;box-shadow:0 0 0 4px #d1fae5}
  .status-pill.bad .dot{background:#ef4444;box-shadow:0 0 0 4px #fee2e2}

  /* toolbar: scope filter + window toggle */
  .toolbar{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:26px;flex-wrap:wrap}
  .scope-pick{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:7px 12px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
  .scope-pick label{font-size:12px;font-weight:700;color:var(--ink-mute)}
  .scope-pick select{appearance:none;border:0;background:transparent;font:inherit;font-weight:700;font-size:13px;color:var(--ink);cursor:pointer;padding-left:18px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748b' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:left center}
  .toggle{display:inline-flex;background:#fff;border:1px solid var(--line);border-radius:999px;padding:4px;gap:4px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
  .toggle button{appearance:none;border:0;background:transparent;color:var(--ink-soft);font:inherit;font-weight:700;font-size:13px;padding:8px 18px;border-radius:999px;cursor:pointer;transition:all .15s}
  .toggle button:hover{color:var(--ink)}
  .toggle button.active{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 6px 16px -6px rgba(99,102,241,.5)}

  .section{margin:32px 0 14px;display:flex;align-items:center;gap:12px}
  .section .ico{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-size:17px;background:#fff;border:1px solid var(--line);box-shadow:0 1px 2px rgba(15,23,42,.04)}
  .section h2{margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em}
  .section .desc{margin-right:auto;color:var(--ink-mute);font-size:12px}

  .grid{display:grid;gap:14px}
  .g-2{grid-template-columns:repeat(2,1fr)}
  .g-3{grid-template-columns:repeat(3,1fr)}
  .g-4{grid-template-columns:repeat(4,1fr)}
  .g-5{grid-template-columns:repeat(5,1fr)}
  @media (max-width:1100px){.g-4,.g-5{grid-template-columns:repeat(2,1fr)}}
  @media (max-width:680px){.g-2,.g-3,.g-4,.g-5{grid-template-columns:1fr}}

  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:18px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
  .card h3{margin:0 0 2px;font-size:14px;font-weight:700}
  .card .hint{color:var(--ink-mute);font-size:11.5px;margin-bottom:12px}

  .kpi{position:relative;overflow:hidden;border-radius:var(--r);text-align:center}
  .kpi .label{font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.07em;font-weight:700;line-height:1.4;min-height:32px;text-align:right}
  .kpi-big{font-size:42px;font-weight:800;letter-spacing:-.03em;line-height:1;margin:10px 0 8px;font-variant-numeric:tabular-nums;color:var(--ink)}
  .kpi .delta{font-size:11.5px;color:var(--ink-soft);margin-top:4px;border-top:1px dashed var(--line);padding-top:8px;line-height:1.4;min-height:30px}
  .kpi:is(.brand,.ok,.warn,.err,.sky,.pink,.slate) .label{color:rgba(255,255,255,.92)}
  .kpi:is(.brand,.ok,.warn,.err,.sky,.pink,.slate) .kpi-big{color:#fff}
  .kpi:is(.brand,.ok,.warn,.err,.sky,.pink,.slate) .delta{color:rgba(255,255,255,.88);border-top-color:rgba(255,255,255,.22)}
  .kpi.brand{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(99,102,241,.4)}
  .kpi.ok{background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(16,185,129,.4)}
  .kpi.warn{background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(245,158,11,.4)}
  .kpi.err{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(239,68,68,.4)}
  .kpi.sky{background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(14,165,233,.4)}
  .kpi.pink{background:linear-gradient(135deg,#ec4899,#db2777);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(236,72,153,.4)}
  .kpi.slate{background:linear-gradient(135deg,#475569,#334155);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(71,85,105,.4)}

  .chart-wrap{position:relative;height:260px}

  table.t{width:100%;border-collapse:collapse;font-size:13px}
  table.t th,table.t td{text-align:right;padding:10px 12px;border-bottom:1px solid var(--line-soft)}
  table.t th{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-mute);font-weight:700;background:var(--card-soft);border-bottom:1px solid var(--line)}
  table.t tr:last-child td{border-bottom:0}
  table.t td.num{font-variant-numeric:tabular-nums;font-weight:700}
  .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}
  .badge.info{background:#eff6ff;color:#1d4ed8}
  .badge.g{background:rgba(66,133,244,.12);color:#1f6feb}
  .badge.m{background:rgba(20,184,166,.14);color:#0d9488}
  .badge.mo{background:rgba(255,61,87,.12);color:#ff3d57}
  .bar{display:inline-block;height:6px;border-radius:99px;background:linear-gradient(90deg,var(--brand),var(--brand-2));vertical-align:middle;margin-right:8px}

  .err-row{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:13px 0;border-bottom:1px dashed var(--line)}
  .err-row:first-child{padding-top:4px}
  .err-row:last-child{border-bottom:0;padding-bottom:0}
  .err-row .msg b{font-size:13.5px}
  .err-row .msg .cause{display:block;color:var(--ink-soft);font-size:11.5px;margin-top:4px;font-family:ui-monospace,Menlo,monospace;word-break:break-word}
  .err-row .c{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;min-width:54px;text-align:center;padding:6px 12px;border-radius:8px}
  .err-row .c.err{color:#b91c1c;background:#fee2e2}
  .err-row .c.warn{color:#b45309;background:#fef3c7}
  .empty{padding:16px;color:var(--ink-mute);text-align:center}

  footer{margin-top:40px;text-align:center;color:var(--ink-mute);font-size:12px;padding-top:20px;border-top:1px solid var(--line)}
  a{color:var(--brand);text-decoration:none;font-weight:600}
  code{font-family:ui-monospace,Menlo,monospace;font-size:.9em;background:var(--card-soft);padding:1px 6px;border-radius:5px;border:1px solid var(--line)}
  .t-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px}
  .t-scroll table.t{min-width:380px}

  @media (max-width:680px){
    .wrap{padding:14px 12px 36px}
    header{margin-bottom:14px;gap:10px}
    h1{font-size:17px}.sub{font-size:11.5px}
    .logo{width:40px;height:40px;font-size:20px;border-radius:11px}
    .status-pill{padding:7px 12px;font-size:12px;width:100%;justify-content:center}
    .toolbar{margin-bottom:18px;gap:10px}
    .scope-pick,.toggle{width:100%;justify-content:center}
    .section{margin:22px 0 10px;gap:10px}
    .section h2{font-size:15px}.section .ico{width:30px;height:30px;font-size:15px}
    .section .desc{display:none}
    .card{padding:14px;border-radius:12px}.grid{gap:10px}
    .kpi .label{font-size:10px;min-height:24px;letter-spacing:.05em}
    .kpi-big{font-size:34px;margin:8px 0 6px}
    .kpi .delta{font-size:11px;padding-top:6px;min-height:26px}
    .chart-wrap{height:220px}
    table.t th,table.t td{padding:8px 9px;font-size:12px}table.t th{font-size:9.5px}
    .err-row .c{font-size:18px;min-width:44px;padding:5px 8px}
    footer{font-size:11px;margin-top:28px}
  }
  @media (max-width:380px){.kpi-big{font-size:30px}h1{font-size:16px}}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div class="brand-row">
      <div class="logo">${esc(app.emoji || '📊')}</div>
      <div>
        <h1>${esc(app.name || app.slug)} · Health Dashboard</h1>
        <div class="sub">
          <a href="../" style="color:var(--ink-soft);font-weight:500">← All apps</a> ·
          Account <code>${esc(d.account)}</code> · עדכון אחרון: <span id="ts"></span>
        </div>
      </div>
    </div>
    <div class="status-pill ${ok ? 'ok' : 'bad'}">
      <span class="dot"></span>${ok ? 'System operational · 0 errors in 24h' : `${all24.counters.err} errors in 24h`}
    </div>
  </header>

  <div class="toolbar">
    <div class="scope-pick">
      <label for="scope">סינון</label>
      <select id="scope">
        ${d.scopes.map(s => `<option value="${esc(s.key)}">${esc(s.label)}</option>`).join('')}
      </select>
    </div>
    <div class="toggle" role="group" aria-label="time window">
      <button data-win="24h">24 שעות אחרונות</button>
      <button data-win="7d" class="active">7 ימים אחרונים</button>
    </div>
  </div>

  <div id="content"></div>

  <footer>
    Data source: <a href="https://app.axiom.co/${esc(d.org || 'twyst-jffk')}" target="_blank">Axiom · ${esc(app.dataset)}</a> · Generated <span id="ts2"></span> ·
    Auto-refreshes daily via GitHub Actions
  </footer>
</div>

<script>
const DATA = ${JSON.stringify({ providers: d.providers, scopeData: d.scopeData, generatedAt: d.generatedAt })};
const PRV_COLORS = ${JSON.stringify(PRV_COLORS)};
const PROVIDERS = DATA.providers;

Chart.defaults.font.family = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#64748b';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = (x) => Number(x || 0).toLocaleString('en-US');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const color = (p) => PRV_COLORS[p] || '#64748b';
const prvDelta = (W, field) => PROVIDERS.map(p => cap(p) + ' ' + (W.sync[p] ? W.sync[p][field] : 0)).join(' · ');

function kpi({ tone, label, value, delta }) {
  return '<div class="card kpi ' + (tone||'') + '">' +
    '<div class="label">' + label + '</div>' +
    '<div class="kpi-big">' + n(value) + '</div>' +
    '<div class="delta">' + (delta || '&nbsp;') + '</div></div>';
}

function connectsTable(connects) {
  if (!connects.length) return '<div class="empty">אין connects בחלון זה</div>';
  return '<div class="t-scroll"><table class="t"><thead><tr><th>תאריך / שעה (UTC)</th><th>Provider</th><th>User ID</th></tr></thead><tbody>' +
    connects.map(c => {
      const cls = c.prv==='monday'?'mo':c.prv==='google'?'g':c.prv==='microsoft'?'m':'info';
      return '<tr><td>' + esc(c.time) + '</td><td><span class="badge ' + cls + '">' + esc(c.prv) + '</span></td><td><code>' + esc(c.usr) + '</code></td></tr>';
    }).join('') + '</tbody></table></div>';
}

function errBlock(list) {
  if (!list.length) return '<div class="empty">אין שגיאות בחלון זה ✅</div>';
  return list.map(e => '<div class="err-row"><div class="msg"><b>' + esc(e.msg) + '</b><span class="cause">' + esc(e.cause) + '</span></div><div class="c ' + e.sev + '">' + n(e.count) + '</div></div>').join('');
}

function accTable(acc, maxN) {
  if (!acc.length) return '<div class="empty">אין נתונים בחלון זה</div>';
  return '<div class="t-scroll"><table class="t"><thead><tr><th>Account ID</th><th>Users</th><th>Objects</th><th>Configs</th><th>שורות לוג</th></tr></thead><tbody>' +
    acc.map(a => '<tr><td><code>' + esc(a.id) + '</code></td><td class="num">' + a.users + '</td><td class="num">' + a.objects + '</td><td class="num">' + a.configs + '</td><td class="num">' + n(a.n) + ' <span class="bar" style="width:' + Math.round(a.n/maxN*120) + 'px"></span></td></tr>').join('') +
    '</tbody></table></div>';
}

function objTable(obj, maxN) {
  if (!obj.length) return '<div class="empty">אין נתונים בחלון זה</div>';
  return '<div class="t-scroll"><table class="t"><thead><tr><th>Object ID</th><th>Users</th><th>Configs</th><th>שורות לוג</th></tr></thead><tbody>' +
    obj.map(o => '<tr><td><code>' + esc(o.id) + '</code></td><td class="num">' + o.users + '</td><td class="num">' + o.configs + '</td><td class="num">' + n(o.n) + ' <span class="bar" style="width:' + Math.round(o.n/maxN*140) + 'px"></span></td></tr>').join('') +
    '</tbody></table></div>';
}

const winLabel = (win) => win === '24h' ? '24 שעות' : '7 ימים';

function buildContent(W, win) {
  const winTxt = winLabel(win);
  return [
    // סנכרונים
    '<div class="section"><div class="ico">🔄</div><h2>סנכרונים</h2><div class="desc">sync_done · ' + winTxt + '</div></div>',
    '<div class="grid g-5">',
      kpi({tone:'brand',label:'סך ריצות סנכרון',value:W.sync.syncs,delta:prvDelta(W,'syncs')}),
      kpi({tone:'ok',label:'פריטים נוצרו ➕',value:W.sync.created,delta:prvDelta(W,'created')}),
      kpi({tone:'sky',label:'פריטים עודכנו ✏️',value:W.sync.updated,delta:prvDelta(W,'updated')}),
      kpi({tone:'pink',label:'פריטים נמחקו 🗑',value:W.sync.deleted,delta:prvDelta(W,'deleted')}),
      kpi({tone:'slate',label:'דולגו (RSVP·all-day·past)',value:W.sync.skipped,delta:'התנהגות צפויה'}),
    '</div>',
    '<div class="grid g-2" style="margin-top:14px">',
      '<div class="card"><h3>תוצאות סנכרון</h3><div class="hint">פריטים שטופלו פר תוצאה</div><div class="chart-wrap"><canvas id="cSync"></canvas></div></div>',
      '<div class="card"><h3>Webhooks שהתקבלו</h3><div class="hint">' + (win==='24h'?'פר שעה':'פר יום') + ' · message=<code>webhook_received</code></div><div class="chart-wrap"><canvas id="cHooks"></canvas></div></div>',
    '</div>',
    // טוקנים
    '<div class="section"><div class="ico">🔑</div><h2>חידושי טוקנים &amp; מנויי-Push</h2><div class="desc">cron יומי</div></div>',
    '<div class="grid g-3">',
      kpi({tone:'sky',label:'Subscriptions renewed',value:W.counters.subsRenewed,delta:'cron @ 08:00 UTC'}),
      kpi({tone:W.counters.tokenFail===0?'ok':'err',label:'Token refresh failures',value:W.counters.tokenFail,delta:W.counters.tokenFail===0?'אפס כשלים ✅':'יש כשלים'}),
      '<div class="card" style="background:#fefce8;border-color:#fde68a"><h3 style="color:#854d0e">💡 הערה</h3><div style="font-size:12.5px;line-height:1.6;color:#713f12;margin-top:6px">רענון <b>Access Tokens</b> מתבצע בכל סנכרון אך <b>נרשם רק בכשל</b>. הספירה היא של חידושי מנויי-Push בלבד.</div></div>',
    '</div>',
    // קונפיגורציה
    '<div class="section"><div class="ico">⚙️</div><h2>עדכוני קונפיגורציה</h2><div class="desc">SPA admin actions</div></div>',
    '<div class="grid g-4">',
      kpi({label:'Setup updates',value:W.counters.policy,delta:'owner שינה לוח / mapping'}),
      kpi({label:'Conditions updates',value:W.counters.cond,delta:'user שינה rules'}),
      kpi({label:'שינויי configs נוספים',value:W.counters.cfgOther,delta:'enabled / paused / disconnected'}),
      kpi({label:'App installs',value:W.counters.install,delta:''}),
    '</div>',
    // OAuth
    '<div class="section"><div class="ico">🆕</div><h2>כניסות חדשות</h2><div class="desc">OAuth connects</div></div>',
    '<div class="grid g-3">',
      kpi({tone:'pink',label:'סך OAuth connects',value:W.counters.oauth,delta:(new Set(W.connects.map(c=>c.usr)).size)+' משתמשים שונים'}),
      '<div class="card" style="grid-column:span 2"><h3>פירוט connects</h3><div class="hint">אירועי OAuth connect · ' + winTxt + '</div>' + connectsTable(W.connects) + '</div>',
    '</div>',
    // שגיאות
    '<div class="section"><div class="ico">' + (W.counters.err+W.counters.warn===0?'✅':'❌') + '</div><h2>שגיאות &amp; אזהרות</h2><div class="desc">level=error / level=warn</div></div>',
    '<div class="grid g-3">',
      kpi({tone:W.counters.err===0?'ok':'err',label:'Errors (level=error)',value:W.counters.err,delta:W.counters.err===0?'ירוק לחלוטין ✅':W.incidents+' incidents ייחודיים'}),
      kpi({tone:W.counters.warn===0?'ok':'warn',label:'Warnings (level=warn)',value:W.counters.warn,delta:'אזהרות'}),
      kpi({tone:'warn',label:'Incidents ייחודיים',value:W.incidents,delta:W.incidentTypes+' סוגים · לאחר dedupe'}),
    '</div>',
    '<div class="card" style="margin-top:14px"><h3>פירוט שגיאות &amp; אזהרות</h3><div class="hint">קיבוץ לפי <code>tag</code> + <code>cause</code> · ' + winTxt + '</div>' + errBlock(W.errList) + '</div>',
    // חשבונות
    '<div class="section"><div class="ico">👥</div><h2>חשבונות &amp; משתמשים</h2><div class="desc">פילוח לפי acc ו-obj</div></div>',
    '<div class="grid g-2">',
      '<div class="card"><h3>פעילות לפי חשבון</h3><div class="hint">monday.com accounts · ' + winTxt + '</div>' + accTable(W.acc, W.maxAccN) + '</div>',
      '<div class="card"><h3>פעילות לפי מופע (Custom Object)</h3><div class="hint">פילוח לפי objectId · ' + winTxt + '</div>' + objTable(W.obj, W.maxObjN) + '</div>',
    '</div>',
  ].join('');
}

let syncChart, hooksChart;
function renderCharts(W) {
  syncChart?.destroy(); hooksChart?.destroy();
  syncChart = new Chart(document.getElementById('cSync'), {
    type:'bar',
    data:{labels:['נוצרו','עודכנו','נמחקו','דולגו'],datasets:PROVIDERS.map(p=>({label:cap(p),data:[W.sync[p]?.created||0,W.sync[p]?.updated||0,W.sync[p]?.deleted||0,W.sync[p]?.skipped||0],backgroundColor:color(p),borderRadius:8,borderSkipped:false,barPercentage:.7,categoryPercentage:.7}))},
    options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:14}},tooltip:{padding:10,backgroundColor:'#0f172a',cornerRadius:8}},scales:{x:{grid:{display:false},border:{display:false},ticks:{font:{size:12,weight:600}}},y:{grid:{color:'#f1f5f9'},border:{display:false},beginAtZero:true,ticks:{precision:0}}}}
  });
  hooksChart = new Chart(document.getElementById('cHooks'), {
    type:'bar',
    data:{labels:W.hooks.labels,datasets:PROVIDERS.map(p=>({label:cap(p),data:W.hooks.datasets[p]||[],backgroundColor:color(p),borderRadius:6,borderSkipped:false,stack:'s',barPercentage:.7,categoryPercentage:.75}))},
    options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:14}},tooltip:{padding:10,backgroundColor:'#0f172a',cornerRadius:8}},scales:{x:{stacked:true,grid:{display:false},border:{display:false},ticks:{font:{size:11},maxRotation:0,autoSkip:true,maxTicksLimit:8}},y:{stacked:true,grid:{color:'#f1f5f9'},border:{display:false},beginAtZero:true,ticks:{precision:0}}}}
  });
}

let curScope = 'all', curWin = '7d';
function render() {
  const W = (DATA.scopeData[curScope] || DATA.scopeData['all'])[curWin];
  document.getElementById('content').innerHTML = buildContent(W, curWin);
  renderCharts(W);
}

document.getElementById('scope').addEventListener('change', e => { curScope = e.target.value; render(); });
document.querySelectorAll('.toggle button').forEach(b => b.addEventListener('click', () => {
  curWin = b.dataset.win;
  document.querySelectorAll('.toggle button').forEach(x => x.classList.toggle('active', x.dataset.win === curWin));
  render();
}));

render();
const t = new Date(DATA.generatedAt).toLocaleString('he-IL');
document.getElementById('ts').textContent = t;
document.getElementById('ts2').textContent = t;
</script>
</body>
</html>`;
}
