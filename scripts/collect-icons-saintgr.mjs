#!/usr/bin/env node
/**
 * Propose icons from saint.gr's day index, matched to our commemorations.
 *
 * THIS PUBLISHES NOTHING. Like the Wikidata collector it only proposes, and
 * everything lands in the same contact sheet for approval.
 *
 * RIGHTS — READ THIS BEFORE PUBLISHING ANYTHING IT FINDS. saint.gr attaches no
 * provenance to its images: no iconographer, no date, no source. Its own notice
 * says the site is private, offered "αποκλειστικά και μόνο για ενημερωτικούς
 * σκοπούς" (solely for informational purposes), and asks to be told if it has
 * unintentionally infringed. So per file, nobody can say what the status is.
 *
 * What CAN be said is which way each one leans, and that is what this script
 * adds. A faithful photograph of a flat, centuries-old icon carries no new
 * copyright — Bridgeman v. Corel in the US, and explicitly across the EU since
 * the 2019 Copyright Directive, Article 14. So an ancient icon is very likely
 * free wherever it is found. A modern one is not: an icon of Paisios of Mount
 * Athos (d. 1994) or Germanos of Alaska as painted today was made by someone who
 * is probably still alive.
 *
 * saint.gr often prints life dates in the name — "Όσιος Παΐσιος ο Αγιορείτης
 * (1924 - 1994)" — so every candidate is tagged `modernSubject` when the person
 * died in or after 1900. The contact sheet shows that tag, which concentrates the
 * decision on the few dozen entries where it actually matters instead of
 * spreading vague unease over all of them.
 *
 * BE A GOOD GUEST. This is a small personal site. Only the SMALL images are
 * fetched, for review; the full-size file (drop the "s" before .jpg) is fetched
 * only for what a human has approved. One request at a time with a real delay,
 * and an honest User-Agent with a contact address.
 *
 *   node scripts/collect-icons-saintgr.mjs --month 8      one month, to judge
 *   node scripts/collect-icons-saintgr.mjs                the year
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, '..', 'orthodox-korea-calendar', 'public', 'data', '2026_en.json');
const OUT_DIR = path.join(ROOT, 'icons');
const STORE = path.join(OUT_DIR, 'candidates-saintgr.json');

const UA = 'OrthodoxKoreaCalendar/1.0 (parish calendar app; leontg@proton.me)';
const DELAY_MS = 1200;

/** Monotonic Greek to Latin, enough for name comparison — not transliteration. */
const GREEK = {
  α: 'a',
  β: 'v',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'i',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o',
  ά: 'a',
  έ: 'e',
  ή: 'i',
  ί: 'i',
  ό: 'o',
  ύ: 'y',
  ώ: 'o',
  ϊ: 'i',
  ϋ: 'y',
  ΐ: 'i',
  ΰ: 'y',
};
const latin = (s) =>
  [...s.toLowerCase()]
    .map((c) => GREEK[c] ?? c)
    .join('')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Words that appear in every title and so distinguish nothing. */
const STOP = new Set([
  'agios',
  'agia',
  'agioi',
  'osios',
  'osia',
  'o',
  'i',
  'to',
  'ton',
  'tis',
  'tou',
  'kai',
  'en',
  'to',
  'saint',
  'holy',
  'the',
  'of',
  'and',
  'martyr',
  'martyrs',
  'bishop',
  'apostle',
  'monastic',
  'great',
  'hieromartyr',
  'patriarch',
  'archbishop',
  'venerable',
  'righteous',
  'prophet',
  'new',
  'from',
]);
const tokens = (s) =>
  new Set(
    latin(s)
      .split(' ')
      .filter((w) => w.length >= 4 && !STOP.has(w)),
  );

/**
 * Two names for the same saint rarely agree letter for letter across languages
 * ("Matthias"/"Ματθίας" -> "matthias", "Germanos"/"Γερμανός" -> "germanos"), but
 * their distinctive stems do. Compare stems, and require a real overlap: within
 * one day there are only a handful of candidates, so a weak match is a wrong one.
 */
