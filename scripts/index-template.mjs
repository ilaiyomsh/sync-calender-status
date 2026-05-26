// Landing page that lists every app dashboard with a quick health snapshot.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = (x) => Number(x || 0).toLocaleString('en-US');

function appCard(r) {
  const app = r.app;
  if (!r.ok) {
    return `
    <a class="app-card error" href="${esc(app.slug)}/">
      <div class="emoji">${esc(app.emoji || '📊')}</div>
      <div class="meta">
        <div class="name">${esc(app.name || app.slug)}</div>
        <div class="desc">${esc(app.description || app.dataset)}</div>
        <div class="error-line">⚠ generation failed: ${esc(r.error || '').slice(0,80)}</div>
      </div>
      <div class="status err">FAIL</div>
    </a>`;
  }
  const d = r.data;
  const ok = d.counters.err24 === 0 && d.counters.warn24 === 0;
  const tone = ok ? 'ok' : (d.counters.err24 > 0 ? 'err' : 'warn');
  const statusText = ok ? 'OK' : `${d.counters.err24 || d.counters.warn24} alerts`;
  return `
    <a class="app-card" href="${esc(app.slug)}/">
      <div class="emoji">${esc(app.emoji || '📊')}</div>
      <div class="meta">
        <div class="name">${esc(app.name || app.slug)}</div>
        <div class="desc">${esc(app.description || app.dataset)}</div>
        <div class="metrics">
          <span><b>${n(d.s24.syncs)}</b> syncs 24h</span>
          <span><b>${n(d.s7d.syncs)}</b> syncs 7d</span>
          <span><b>${n(d.counters.err24)}</b> errors 24h</span>
        </div>
      </div>
      <div class="status ${tone}">${esc(statusText)}</div>
    </a>`;
}

export default function (results) {
  const ts = new Date().toISOString();
  const okCount = results.filter(r => r.ok && r.data.counters.err24 === 0 && r.data.counters.warn24 === 0).length;
  const failCount = results.filter(r => !r.ok).length;
  const total = results.length;
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>Apps Status</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<style>
  :root{
    --bg:#f5f6fb;--card:#fff;--ink:#0f172a;--ink-soft:#64748b;--ink-mute:#94a3b8;
    --line:#e5e7eb;--brand:#6366f1;--brand-2:#8b5cf6;
    --ok:#10b981;--warn:#f59e0b;--err:#ef4444;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:var(--ink);background:var(--bg);line-height:1.45}
  .wrap{max-width:780px;margin:0 auto;padding:48px 24px 80px}
  header{display:flex;align-items:center;gap:14px;margin-bottom:8px}
  .logo{width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:grid;place-items:center;color:#fff;font-size:22px;box-shadow:0 10px 30px -8px rgba(99,102,241,.5)}
  h1{margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em}
  .sub{color:var(--ink-soft);font-size:13px;margin-top:2px}
  .summary{display:flex;gap:14px;margin:24px 0 28px;flex-wrap:wrap}
  .summary .pill{background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 16px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:8px}
  .summary .pill .dot{width:8px;height:8px;border-radius:50%}
  .summary .pill.ok{color:#047857;background:#ecfdf5;border-color:#a7f3d0}
  .summary .pill.ok .dot{background:#10b981}
  .summary .pill.err{color:#b91c1c;background:#fef2f2;border-color:#fecaca}
  .summary .pill.err .dot{background:#ef4444}
  .summary .pill.total{color:var(--ink-soft)}
  .summary .pill.total .dot{background:#94a3b8}
  .list{display:flex;flex-direction:column;gap:12px}
  .app-card{display:flex;align-items:center;gap:16px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;text-decoration:none;color:inherit;box-shadow:0 1px 2px rgba(15,23,42,.04);transition:transform .15s,box-shadow .15s,border-color .15s}
  .app-card:hover{transform:translateY(-1px);box-shadow:0 6px 20px -10px rgba(15,23,42,.18);border-color:#c7d2fe}
  .app-card .emoji{width:42px;height:42px;border-radius:11px;background:#f1f5f9;display:grid;place-items:center;font-size:22px;flex-shrink:0}
  .app-card .meta{flex:1;min-width:0}
  .app-card .name{font-size:15px;font-weight:700;letter-spacing:-.01em}
  .app-card .desc{font-size:12.5px;color:var(--ink-soft);margin-top:2px}
  .app-card .metrics{font-size:11.5px;color:var(--ink-mute);margin-top:8px;display:flex;gap:14px;flex-wrap:wrap}
  .app-card .metrics b{color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
  .app-card .error-line{font-size:11.5px;color:var(--err);margin-top:6px;font-family:ui-monospace,Menlo,monospace}
  .app-card .status{padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;flex-shrink:0}
  .app-card .status.ok{background:#d1fae5;color:#047857}
  .app-card .status.warn{background:#fef3c7;color:#92400e}
  .app-card .status.err{background:#fee2e2;color:#b91c1c}
  footer{margin-top:40px;text-align:center;color:var(--ink-mute);font-size:12px}
  @media (max-width:680px){
    .wrap{padding:24px 14px 40px}
    .app-card{padding:14px;gap:12px}
    .app-card .emoji{width:38px;height:38px;font-size:20px}
    .app-card .name{font-size:14px}
    .app-card .status{padding:5px 9px;font-size:10px}
    .app-card .metrics{gap:10px;font-size:11px}
    h1{font-size:18px}
  }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div class="logo">🩺</div>
    <div>
      <h1>Apps Status</h1>
      <div class="sub">דשבורדים אוטומטיים שמתעדכנים פעם ביום מ-Axiom</div>
    </div>
  </header>

  <div class="summary">
    <span class="pill total"><span class="dot"></span>${total} apps</span>
    <span class="pill ok"><span class="dot"></span>${okCount} healthy</span>
    ${failCount > 0 ? `<span class="pill err"><span class="dot"></span>${failCount} failed</span>` : ''}
  </div>

  <div class="list">
    ${results.map(appCard).join('')}
  </div>

  <footer>
    Last refresh: <span id="ts"></span> ·
    Auto-refreshes daily via <a href="https://github.com/ilaiyomsh/sync-calender-status/actions" style="color:var(--brand)">GitHub Actions</a>
  </footer>
</div>
<script>
document.getElementById('ts').textContent = new Date('${ts}').toLocaleString('he-IL');
</script>
</body>
</html>`;
}
