#!/usr/bin/env node
/**
 * Render the collected candidates as a contact sheet for review.
 *
 * NOTHING IS PUBLISHED WITHOUT PASSING THROUGH HERE. `collect-icons.mjs` guesses;
 * this is where a person decides. Automated matching produces confident wrong
 * answers — "Theophilos the Martyr" resolved to a modern Archbishop of Athens,
 * "Gordius of Cappadocia" to an assassin — and a stranger presented to a
 * parishioner as their saint is a worse failure than an empty day.
 *
 * So each row shows the WHY as well as the picture: the Wikidata description the
 * match was made on is printed beside the title, because reading "Archbishop of
 * Athens" under a martyr is how you catch it in a second without knowing the
 * saint. Clicking a thumbnail approves that image for that commemoration;
 * clicking it again withdraws it. One image per commemoration.
 *
 * The sheet writes approvals into your clipboard as JSON, to be saved as
 * icons/approved.json — the only file the publish step will read.
 *
 *   node scripts/icon-contact-sheet.mjs && open icons/contact-sheet.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'icons');
const CANDIDATES = path.join(DIR, 'candidates.json');
const OUT = path.join(DIR, 'contact-sheet.html');

if (!fs.existsSync(CANDIDATES)) {
  console.error('No candidates yet. Run: node scripts/collect-icons.mjs --limit 40');
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(CANDIDATES, 'utf8'));

// saint.gr proposals are merged in as additional candidates on the same row, so
// a reviewer compares both sources side by side rather than in two passes.
const SAINTGR = path.join(DIR, 'candidates-saintgr.json');
if (fs.existsSync(SAINTGR)) {
  for (const [id, m] of Object.entries(JSON.parse(fs.readFileSync(SAINTGR, 'utf8')))) {
    const row = (store[id] ??= { ...m, candidates: [] });
    row.candidates = [
      {
        source: 'saint.gr',
        commonsTitle: m.card.greekName,
        pageUrl: m.card.pageUrl,
        fileUrl: m.card.fullUrl,
        thumbUrl: m.card.thumbUrl,
        license: m.card.modernSubject ? 'MODERN SUBJECT — rights live' : 'no stated provenance',
        modernSubject: !!m.card.modernSubject,
        greekName: m.card.greekName,
        matchScore: m.score,
      },
      ...(row.candidates ?? []),
    ];
  }
}
const existing = fs.existsSync(path.join(DIR, 'approved.json'))
  ? JSON.parse(fs.readFileSync(path.join(DIR, 'approved.json'), 'utf8'))
  : {};

const rows = Object.values(store)
  .filter((s) => s.candidates?.length)
  .sort((a, b) => a.date.localeCompare(b.date));
const empty = Object.values(store).filter((s) => !s.candidates?.length);

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

const html = `<!doctype html>
<meta charset="utf-8">
<title>Icon contact sheet — ${rows.length} commemorations</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; margin: 0; padding: 24px 28px 120px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .lede { opacity: .7; margin: 0 0 24px; max-width: 60ch; }
  .row { padding: 16px 0; border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
  .head { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
  .date { opacity: .5; font-variant-numeric: tabular-nums; font-size: 13px; }
  .title { font-weight: 600; }
  .rank { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #b8860b; }
  .why { opacity: .65; font-size: 13px; margin: 2px 0 10px; }
  .why a { color: inherit; }
  .strip { display: flex; gap: 10px; flex-wrap: wrap; }
  figure { margin: 0; width: 150px; cursor: pointer; }
  figure img { width: 150px; height: 150px; object-fit: contain;
    background: color-mix(in srgb, currentColor 6%, transparent);
    border: 3px solid transparent; border-radius: 4px; display: block; }
  figure.on img { border-color: #2e7d32; }
  figcaption { font-size: 11px; opacity: .6; margin-top: 4px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  figure.on figcaption { opacity: 1; color: #2e7d32; font-weight: 600; }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 28px;
    background: Canvas; border-top: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    display: flex; gap: 16px; align-items: center; }
  button { font: inherit; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
  .src { color: #1565c0; font-weight: 600; }
  .warn { font-size: 10px; color: #c62828; font-weight: 700; margin-top: 2px;
    text-transform: uppercase; letter-spacing: .04em; }
  .none { opacity: .55; font-size: 13px; margin-top: 32px; }
</style>
<h1>Icon contact sheet</h1>
<p class="lede">Click an image to approve it for that commemoration; click again to withdraw.
Two sources are shown together: <span class="src">saint.gr</span> proposals carry the Greek name,
so you can verify the match at a glance; Commons ones carry a stated licence.
Anything flagged <span style="color:#c62828;font-weight:700">MODERN SUBJECT</span> depicts someone who
died after 1900, so its icon was painted recently and its rights are live — approve those only deliberately.
<strong>Check the grey line first</strong> — it is what the match was made on, and reading
"Archbishop of Athens" under a martyr is how you catch a wrong one without knowing the saint.
Approve nothing you are unsure of; a blank day is fine.</p>

${rows
  .map(
    (r) => `<div class="row" data-id="${esc(r.id)}">
  <div class="head">
    <span class="date">${esc(r.date)}</span>
    <span class="title">${esc(r.title)}</span>
    ${r.highRank ? '<span class="rank">high rank</span>' : ''}
  </div>
  <div class="why">matched: ${esc(r.entity?.label ?? '?')} — ${esc(r.entity?.description ?? 'no description')}
    ${r.entity ? `· <a href="https://www.wikidata.org/wiki/${esc(r.entity.qid)}" target="_blank">${esc(r.entity.qid)}</a>` : ''}</div>
  <div class="strip">
    ${r.candidates
      .map(
        (
          c,
          i,
        ) => `<figure data-i="${i}"${existing[r.id]?.commonsTitle === c.commonsTitle ? ' class="on"' : ''}>
      <img loading="lazy" src="${esc(c.thumbUrl)}" alt="">
      <figcaption title="${esc(c.commonsTitle)} — ${esc(c.license)}">${
        c.source === 'saint.gr'
          ? `<span class="src">saint.gr</span> ${esc(c.greekName ?? '')}`
          : esc(c.license || '?')
      }</figcaption>
      ${c.modernSubject ? '<div class="warn">modern subject — rights live</div>' : ''}
    </figure>`,
      )
      .join('')}
  </div>
</div>`,
  )
  .join('\n')}

<p class="none">${empty.length} commemorations found no public-domain candidate and are not shown.
They will simply have no icon — the day falls back to ornament.</p>

<div class="bar">
  <button id="copy">Copy approvals as JSON</button>
  <span id="count"></span>
  <span style="opacity:.6">then save as <code>icons/approved.json</code></span>
</div>
<script>
const DATA = ${JSON.stringify(
  Object.fromEntries(
    rows.map((r) => [r.id, { title: r.title, date: r.date, candidates: r.candidates }]),
  ),
)};
const approved = ${JSON.stringify(existing)};
function refresh() {
  document.getElementById('count').textContent =
    Object.keys(approved).length + ' of ' + ${rows.length} + ' approved';
}
document.querySelectorAll('.row').forEach((row) => {
  const id = row.dataset.id;
  row.querySelectorAll('figure').forEach((fig) => {
    fig.addEventListener('click', () => {
      const c = DATA[id].candidates[Number(fig.dataset.i)];
      const already = fig.classList.contains('on');
      row.querySelectorAll('figure').forEach((f) => f.classList.remove('on'));
      if (already) { delete approved[id]; }
      else {
        fig.classList.add('on');
        approved[id] = { title: DATA[id].title, date: DATA[id].date, ...c };
      }
      refresh();
    });
  });
});
document.getElementById('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(JSON.stringify(approved, null, 2));
  document.getElementById('copy').textContent = 'Copied — save as icons/approved.json';
});
refresh();
</script>
`;

fs.writeFileSync(OUT, html);
console.log(`${rows.length} commemorations with candidates, ${empty.length} without.`);
console.log(`wrote ${path.relative(ROOT, OUT)}`);
console.log(`\n  open ${path.relative(ROOT, OUT)}`);