function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hits = 0;
  for (const x of A) {
    for (const y of B) {
      const n = Math.min(x.length, y.length, 6);
      if (x.slice(0, n) === y.slice(0, n)) {
        hits++;
        break;
      }
    }
  }
  return hits / Math.min(A.size, B.size);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dayPage(month, day) {
  const url = `https://saint.gr/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/index.aspx`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function parseCards(htmlText) {
  const out = [];
  const seen = new Set();
  const re = /href="\/(\d+)\/saint\.aspx"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(htmlText))) {
    const [, id, inner] = m;
    if (seen.has(id)) continue;
    seen.add(id);
    const img = /src="([^"]+)"/.exec(inner)?.[1];
    if (!img || /nophoto/i.test(img)) continue;
    const name = inner
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const src = img.startsWith('http') ? img : `https://saint.gr${img}`;
    // "…01s.jpg" is the review thumbnail; "…01.jpg" is the full-size original.
    const full = src.replace(/(\d+)s\.jpg$/i, '$1.jpg');
    const years = [...name.matchAll(/\b(1[0-9]{3}|20[0-2][0-9])\b/g)].map((y) => Number(y[1]));
    out.push({
      saintGrId: id,
      greekName: name,
      pageUrl: `https://saint.gr/${id}/saint.aspx`,
      thumbUrl: src,
      fullUrl: full,
      lifeYears: years.length ? years : null,
      // Someone who died in the modern era can only have modern icons, which are
      // the ones whose rights are live. This is the flag that matters.
      modernSubject: years.length ? Math.max(...years) >= 1900 : null,
    });
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const mi = args.indexOf('--month');
  const onlyMonth = mi >= 0 ? Number(args[mi + 1]) : null;

  if (!fs.existsSync(SOURCE)) {
    console.error(`Source of truth not found: ${SOURCE}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const days = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const store = fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, 'utf8')) : {};

  const wanted = days.filter((d) => {
    const [, mm] = d.date.split('-');
    return onlyMonth ? Number(mm) === onlyMonth : true;
  });

  let pages = 0;
  let matched = 0;
  let modern = 0;
  const unmatchedCards = [];

  for (const day of wanted) {
    const [, mm, dd] = day.date.split('-');
    const entries = (day.content ?? []).map((e) => ({ id: e.id, title: e.fields?.title ?? '' }));
    if (!entries.length) continue;
    if (entries.every((e) => store[e.id])) continue;

    let cards;
    try {
      cards = parseCards(await dayPage(Number(mm), Number(dd)));
      pages++;
      await sleep(DELAY_MS);
    } catch (err) {
      console.warn(`  ! ${day.date}: ${err.message}`);
      continue;
    }

    const taken = new Set();
    for (const entry of entries) {
      if (store[entry.id]) continue;
      let best = null;
      let bestScore = 0;
      for (const card of cards) {
        if (taken.has(card.saintGrId)) continue;
        const score = similarity(entry.title, card.greekName);
        if (score > bestScore) {
          bestScore = score;
          best = card;
        }
      }
      // Within one day the field is small; below a half-overlap it is a guess.
      if (best && bestScore >= 0.5) {
        taken.add(best.saintGrId);
        store[entry.id] = {
          ...entry,
          date: day.date,
          score: Number(bestScore.toFixed(2)),
          card: best,
        };
        matched++;
        if (best.modernSubject) modern++;
        const tag = best.modernSubject ? ' [modern]' : '';
        console.log(
          `  ${day.date} ${entry.title.slice(0, 34).padEnd(34)} <- ${best.greekName.slice(0, 40)}${tag}`,
        );
      }
    }
    for (const c of cards)
      if (!taken.has(c.saintGrId)) unmatchedCards.push({ date: day.date, name: c.greekName });
    fs.writeFileSync(STORE, JSON.stringify(store, null, 2));
  }

  fs.writeFileSync(STORE, JSON.stringify(store, null, 2));
  console.log(
    `\npages fetched     : ${pages}` +
      `\nmatched           : ${matched}` +
      `\n  of which modern : ${modern}  (rights are live for these — decide deliberately)` +
      `\nsaint.gr cards we could not match: ${unmatchedCards.length}` +
      `\nwrote ${path.relative(ROOT, STORE)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
