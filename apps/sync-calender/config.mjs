// Per-app config consumed by scripts/generate.mjs.
// Add a new app: copy this folder, change `slug`/`name`/`dataset`.
//
// Optional fields you can add:
//   org           — Axiom org id if different from default `twyst-jffk`
//   providers     — e.g. ['google','microsoft'] (affects how the sync chart splits)
//   hide          — array of section keys to hide: 'tokens','config','oauth','errors','accounts','trend'
//   accountLabel  — string to show next to account id in the header
//   queriesPath   — relative path to a custom queries.mjs that overrides the shared one
export default {
  slug: 'sync-calender',
  name: 'Calendar Sync',
  emoji: '📅',
  dataset: 'calendar-sync',
  description: 'Google/Microsoft Calendar → monday.com sync',
  providers: ['google', 'microsoft'],
};
