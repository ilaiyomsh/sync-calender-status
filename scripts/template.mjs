// HTML template — returns full document string for a `data` object built by generate.mjs.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const n = (x) => Number(x || 0).toLocaleString('en-US');

function statusOK(d) {
  return d.counters.err24 === 0 && d.counters.warn24 === 0;
}

function kpi({tone, label, v24, v7d, delta, t24='24h', t7d='7 ימים'}) {
  return `
  <div class="card kpi ${tone||''}">
    <div class="label">${label}</div>
    <div class="kpi-cols">
      <div class="kpi-col"><div class="t">${t24}</div><div class="v">${n(v24)}</div></div>
      <div class="div"></div>
      <div class="kpi-col"><div class="t">${t7d}</div><div class="v">${n(v7d)}</div></div>
    </div>
    <div class="delta">${delta}</div>
  </div>`;
}

export default function (d) {
  const ok = statusOK(d);
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>Calendar Sync · Health Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  :root {
    --bg:#f5f6fb;--card:#ffffff;--card-soft:#f8fafc;
    --ink:#0f172a;--ink-soft:#64748b;--ink-mute:#94a3b8;
    --line:#e5e7eb;--line-soft:#f1f5f9;
    --brand:#6366f1;--brand-2:#8b5cf6;
    --ok:#10b981;--warn:#f59e0b;--err:#ef4444;
    --google:#4285f4;--microsoft:#14b8a6;--monday:#ff3d57;
    --r:14px;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--ink);background:var(--bg);min-height:100vh;line-height:1.45}
  .wrap{max-width:1280px;margin:0 auto;padding:28px 20px 60px}
  header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:32px;flex-wrap:wrap}
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

  .kpi{position:relative;overflow:hidden;border-radius:var(--r)}
  .kpi .label{font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.07em;font-weight:700;line-height:1.4;min-height:32px}
  .kpi-cols{display:grid;grid-template-columns:1fr 1px 1fr;align-items:center;margin:8px 0 0;padding:12px 0 6px}
  .kpi-cols .div{background:var(--line);height:40px;align-self:center}
  .kpi-col{padding:0 4px;text-align:center}
  .kpi-col .t{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-mute);font-weight:700;margin-bottom:4px}
  .kpi-col .v{font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
  .kpi .delta{font-size:11.5px;color:var(--ink-soft);margin-top:8px;text-align:center;border-top:1px dashed var(--line);padding-top:8px;line-height:1.4}
  .kpi:is(.brand,.ok,.warn,.err,.sky,.pink,.slate) .label{color:rgba(255,255,255,.92);font-weight:700}
  .kpi:is(.brand,.ok,.warn,.err,.sky,.pink,.slate) .delta{color:rgba(255,255,255,.88);border-top-color:rgba(255,255,255,.22)}
  .kpi:is(.brand,.ok,.warn,.err,.sky,.pink,.slate) .kpi-cols .div{background:rgba(255,255,255,.28)}
  .kpi:is(.brand,.ok,.warn,.err,.sky,.pink,.slate) .kpi-col .t{color:rgba(255,255,255,.78)}
  .kpi:is(.brand,.ok,.warn,.err,.sky,.pink,.slate) .kpi-col .v{color:#fff}
  .kpi.brand{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(99,102,241,.4)}
  .kpi.ok{background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(16,185,129,.4)}
  .kpi.warn{background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(245,158,11,.4)}
  .kpi.err{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(239,68,68,.4)}
  .kpi.sky{background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(14,165,233,.4)}
  .kpi.pink{background:linear-gradient(135deg,#ec4899,#db2777);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(236,72,153,.4)}
  .kpi.slate{background:linear-gradient(135deg,#475569,#334155);color:#fff;border:0;box-shadow:0 10px 30px -8px rgba(71,85,105,.4)}

  .chart-wrap{position:relative;height:240px}
  .chart-wrap.tall{height:280px}

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

  footer{margin-top:40px;text-align:center;color:var(--ink-mute);font-size:12px;padding-top:20px;border-top:1px solid var(--line)}
  a{color:var(--brand);text-decoration:none;font-weight:600}
  code{font-family:ui-monospace,Menlo,monospace;font-size:.9em;background:var(--card-soft);padding:1px 6px;border-radius:5px;border:1px solid var(--line)}

  /* table wrapper — horizontal scroll on narrow screens */
  .t-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px}
  .t-scroll table.t{min-width:380px}

  /* Mobile (≤680px) */
  @media (max-width:680px){
    .wrap{padding:14px 12px 36px}
    header{margin-bottom:20px;gap:10px}
    h1{font-size:17px}
    .sub{font-size:11.5px}
    .logo{width:40px;height:40px;font-size:20px;border-radius:11px}
    .status-pill{padding:7px 12px;font-size:12px;width:100%;justify-content:center}
    .section{margin:22px 0 10px;gap:10px}
    .section h2{font-size:15px}
    .section .ico{width:30px;height:30px;font-size:15px}
    .section .desc{display:none}
    .card{padding:14px;border-radius:12px}
    .grid{gap:10px}
    .kpi .label{font-size:10px;min-height:24px;letter-spacing:.05em}
    .kpi-cols{padding:8px 0 2px;margin-top:4px}
    .kpi-cols .div{height:32px}
    .kpi-col .t{font-size:9px;margin-bottom:2px}
    .kpi-col .v{font-size:22px}
    .kpi .delta{font-size:11px;margin-top:6px;padding-top:6px}
    .chart-wrap{height:200px}
    .chart-wrap.tall{height:230px}
    /* tables: scroll horizontally */
    table.t th,table.t td{padding:8px 9px;font-size:12px}
    table.t th{font-size:9.5px}
    .bar{height:5px;margin-right:6px}
    /* errors: tighter spacing, smaller count pill */
    .err-row{padding:11px 0;gap:10px}
    .err-row .msg b{font-size:12.5px}
    .err-row .msg .cause{font-size:10.5px}
    .err-row .c{font-size:18px;min-width:44px;padding:5px 8px}
    /* footer */
    footer{font-size:11px;margin-top:28px}
  }
  /* Extra-narrow (≤380px) — iPhone SE etc */
  @media (max-width:380px){
    .kpi-col .v{font-size:20px}
    .kpi-cols{grid-template-columns:1fr 1px 1fr}
    h1{font-size:16px}
  }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div class="brand-row">
      <div class="logo">📅</div>
      <div>
        <h1>Calendar Sync · Health Dashboard</h1>
        <div class="sub">monday.com · Account <code>${esc(d.account)}</code> · 24h / 7d · עדכון אחרון: <span id="ts"></span></div>
      </div>
    </div>
    <div class="status-pill ${ok?'ok':'bad'}">
      <span class="dot"></span>${ok?'System operational · 0 errors in 24h':`${d.counters.err24} errors in 24h`}
    </div>
  </header>

  <!-- סנכרונים -->
  <div class="section"><div class="ico">🔄</div><h2>סנכרונים</h2><div class="desc">sync_done · פר ספק</div></div>
  <div class="grid g-5">
    ${kpi({tone:'brand',label:'סך ריצות סנכרון',v24:d.s24.syncs,v7d:d.s7d.syncs,delta:`Google ${d.s24.google.syncs} / ${d.s7d.google.syncs} · Microsoft ${d.s24.microsoft.syncs} / ${d.s7d.microsoft.syncs}`})}
    ${kpi({tone:'ok',label:'פריטים נוצרו ➕',v24:d.s24.created,v7d:d.s7d.created,delta:`Google ${d.s24.google.created} / ${d.s7d.google.created} · Microsoft ${d.s24.microsoft.created} / ${d.s7d.microsoft.created}`})}
    ${kpi({tone:'sky',label:'פריטים עודכנו ✏️',v24:d.s24.updated,v7d:d.s7d.updated,delta:`Google ${d.s24.google.updated} / ${d.s7d.google.updated} · Microsoft ${d.s24.microsoft.updated} / ${d.s7d.microsoft.updated}`})}
    ${kpi({tone:'pink',label:'פריטים נמחקו 🗑',v24:d.s24.deleted,v7d:d.s7d.deleted,delta:`Google ${d.s24.google.deleted} / ${d.s7d.google.deleted} · Microsoft ${d.s24.microsoft.deleted} / ${d.s7d.microsoft.deleted}`})}
    ${kpi({tone:'slate',label:'דולגו (RSVP·all-day·past)',v24:d.s24.skipped,v7d:d.s7d.skipped,delta:'התנהגות צפויה · לא דורש פעולה'})}
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card"><h3>תוצאות סנכרון · 7 ימים</h3><div class="hint">פריטים שטופלו פר תוצאה</div><div class="chart-wrap"><canvas id="cSync"></canvas></div></div>
    <div class="card"><h3>Webhooks פר שעה · 24 שעות</h3><div class="hint">קריאות Push שהתקבלו</div><div class="chart-wrap"><canvas id="c24h"></canvas></div></div>
  </div>

  <!-- חידושי טוקנים -->
  <div class="section"><div class="ico">🔑</div><h2>חידושי טוקנים &amp; מנויי-Push</h2><div class="desc">cron יומי</div></div>
  <div class="grid g-3">
    ${kpi({tone:'sky',label:'Subscriptions renewed',v24:d.counters.subsRenewed24,v7d:d.counters.subsRenewed7,delta:'cron @ 08:00 UTC'})}
    ${kpi({tone: d.counters.tokenFail7===0?'ok':'err', label:'Token refresh failures',v24:d.counters.tokenFail24,v7d:d.counters.tokenFail7,delta: d.counters.tokenFail7===0?'אפס כשלים ברענון access tokens ✅':'יש כשלים — בדוק לוגים'})}
    <div class="card" style="background:#fefce8;border-color:#fde68a">
      <h3 style="color:#854d0e">💡 הערה</h3>
      <div style="font-size:12.5px;line-height:1.6;color:#713f12;margin-top:6px">
        רענון <b>Access Tokens</b> של Google/Microsoft מתבצע בכל סנכרון אך
        <b>נרשם רק במקרה של כשל</b>. הספירה היא של חידושי מנויי-Push בלבד.
      </div>
    </div>
  </div>

  <!-- עדכוני קונפיגורציה -->
  <div class="section"><div class="ico">⚙️</div><h2>עדכוני קונפיגורציה</h2><div class="desc">SPA admin actions</div></div>
  <div class="grid g-4">
    ${kpi({label:'Setup updates',v24:d.counters.policy24,v7d:d.counters.policy7,delta:'owner שינה לוח / mapping / lock'})}
    ${kpi({label:'Conditions updates',v24:d.counters.cond24,v7d:d.counters.cond7,delta:'user שינה rules'})}
    ${kpi({label:'שינויי configs נוספים',v24:d.counters.cfgOther24,v7d:d.counters.cfgOther7,delta:'enabled / paused / disconnected'})}
    ${kpi({label:'App installs',v24:d.counters.install24,v7d:d.counters.install7,delta: d.counters.install7===0?'לא היו התקנות חדשות':''})}
  </div>

  <!-- כניסות חדשות -->
  <div class="section"><div class="ico">🆕</div><h2>כניסות חדשות</h2><div class="desc">OAuth connects · message=<code>connected</code></div></div>
  <div class="grid g-3">
    ${kpi({tone:'pink',label:'סך OAuth connects',v24:d.counters.oauth24,v7d:d.counters.oauth7,delta: `${new Set(d.connects.map(c=>c.usr)).size} משתמשים שונים`})}
    <div class="card" style="grid-column:span 2">
      <h3>פירוט · 7 ימים</h3>
      <div class="hint">אירועי OAuth connect שנרשמו</div>
      ${d.connects.length === 0
        ? '<div style="padding:16px;color:var(--ink-mute);text-align:center">אין connects בחלון זה</div>'
        : `<div class="t-scroll"><table class="t"><thead><tr><th>תאריך / שעה (UTC)</th><th>Provider</th><th>User ID</th></tr></thead><tbody>
            ${d.connects.map(c => {
              const cls = c.prv==='monday'?'mo':c.prv==='google'?'g':c.prv==='microsoft'?'m':'info';
              return `<tr><td>${esc(c.time)}</td><td><span class="badge ${cls}">${esc(c.prv)}</span></td><td><code>${esc(c.usr)}</code></td></tr>`;
            }).join('')}
          </tbody></table></div>`
      }
    </div>
  </div>

  <!-- שגיאות -->
  <div class="section"><div class="ico">${d.counters.err7+d.counters.warn7===0?'✅':'❌'}</div><h2>שגיאות &amp; אזהרות</h2><div class="desc">level=error / level=warn</div></div>
  <div class="grid g-3">
    ${kpi({tone: d.counters.err24===0?'ok':'err',label:'Errors (level=error)',v24:d.counters.err24,v7d:d.counters.err7,delta: d.counters.err24===0?'24h ירוק ✅':`${d.counters.err24} errors ב-24h`})}
    ${kpi({tone: d.counters.warn24===0?'ok':'warn',label:'Warnings (level=warn)',v24:d.counters.warn24,v7d:d.counters.warn7,delta:'אזהרות'})}
    ${kpi({tone:'warn',label:'Incidents ייחודיים · 7d',v24:d.incidents,v7d:d.incidentTypes,t24:'סה״כ',t7d:'סוגים',delta:'לאחר dedupe של sync+monday_api'})}
  </div>

  ${d.errList.length === 0 ? '' : `
  <div class="card" style="margin-top:14px">
    <h3>פירוט שגיאות &amp; אזהרות · 7 ימים</h3>
    <div class="hint">קיבוץ לפי <code>tag</code> + <code>cause</code></div>
    ${d.errList.map(e => `<div class="err-row"><div class="msg"><b>${esc(e.msg)}</b><span class="cause">${esc(e.cause)}</span></div><div class="c ${e.sev}">${n(e.count)}</div></div>`).join('')}
  </div>`}

  <!-- חשבונות -->
  <div class="section"><div class="ico">👥</div><h2>חשבונות &amp; משתמשים</h2><div class="desc">פילוח לפי <code>acc</code> ו-<code>obj</code></div></div>
  <div class="grid g-2">
    <div class="card">
      <h3>פעילות לפי חשבון · 7 ימים</h3><div class="hint">monday.com accounts</div>
      <div class="t-scroll"><table class="t"><thead><tr><th>Account ID</th><th>Users</th><th>Objects</th><th>Configs</th><th>שורות לוג</th></tr></thead>
      <tbody>${d.acc.map(a => `<tr><td><code>${esc(a.id)}</code></td><td class="num">${a.users}</td><td class="num">${a.objects}</td><td class="num">${a.configs}</td><td class="num">${n(a.n)} <span class="bar" style="width:${Math.round(a.n/d.maxAccN*120)}px"></span></td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="card">
      <h3>פעילות לפי מופע (Custom Object) · 7 ימים</h3><div class="hint">פילוח לפי <code>objectId</code></div>
      <div class="t-scroll"><table class="t"><thead><tr><th>Object ID</th><th>Users</th><th>Configs</th><th>שורות לוג</th></tr></thead>
      <tbody>${d.obj.map(o => `<tr><td><code>${esc(o.id)}</code></td><td class="num">${o.users}</td><td class="num">${o.configs}</td><td class="num">${n(o.n)} <span class="bar" style="width:${Math.round(o.n/d.maxObjN*140)}px"></span></td></tr>`).join('')}</tbody></table></div>
    </div>
  </div>

  <!-- מגמה -->
  <div class="section"><div class="ico">📈</div><h2>מגמת פעילות</h2><div class="desc">webhooks פר יום · 7 ימים</div></div>
  <div class="card">
    <h3>Webhooks שהתקבלו · פר יום</h3>
    <div class="hint">message=<code>webhook_received</code> בלבד</div>
    <div class="chart-wrap tall"><canvas id="c7d"></canvas></div>
  </div>

  <footer>
    Data source: <a href="https://app.axiom.co/${esc(process.env.AXIOM_ORG_ID || 'twyst-jffk')}" target="_blank">Axiom · calendar-sync</a> · Generated <span id="ts2"></span> ·
    Auto-refreshes daily via GitHub Actions
  </footer>
</div>

<script>
const DATA = ${JSON.stringify({h24:d.h24,h7d:d.h7d,s7d:d.s7d,generatedAt:d.generatedAt})};
Chart.defaults.font.family='-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
Chart.defaults.font.size=12;
Chart.defaults.color='#64748b';
const G='#4285f4', M='#14b8a6';

new Chart(document.getElementById('cSync'),{type:'bar',data:{labels:['נוצרו','עודכנו','נמחקו','דולגו'],datasets:[
  {label:'Google',data:[DATA.s7d.google.created,DATA.s7d.google.updated,DATA.s7d.google.deleted,DATA.s7d.google.skipped],backgroundColor:G,borderRadius:8,borderSkipped:false,barPercentage:.7,categoryPercentage:.7},
  {label:'Microsoft',data:[DATA.s7d.microsoft.created,DATA.s7d.microsoft.updated,DATA.s7d.microsoft.deleted,DATA.s7d.microsoft.skipped],backgroundColor:M,borderRadius:8,borderSkipped:false,barPercentage:.7,categoryPercentage:.7}]},
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:14}},tooltip:{padding:10,backgroundColor:'#0f172a',cornerRadius:8}},scales:{x:{grid:{display:false},border:{display:false},ticks:{font:{size:12,weight:600}}},y:{grid:{color:'#f1f5f9'},border:{display:false},beginAtZero:true,ticks:{precision:0}}}}});

new Chart(document.getElementById('c24h'),{type:'line',data:{labels:DATA.h24.labels,datasets:[
  {label:'Google',data:DATA.h24.datasets.google,borderColor:G,backgroundColor:G+'1f',tension:.4,fill:true,pointRadius:0,pointHoverRadius:5,borderWidth:2.5},
  {label:'Microsoft',data:DATA.h24.datasets.microsoft,borderColor:M,backgroundColor:M+'1f',tension:.4,fill:true,pointRadius:0,pointHoverRadius:5,borderWidth:2.5}]},
  options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:14}},tooltip:{padding:10,backgroundColor:'#0f172a',cornerRadius:8}},scales:{x:{grid:{display:false},border:{display:false},ticks:{font:{size:11},maxRotation:0,autoSkip:true,maxTicksLimit:8}},y:{grid:{color:'#f1f5f9'},border:{display:false},beginAtZero:true}}}});

new Chart(document.getElementById('c7d'),{type:'bar',data:{labels:DATA.h7d.labels,datasets:[
  {label:'Google',data:DATA.h7d.datasets.google,backgroundColor:G,borderRadius:8,borderSkipped:false,stack:'s',barPercentage:.65,categoryPercentage:.7},
  {label:'Microsoft',data:DATA.h7d.datasets.microsoft,backgroundColor:M,borderRadius:8,borderSkipped:false,stack:'s',barPercentage:.65,categoryPercentage:.7}]},
  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:14}},tooltip:{padding:10,backgroundColor:'#0f172a',cornerRadius:8}},scales:{x:{stacked:true,grid:{display:false},border:{display:false},ticks:{font:{size:12,weight:600}}},y:{stacked:true,grid:{color:'#f1f5f9'},border:{display:false},beginAtZero:true,ticks:{precision:0}}}}});

const t=new Date(DATA.generatedAt).toLocaleString('he-IL');
document.getElementById('ts').textContent=t;
document.getElementById('ts2').textContent=t;
</script>
</body>
</html>`;
}
