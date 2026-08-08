#!/usr/bin/env node
/**
 * Propose candidate icons for the calendar's commemorations.
 *
 * THIS SCRIPT PUBLISHES NOTHING. It only proposes. Everything it finds goes into
 * a candidates file which `icon-contact-sheet.mjs` renders for review, and only
 * what a human approves is ever published. A wrong icon in a church app is worse
 * than no icon, so the review step is the safeguard and is not optional.
 *
 * WHY NOT saint.gr, WHICH IS THE OBVIOUS SOURCE. It is the right *shape* — the
 * Ορθόδοξος Συναξαριστής is organised by exactly the day-to-saint mapping this
 * calendar uses, and its images are real Orthodox icons rather than whatever a
 * search engine returns. But its own notice says the site is private, offered
 * "αποκλειστικά και μόνο για ενημερωτικούς σκοπούς" (solely for informational
 * purposes), and asks to be told if it has unintentionally infringed anyone's
 * rights. That is a takedown request, not a licence — it is the site telling you
 * it cannot vouch for what it hosts. Copying its images into this app would be
 * republishing third-party material without permission, under a parish's name.
 * Its date index is still useful for identifying WHO a commemoration is; its
 * files are not ours to ship.
 *
 * SO THE CHAIN IS: title -> Wikidata entity -> its designated image and Commons
 * category -> licence filter. Wikidata beats free-text image search because it
 * returns an entity with a DESCRIPTION, which is the only cheap way to catch a
 * confident wrong answer: "Gordius of Cappadocia" resolves to a Cappadocian
 * assassin and ambassador, who is not the martyr Gordias. Descriptions that do
 * not read hagiographically are rejected before any image is fetched.
 *
 * NOT EVERY COMMEMORATION IS A DEPICTED SUBJECT. "12th Sunday of Luke",
 * "Apodosis of Theophany" and "Independence Movement Day" name occasions, not
 * people; matching them yields plausible nonsense, so they are skipped.
 *
 *   node scripts/collect-icons.mjs --limit 40      a sample, for judging quality
 *   node scripts/collect-icons.mjs                 everything
 *
 * Resumable: a commemoration already searched is skipped, so this can be
 * interrupted freely.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, '..', 'orthodox-korea-calendar', 'public', 'data', '2026_en.json');
const OUT_DIR = path.join(ROOT, 'icons');
const CANDIDATES = path.join(OUT_DIR, 'candidates.json');

const UA = 'OrthodoxKoreaCalendar/1.0 (liturgical calendar app; leontg@proton.me)';
const DELAY_MS = 300;
const MAX_CANDIDATES = 6;

/** Licences we will actually ship. Anything else is dropped, not flagged. */
const ALLOWED = /public domain|^cc0|^pd(-|$)|no known copyright/i;

/**
 * A Wikidata description has to read like a person the Church commemorates, or
 * the match is wrong however confident the search was. This is deliberately
 * generous — a false reject costs one blank day, a false accept ships a stranger
 * as a saint.
 */
const HAGIOGRAPHIC =
  /saint|martyr|bishop|archbishop|patriarch|monk|nun|abbot|abbess|hermit|ascetic|apostle|evangelist|prophet|confessor|hieromartyr|theologian|church father|christian|orthodox|pope|deacon|presbyter|missionary|hymnographer|wonderworker|feast|virgin mary|theotokos|jesus|christ/i;

