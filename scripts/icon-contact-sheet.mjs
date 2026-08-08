#!/usr/bin/env node
/**
 * Build the review tool for proposed icons.
 *
 * NOTHING REACHES THE APP WITHOUT PASSING THROUGH HERE. The collectors guess;
 * this is where a person decides. Automated matching produces confident wrong
 * answers — "Gordius of Cappadocia" resolved to an assassin, "Gregory Bishop of
 * Nyssa" to Pope Gregory I, "Diomedes, Apostolos the Martyrs" to a different
 * saint who merely shares a name — and a stranger presented to a parishioner as
 * their saint is a worse failure than an empty day.
 *
 * It is built for reviewing HUNDREDS of rows, which is a different problem from
 * looking at a dozen:
 *
 *   - Keyboard first. j/k move, 1-9 approve that candidate, 0 rejects the row
 *     outright, u undoes. A mouse works too, but nobody clicks through 590 rows.
 *   - Progress survives. Every decision is written to localStorage immediately,
 *     so review can be done in several sittings and a closed tab costs nothing.
 *   - Licence is a first-class column, not a footnote, and the tier decides
 *     whether a candidate is offered at all. `--allow` widens that gate
 *     deliberately rather than by accident.
 *   - The evidence for each match is on screen: the Wikidata description, or the
 *     Greek name, whichever the match was made on. Reading "Archbishop of Athens"
 *     under a martyr is how a bad match is caught in a second by someone who does
 *     not know the saint.
 *
 * Reads every icons/candidates*.json the collectors have written and merges them,
 * so a new source can be added without touching this file.
 *
 *   node scripts/icon-contact-sheet.mjs                 public domain and CC0 only
 *   node scripts/icon-contact-sheet.mjs --allow ccby    also offer CC BY
 *   node scripts/icon-contact-sheet.mjs --allow any     offer everything, flagged
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'icons');
const OUT = path.join(DIR, 'contact-sheet.html');

const args = process.argv.slice(2);
const allowArg = args.indexOf('--allow');
const ALLOW = allowArg >= 0 ? args[allowArg + 1] : 'pd';

/**
 * Licence tiers, in the order we would rather have them.
 *
 *   free   public domain, PD-old, PD-art, CC0, "no known copyright restrictions"
 *   ccby   attribution required but no share-alike — publishable if credited
 *   other  ShareAlike, NonCommercial, NoDerivs: not shippable in this app
 *   none   no stated provenance at all, which is NOT the same as free
 */
function tierOf(c) {
  const s = `${c.license ?? ''} ${c.usageTerms ?? ''}`.toLowerCase();
  if (/public domain|cc0|pd-|no known copyright/.test(s)) return 'free';
  if (/cc by|attribution/.test(s) && !/share|-sa\b|noncommercial|\bnc\b|noderiv/.test(s))
    return 'ccby';
  if (!s.trim() || /no stated provenance|unknown/.test(s)) return 'none';
  return 'other';
}
const TIER_RANK = { free: 0, ccby: 1, none: 2, other: 3 };
const allowed = new Set(
  ALLOW === 'any'
    ? ['free', 'ccby', 'none', 'other']
    : ALLOW === 'ccby'
      ? ['free', 'ccby']
      : ['free'],
);

if (!fs.existsSync(DIR)) {
  console.error('No icons/ directory. Run a collector first.');
  process.exit(1);
}
const stores = fs.readdirSync(DIR).filter((f) => /^candidates.*\.json$/.test(f));
if (!stores.length) {
  console.error('No candidates. Run: node scripts/collect-icons.mjs --limit 40');
  process.exit(1);
}

/** Merge every collector's output onto one row per commemoration. */
const rows = new Map();
for (const file of stores) {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  for (const [id, rec] of Object.entries(data)) {
    const row = rows.get(id) ?? {
      id,
      title: rec.title,
      date: rec.date,
      highRank: !!rec.highRank,
      evidence: [],
      candidates: [],
    };
    if (rec.entity) {
      row.evidence.push(`${rec.entity.label} — ${rec.entity.description} (${rec.entity.qid})`);
    }
    // saint.gr records nest under `card`; Commons ones are already flat.
    if (rec.card) {
      row.evidence.push(`saint.gr: ${rec.card.greekName}`);
      row.candidates.push({
        source: 'saint.gr',
        label: rec.card.greekName,
        pageUrl: rec.card.pageUrl,
        fileUrl: rec.card.fullUrl,
        thumbUrl: rec.card.thumbUrl,
        license: rec.card.modernSubject ? 'modern subject — rights live' : '',
        modernSubject: !!rec.card.modernSubject,
      });
    }
    for (const c of rec.candidates ?? []) {
      row.candidates.push({
        source: c.source ?? 'commons',
        label: c.commonsTitle ?? c.label ?? '',
        pageUrl: c.pageUrl,
        fileUrl: c.fileUrl,
        thumbUrl: c.thumbUrl,
        license: c.license || c.usageTerms || '',
        author: c.author ?? '',
        modernSubject: !!c.modernSubject,
      });
    }
    rows.set(id, row);
  }
}

