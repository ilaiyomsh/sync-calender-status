# sync-calender-status

Auto-generated daily health dashboard for the [Calendar Sync](../sync-calender) monday.com app.

**Live URL:** https://ilaiyomsh.github.io/sync-calender-status/

The dashboard is regenerated every day at 06:00 UTC by a GitHub Actions workflow that queries Axiom and writes a static `index.html` published via GitHub Pages.

## Setup (one-time)

1. Add secret `AXIOM_TOKEN` to repo settings (Settings → Secrets → Actions). Token needs read access to the `calendar-sync` dataset.
2. (optional) Add repository variables `AXIOM_ORG_ID` (default `twyst-jffk`) and `AXIOM_DATASET` (default `calendar-sync`).
3. Enable GitHub Pages from Settings → Pages → Source: **GitHub Actions**.
4. Trigger the workflow manually once from the Actions tab to seed `index.html`.

## Run locally

```bash
AXIOM_TOKEN=xaat-... node scripts/generate.mjs
open index.html
```

## Files

| Path | Purpose |
|---|---|
| `scripts/generate.mjs` | Runs Axiom queries, builds data object |
| `scripts/template.mjs` | HTML template (returns full doc string) |
| `.github/workflows/refresh.yml` | Daily cron + manual dispatch |
| `index.html` | Generated output (committed by Actions, served by Pages) |
| `robots.txt` | Disallow indexing |