/** Occasions rather than depicted subjects. */
const NOT_DEPICTED = [
  /\bsunday (before|after)\b/i,
  /\b\d+(st|nd|rd|th) sunday\b/i,
  /\bapodosis\b/i,
  /\bgreat hours\b/i,
  /\bforefeast\b/i,
  /\bleavetaking\b/i,
  /\bsaturday of\b/i,
  /\bmemorial saturday\b/i,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 80)}`);
  return res.json();
}

/**
 * A commemoration's title carries its role ("the Martyr", "Bishop of Caesarea"),
 * which helps a reader and hurts a lookup. Try the title as written first, then
 * progressively barer forms.
 */
function lookupNames(title) {
  const full = title.replace(/\s+/g, ' ').trim();
  const out = new Set([full]);

  // "Gregory Bishop of Nyssa" -> "Gregory of Nyssa". This one rewrite is what
  // takes the hit rate from a fifth to most of the calendar: the canonical form
  // of an Orthodox saint's name is almost always "Name of Place", and the office
  // sitting between the two is exactly what stopped the lookup matching it.
  const asOf = (t) =>
    t.replace(
      /\b(bishop|archbishop|patriarch|pope|abbot|abbess|priest|deacon|presbyter)\s+of\b/gi,
      'of',
    );
  out.add(asOf(full));

  const noEpithet = full
    .replace(
      /\bthe (great|younger|elder|new|confessor|wonderworker|theologian|syrian|athonite|hagiorite|leper|presbyter|monastic|martyr|hieromartyr|righteous|queen|apostle|prophet|deacon)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  out.add(noEpithet);
  out.add(asOf(noEpithet));

  // "Name ... of Place" reduced to just those two, dropping everything between.
  const m = full.match(/^([A-Z][\w'’-]+)\b.*?\bof\s+([A-Z][\w'’-]+)/);
  if (m) out.add(`${m[1]} of ${m[2]}`);

  // A companion list ("Hermilus, Stratonicus the Martyrs") is searched by its
  // first member; the rest are the same commemoration.
  out.add(full.split(/\s*[,&]/)[0].trim());

  return [...out].filter((n) => n.length > 2);
}

/**
 * Does this entity plausibly denote the saint the calendar means?
 *
 * The description alone is not enough. "Gregory Bishop of Nyssa" matched Pope
 * Gregory I — description "64th Bishop of Rome", which contains "bishop" and so
 * sailed through a keyword test. So when a title names a place or epithet after
 * "of", the entity has to acknowledge it somewhere. Pope Gregory says nothing
 * about Nyssa and is rejected; Basil of Caesarea says Caesarea and is kept.
 *
 * This will reject some correct matches whose entity happens not to mention the
 * place. That is the right way to be wrong: a blank day costs a reader nothing,
 * and a stranger presented as their saint costs them something real.
 */
function plausible(title, hit) {
  const desc = hit.description ?? '';
  if (!HAGIOGRAPHIC.test(desc)) return false;
  const place = title.match(/\bof\s+([A-Z][\w'’-]+)/);
  if (place) {
    const needle = place[1].toLowerCase();
    if (!`${hit.label ?? ''} ${desc}`.toLowerCase().includes(needle)) return false;
  }
  return true;
}

async function resolveEntity(title) {
  for (const name of lookupNames(title)) {
    const s = await json(
      'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=5&search=' +
        encodeURIComponent(name),
    );
    await sleep(DELAY_MS);
    for (const hit of s.search ?? []) {
      if (!plausible(title, hit)) continue;
      return { qid: hit.id, label: hit.label, description: hit.description ?? '', matchedOn: name };
    }
  }
  return null;
}

async function imagesFor(entity) {
  const e = await json(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${entity.qid}&props=claims`,
  );
  await sleep(DELAY_MS);
  const claims = e.entities?.[entity.qid]?.claims ?? {};
  const files = [];
  // P18 image, then P373 Commons category members. The designated image first:
  // it is the one editors chose to represent the subject.
  for (const prop of ['P18']) {
    for (const c of claims[prop] ?? []) {
      const v = c.mainsnak?.datavalue?.value;
      if (typeof v === 'string') files.push(`File:${v}`);
    }
  }
  const category = claims.P373?.[0]?.mainsnak?.datavalue?.value;
  if (category && files.length < MAX_CANDIDATES) {
    try {
      const m = await json(
        'https://commons.wikimedia.org/w/api.php?action=query&format=json&list=categorymembers' +
          `&cmtitle=${encodeURIComponent('Category:' + category)}&cmtype=file&cmlimit=${MAX_CANDIDATES * 2}`,
      );
      await sleep(DELAY_MS);
      for (const item of m.query?.categorymembers ?? []) files.push(item.title);
    } catch {
      /* a missing category is not an error */
    }
  }
  return [...new Set(files)].slice(0, MAX_CANDIDATES * 2);
}