for (const row of rows.values()) {
  const byUrl = new Map();
  for (const c of row.candidates) {
    c.tier = tierOf(c);
    if (c.thumbUrl && !byUrl.has(c.thumbUrl)) byUrl.set(c.thumbUrl, c);
  }
  row.candidates = [...byUrl.values()]
    .filter((c) => allowed.has(c.tier))
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
}

const all = [...rows.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
const withCandidates = all.filter((r) => r.candidates.length);
const without = all.length - withCandidates.length;

const payload = withCandidates.map((r) => ({
  id: r.id,
  title: r.title,
  date: r.date,
  highRank: r.highRank,
  evidence: [...new Set(r.evidence)],
  candidates: r.candidates,
}));

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Icon review — ${withCandidates.length} commemorations</title>
<style>
  :root{color-scheme:light dark;--free:#2e7d32;--ccby:#1565c0;--warn:#c62828;--dim:#8a8a8a}
  *{box-sizing:border-box}
  body{font:15px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:0 0 90px}
  header{position:sticky;top:0;z-index:5;background:Canvas;padding:14px 24px 10px;
    border-bottom:1px solid color-mix(in srgb,currentColor 18%,transparent)}
  h1{font-size:17px;margin:0 0 6px}
  .meta{font-size:13px;color:var(--dim);display:flex;gap:18px;flex-wrap:wrap;align-items:center}
  .keys code{background:color-mix(in srgb,currentColor 10%,transparent);padding:1px 5px;border-radius:3px}
  input[type=search]{font:inherit;padding:5px 10px;border-radius:6px;
    border:1px solid color-mix(in srgb,currentColor 25%,transparent);background:transparent;color:inherit}
  .row{padding:14px 24px;border-bottom:1px solid color-mix(in srgb,currentColor 10%,transparent);scroll-margin-top:96px}
  .row.cur{background:color-mix(in srgb,currentColor 6%,transparent)}
  .row.done{opacity:.5}
  .row.skip{opacity:.35}
  .head{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
  .date{color:var(--dim);font-variant-numeric:tabular-nums;font-size:12px;min-width:82px}
  .title{font-weight:600}
  .rank{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#b8860b}
  .ev{font-size:12.5px;color:var(--dim);margin:3px 0 9px}
  .strip{display:flex;gap:12px;flex-wrap:wrap}
  figure{margin:0;width:132px;cursor:pointer;position:relative}
  figure img{width:132px;height:132px;object-fit:contain;display:block;border-radius:4px;
    border:3px solid transparent;background:color-mix(in srgb,currentColor 7%,transparent)}
  figure.on img{border-color:var(--free)}
  .num{position:absolute;top:3px;left:3px;font-size:10px;font-weight:700;padding:1px 5px;
    border-radius:3px;background:color-mix(in srgb,Canvas 80%,currentColor);color:CanvasText}
  .lic{font-size:10px;margin-top:3px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
  .lic.free{color:var(--free)} .lic.ccby{color:var(--ccby)}
  .lic.none,.lic.other{color:var(--warn)}
  .cap{font-size:10.5px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .modern{font-size:9.5px;color:var(--warn);font-weight:700;text-transform:uppercase}
  footer{position:fixed;left:0;right:0;bottom:0;background:Canvas;padding:10px 24px;
    border-top:1px solid color-mix(in srgb,currentColor 20%,transparent);display:flex;gap:14px;align-items:center}
  button{font:inherit;padding:7px 14px;border-radius:6px;cursor:pointer;color:inherit;
    border:1px solid color-mix(in srgb,currentColor 25%,transparent);background:transparent}
  button.go{background:var(--free);color:#fff;border-color:transparent;font-weight:600}
  .bar{flex:1;height:6px;border-radius:3px;background:color-mix(in srgb,currentColor 15%,transparent);overflow:hidden}
  .bar i{display:block;height:100%;background:var(--free);width:0}
</style>
<header>
  <h1>Icon review <span style="font-weight:400;color:var(--dim)">— licence gate: <b>${ALLOW}</b></span></h1>
  <div class="meta">
    <span>${withCandidates.length} to review · ${without} with no candidate</span>
    <span class="keys"><code>j</code>/<code>k</code> move · <code>1</code>–<code>9</code> approve · <code>0</code> none · <code>u</code> undo</span>
    <input type="search" id="q" placeholder="filter by name or date…">
  </div>
</header>
<main id="list"></main>
<footer>
  <div class="bar"><i id="fill"></i></div>
  <span id="count"></span>
  <button id="jump">Next undecided</button>
  <button class="go" id="save">Download approved.json</button>
</footer>
<script>
const ROWS = ${JSON.stringify(payload)};
const KEY = 'okn-icon-review-v1';
let state = JSON.parse(localStorage.getItem(KEY) || '{}');
let cur = 0;
const list = document.getElementById('list');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function render(filter = '') {
  const f = filter.trim().toLowerCase();
  list.innerHTML = ROWS.map((r, i) => {
    if (f && !((r.title + ' ' + r.date + ' ' + r.evidence.join(' ')).toLowerCase().includes(f))) return '';
    const d = state[r.id];
    const cls = d === 'none' ? 'skip' : d ? 'done' : '';
    return '<div class="row ' + cls + '" data-i="' + i + '" id="r' + i + '">' +
      '<div class="head"><span class="date">' + (r.date || '') + '</span>' +
      '<span class="title">' + esc(r.title) + '</span>' +
      (r.highRank ? '<span class="rank">high rank</span>' : '') + '</div>' +
      (r.evidence.length ? '<div class="ev">' + r.evidence.map(esc).join(' · ') + '</div>' : '') +
      '<div class="strip">' + r.candidates.map((c, n) =>
        '<figure data-i="' + i + '" data-n="' + n + '" class="' +
          (d && d !== 'none' && d.thumbUrl === c.thumbUrl ? 'on' : '') + '">' +
        '<img loading="lazy" src="' + esc(c.thumbUrl) + '" alt="">' +
        '<span class="num">' + (n + 1) + '</span>' +
        '<div class="lic ' + c.tier + '">' +
          (c.tier === 'free' ? 'public domain' : c.tier === 'ccby' ? 'cc by'
            : c.tier === 'none' ? 'no provenance' : esc(c.license)) + '</div>' +
        (c.modernSubject ? '<div class="modern">modern subject</div>' : '') +
        '<div class="cap" title="' + esc(c.label) + '">' + esc(c.label) + '</div>' +
        '</figure>').join('') + '</div></div>';
  }).join('');
  paint();
}
function paint() {
  document.querySelectorAll('.row').forEach((el) => el.classList.toggle('cur', Number(el.dataset.i) === cur));
  const decided = Object.keys(state).length;
  const approved = Object.values(state).filter((v) => v !== 'none').length;
  document.getElementById('count').textContent = approved + ' approved · ' + decided + '/' + ROWS.length + ' decided';
  document.getElementById('fill').style.width = (100 * decided / ROWS.length) + '%';
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
function decide(i, n) {
  const r = ROWS[i];
  if (n === null) state[r.id] = 'none';
  else { const c = r.candidates[n]; if (!c) return; state[r.id] = Object.assign({ title: r.title, date: r.date }, c); }
  save(); render(document.getElementById('q').value);
}
function move(d) {
  const vis = [...document.querySelectorAll('.row')].map((e) => Number(e.dataset.i));
  if (!vis.length) return;
  const at = vis.indexOf(cur);
  cur = vis[Math.max(0, Math.min(vis.length - 1, (at < 0 ? 0 : at) + d))];
  paint();
  document.getElementById('r' + cur)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'j') { move(1); e.preventDefault(); }
  else if (e.key === 'k') { move(-1); e.preventDefault(); }
  else if (e.key >= '1' && e.key <= '9') { decide(cur, Number(e.key) - 1); move(1); }
  else if (e.key === '0') { decide(cur, null); move(1); }
  else if (e.key === 'u') { delete state[ROWS[cur].id]; save(); render(document.getElementById('q').value); }
});
list.addEventListener('click', (e) => {
  const fig = e.target.closest('figure'); if (!fig) return;
  cur = Number(fig.dataset.i); decide(cur, Number(fig.dataset.n));
});
document.getElementById('q').addEventListener('input', (e) => render(e.target.value));
document.getElementById('jump').addEventListener('click', () => {
  const next = ROWS.findIndex((r, i) => i > cur && !state[r.id]);
  cur = next >= 0 ? next : cur; paint();
  document.getElementById('r' + cur)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
});
document.getElementById('save').addEventListener('click', () => {
  const out = {};
  for (const [k, v] of Object.entries(state)) if (v !== 'none') out[k] = v;
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'approved.json'; a.click();
});
render();
</script>
`;

fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(OUT, html);

const tiers = {};
for (const r of withCandidates)
  for (const c of r.candidates) tiers[c.tier] = (tiers[c.tier] ?? 0) + 1;
console.log(`sources merged     : ${stores.join(', ')}`);
console.log(`licence gate       : ${ALLOW}  (${[...allowed].join(', ')})`);
console.log(`rows to review     : ${withCandidates.length}`);
console.log(`no candidate       : ${without}`);
console.log(
  `candidates by tier : ${
    Object.entries(tiers)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ') || 'none'
  }`,
);
console.log(`\nwrote ${path.relative(ROOT, OUT)}`);
