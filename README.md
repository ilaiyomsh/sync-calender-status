# sync-calender-status (multi-app hub)

Daily-refreshed health dashboards for monday.com apps, hosted via GitHub Pages.

**Live:** https://ilaiyomsh.github.io/sync-calender-status/

## Repo layout

```
sync-calender-status/
├── apps/                              ← one folder per app
│   └── sync-calender/
│       └── config.mjs                 ← { slug, name, emoji, dataset, … }
├── scripts/
│   ├── generate.mjs                   ← orchestrator: iterate apps → query → render
│   ├── queries.mjs                    ← shared APL queries + data shaping
│   ├── template.mjs                   ← per-app dashboard HTML
│   └── index-template.mjs             ← landing page (lists all apps)
├── .github/workflows/refresh.yml      ← daily cron + Pages deploy
├── README.md
├── package.json
└── robots.txt
```

After a workflow run, the deployed site looks like:

```
/                          ← landing page (list of all apps)
/sync-calender/            ← Calendar Sync dashboard
/<future-app>/             ← future app dashboards
```

## Add a new app (3 steps)

1. **Create the config:**
   ```bash
   mkdir -p apps/my-new-app
   cat > apps/my-new-app/config.mjs <<'EOF'
   export default {
     name: 'My New App',
     emoji: '🚀',
     dataset: 'my-new-app-prod',
     description: 'One-line description',
     providers: ['google'],   // optional, default ['google','microsoft']
   };
   EOF
   ```

2. **Make sure the app ships logs to that Axiom dataset** — use the `app/logger.js`
   from `_axiom-dashboard-template/` and the conventions documented there
   (`tag`, `message`, `acc`, `usr`, `cfg`, `obj`, `prv`, …).

3. **Commit and push** — the workflow auto-detects the new app folder and
   publishes `https://ilaiyomsh.github.io/sync-calender-status/my-new-app/`.

That's it. No code changes needed when the app follows the conventions.

## Per-app config options

| Field | Required | Description |
|---|---|---|
| `name` | yes | Human-readable name shown in dashboard header |
| `dataset` | yes | Axiom dataset name |
| `emoji` | no | Logo character (defaults to 📊) |
| `description` | no | One-line description shown on landing page |
| `providers` | no | Array of provider names for sync chart splitting (default `['google','microsoft']`) |
| `org` | no | Axiom org id if different from the workflow default |
| `queriesPath` | no | Relative path to a custom `queries.mjs` to override the shared one |

## Setup (one-time, already done)

1. ✅ Repo created and Pages enabled (build_type=workflow)
2. ✅ `AXIOM_TOKEN` secret set
3. ✅ First workflow run successful

## Run locally

```bash
AXIOM_TOKEN=xaat-... node scripts/generate.mjs
open index.html             # landing
open sync-calender/index.html
```

## Customization

- **Refresh schedule:** edit cron in `.github/workflows/refresh.yml` (default daily 06:00 UTC)
- **Multiple Axiom orgs:** add `org` to per-app config; the same `AXIOM_TOKEN` must have read access
- **Different queries per app:** drop a `queries.mjs` in the app folder, point `queriesPath` at it, export `runQueries(app, token)`

## Conventions the dashboard assumes

Standard log fields (use these in your app's logger so the default queries work):

| Field | Meaning |
|---|---|
| `tag` | coarse category — `webhook`, `sync`, `oauth`, `policy`, `scheduler`, `configs` |
| `message` | event id — `webhook_received`, `sync_done`, `connected`, `policy_updated`, … |
| `level` | `error` / `warn` / `info` / `debug` |
| `acc` | account/tenant id |
| `usr` | user id |
| `obj` | object/instance id |
| `cfg` | config id |
| `prv` | provider name |
| `created` / `updated` / `deleted` / `skipped` | counts on `sync_done` summary lines |

See the parent template (`../_axiom-dashboard-template/README.md`) for the full bootstrap guide.