async function describeFiles(titles) {
  if (!titles.length) return [];
  const out = [];
  // Commons allows up to 50 titles per imageinfo call.
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const d = await json(
      'https://commons.wikimedia.org/w/api.php?action=query&format=json' +
        `&titles=${encodeURIComponent(batch.join('|'))}` +
        '&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=400',
    );
    await sleep(DELAY_MS);
    for (const p of Object.values(d.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const em = ii.extmetadata ?? {};
      const val = (k) => em[k]?.value?.replace(/<[^>]*>/g, '').trim() ?? '';
      out.push({
        commonsTitle: p.title,
        pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        fileUrl: ii.url,
        thumbUrl: ii.thumburl,
        width: ii.width,
        height: ii.height,
        license: val('LicenseShortName'),
        usageTerms: val('UsageTerms'),
        author: val('Artist'),
        credit: val('Credit'),
      });
    }
  }
  return out;
}

function shippable(c) {
  if (!c.fileUrl || !c.thumbUrl) return false;
  if (!ALLOWED.test(c.license || '') && !ALLOWED.test(c.usageTerms || '')) return false;
  if (/\.(svg|ogv|webm|pdf|tif)$/i.test(c.commonsTitle)) return false;
  // An icon is a portrait panel. A wide banner or a thin strip is something else
  // — a church exterior, a manuscript page, a map.
  if (c.width && c.height) {
    const ratio = c.width / c.height;
    if (ratio < 0.5 || ratio > 1.35) return false;
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const li = args.indexOf('--limit');
  const limit = li >= 0 ? Number(args[li + 1]) : Infinity;

  if (!fs.existsSync(SOURCE)) {
    console.error(`Source of truth not found: ${SOURCE}`);
    console.error('This reads the webapp repo checked out beside this one.');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const days = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const subjects = [];
  const skipped = [];
  const seen = new Set();
  for (const day of days) {
    for (const entry of day.content ?? []) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      const f = entry.fields ?? {};
      const title = f.title ?? '';
      if (f.celeb) {
        skipped.push({ id: entry.id, title, why: 'civil observance' });
      } else if (NOT_DEPICTED.some((re) => re.test(title))) {
        skipped.push({ id: entry.id, title, why: 'liturgical occasion, not a depicted subject' });
      } else {
        subjects.push({ id: entry.id, title, highRank: !!f.high_rank, date: day.date });
      }
    }
  }

  const store = fs.existsSync(CANDIDATES) ? JSON.parse(fs.readFileSync(CANDIDATES, 'utf8')) : {};
  const pending = subjects.filter((s) => !store[s.id]);
  const todo = pending.slice(0, limit);

  console.log(`depictable commemorations : ${subjects.length}   (skipped ${skipped.length})`);
  console.log(`already searched          : ${subjects.length - pending.length}`);
  console.log(`searching now             : ${todo.length}\n`);

  let found = 0;
  let unmatched = 0;
  for (const [i, subject] of todo.entries()) {
    let entity = null;
    let candidates = [];
    try {
      entity = await resolveEntity(subject.title);
      if (entity) candidates = (await describeFiles(await imagesFor(entity))).filter(shippable);
    } catch (err) {
      console.warn(`  ! ${subject.title}: ${err.message}`);
    }
    candidates = candidates.slice(0, MAX_CANDIDATES);
    store[subject.id] = { ...subject, entity, candidates };
    if (candidates.length) found++;
    else unmatched++;
    const mark = candidates.length ? String(candidates.length).padStart(2) : ' –';
    const who = entity ? `${entity.qid} ${entity.description.slice(0, 34)}` : 'no entity';
    console.log(
      `  ${String(i + 1).padStart(3)}/${todo.length} ${mark}  ${subject.title.slice(0, 40).padEnd(40)} ${who}`,
    );
    if ((i + 1) % 10 === 0) fs.writeFileSync(CANDIDATES, JSON.stringify(store, null, 2));
  }

  fs.writeFileSync(CANDIDATES, JSON.stringify(store, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'skipped.json'), JSON.stringify(skipped, null, 2));
  console.log(
    `\n${found} with candidates, ${unmatched} with none, out of ${todo.length}.` +
      `\nwrote ${path.relative(ROOT, CANDIDATES)}` +
      `\nnext: node scripts/icon-contact-sheet.mjs`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
