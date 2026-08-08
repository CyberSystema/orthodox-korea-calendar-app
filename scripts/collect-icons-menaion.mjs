#!/usr/bin/env node
/**
 * The primary icon source: the engraved menaion plates from Жития святых
 * (the Lives of the Saints in Dimitry of Rostov's recension), Moscow 1903-1911,
 * as re-hosted on Wikimedia Commons.
 *
 * WHY THIS ONE, AFTER SWEEPING SIX SOURCE FAMILIES. It is the only source that
 * is right on all four axes at once:
 *
 *   LICENCE   749 of 749 plates report extmetadata License = "pd". Not "probably
 *             old" — a single 1903-1911 publication, out of copyright as a whole,
 *             with uniform documented provenance. It passes the gate BY
 *             CONSTRUCTION rather than file by file, which is a different and
 *             much stronger thing. Compare the per-saint Commons route, where
 *             roughly a THIRD of P18 images are ShareAlike and would quietly
 *             poison a build.
 *   DATE      The filename carries a church-year code: 01011 is 1 September,
 *             12011 is 1 August. So a plate is matched to a commemoration by
 *             CALENDAR DATE first and name second, and a wrong match has to be
 *             wrong on the same day — which is why date-gated matching audited at
 *             zero false positives where name-only matching produced a battleship,
 *             a river and a video game.
 *   SHAPE     100% portrait, 94% at least 500px on the short edge. The Menologion
 *             of Basil II, the other great date-organised source, is 95%
 *             landscape strips and covers only September to February.
 *   COST      One corpus fetch of two requests, then no network per saint.
 *
 * The church year begins on 1 September, so code month 01 = September through
 * 12 = August. Verified against anchors that cannot be coincidence: Cosmas and
 * Damian at 03-01 and 11-01 (1 November and 1 July, both their feasts), the
 * Maccabees at 12-01 (1 August), Evdokia at 07-01 (1 March), Perpetua at 06-01.
 *
 * Each plate has a caption band at the foot — crop before display, see the
 * publish step. This proposes only; approval happens in the contact sheet.
 *
 *   node scripts/collect-icons-menaion.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, '..', 'orthodox-korea-calendar', 'public', 'data', '2026_en.json');
const OUT_DIR = path.join(ROOT, 'icons');
const STORE = path.join(OUT_DIR, 'candidates-menaion.json');

const UA = 'OrthodoxKoreaCalendar/1.0 (parish calendar app; leontg@proton.me)';
const API = 'https://commons.wikimedia.org/w/api.php';
const PREFIX = 'Жития Святых (1903-1911) - икона';
/** Percent-encoded Cyrillic is long: 50 titles per call silently returns nothing. */
const CHUNK = 15;

/** Church-year month code -> civil month. The year opens on 1 September. */
const CIVIL_MONTH = {
  '01': 9,
  '02': 10,
  '03': 11,
  '04': 12,
  '05': 1,
  '06': 2,
  '07': 3,
  '08': 4,
  '09': 5,
  10: 6,
  11: 7,
  12: 8,
};

/** Cyrillic to Latin, for comparing a Russian plate name to an English title. */
const CYR = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};
const translit = (s) =>
  [...s.toLowerCase()]
    .map((c) => (c in CYR ? CYR[c] : c))
    .join('')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Greek-transliteration conventions differ between the calendar's titles (GOARCH
 * style: Aimilianos, Efthymios, Theodosios) and Russian/Latin forms (Aemilian,
 * Evfimy, Feodosy). Fold both towards a common skeleton so the stems can meet.
 */
const fold = (s) =>
  s
    .toLowerCase()
    .replace(/th/g, 'f')
    .replace(/ph/g, 'f')
    .replace(/ch/g, 'h')
    .replace(/kh/g, 'h')
    .replace(/ios$|os$|us$|as$|is$|y$|ii$|iy$/g, '')
    .replace(/ai/g, 'e')
    .replace(/ei/g, 'i')
    .replace(/ou/g, 'u')
    .replace(/yu/g, 'u')
    .replace(/v/g, 'b')
    .replace(/w/g, 'b')
    .replace(/[^a-z]/g, '');

const STOP = new Set([
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
  'confessor',
  'wonderworker',
]);
const stems = (s) => [
  ...new Set(
    s
      .split(/[\s,&_-]+/)
      .map(fold)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  ),
];

function score(title, plateName) {
  const A = stems(title);
  const B = stems(translit(plateName));
  if (!A.length || !B.length) return 0;
  let hits = 0;
  for (const a of A) {
    for (const b of B) {
      const n = Math.min(a.length, b.length, 5);
      if (a.slice(0, n) === b.slice(0, n)) {
        hits++;
        break;
      }
    }
  }
  return hits / Math.min(A.length, B.length);
}

/** Commons treats spaces and underscores as the same character in a title. */
const norm = (s) => s.replace(/_/g, ' ').trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function corpus() {
  const base = `${API}?action=query&format=json&list=allimages&aiprefix=${encodeURIComponent(PREFIX)}&ailimit=500`;
  const files = [];
  let cont = null;
  do {
    const d = await json(base + (cont ? `&aicontinue=${encodeURIComponent(cont)}` : ''));
    files.push(...(d.query?.allimages ?? []));
    cont = d.continue?.aicontinue ?? null;
    await sleep(200);
  } while (cont);
  return files;
}

async function describe(names) {
  const out = new Map();
  for (let i = 0; i < names.length; i += CHUNK) {
    const batch = names.slice(i, i + CHUNK).map((n) => `File:${n}`);
    const d = await json(
      `${API}?action=query&format=json&titles=${encodeURIComponent(batch.join('|'))}` +
        '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=420' +
        '&iiextmetadatafilter=License|LicenseShortName|UsageTerms|Artist|Credit',
    );
    for (const p of Object.values(d.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const em = ii.extmetadata ?? {};
      const v = (k) => em[k]?.value?.replace(/<[^>]*>/g, '').trim() ?? '';
      // `allimages` gives names with underscores; `titles` echoes them back with
      // spaces. Key on a normalised form or every lookup misses silently — which
      // it did, reporting 0 of 749 public domain when the true answer is 749.
      out.set(norm(p.title.replace(/^File:/, '')), {
        commonsTitle: p.title,
        pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        fileUrl: ii.url,
        thumbUrl: ii.thumburl,
        width: ii.width,
        height: ii.height,
        // The machine-readable code, not the prose. "pd" is the gate.
        licenseCode: v('License'),
        license: v('LicenseShortName') || v('UsageTerms'),
        author: v('Artist'),
        credit: v('Credit'),
      });
    }
    await sleep(200);
    process.stdout.write(`\r  licences ${Math.min(i + CHUNK, names.length)}/${names.length}`);
  }
  process.stdout.write('\n');
  return out;
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source of truth not found: ${SOURCE}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('fetching the plate corpus…');
  const files = await corpus();
  const plates = [];
  for (const f of files) {
    const m = /икона[_ ](\d{2})(\d{2})(\d)[_ ](.+)\.\w+$/.exec(f.name);
    if (!m) continue;
    const [, mm, dd, , name] = m;
    const month = CIVIL_MONTH[mm];
    if (!month) continue;
    plates.push({ file: f.name, month, day: Number(dd), name: name.replace(/_/g, ' ') });
  }
  console.log(`  ${files.length} files, ${plates.length} with a usable date code`);

  const info = await describe(plates.map((p) => p.file));
  let pd = 0;
  for (const p of plates) {
    p.info = info.get(norm(p.file));
    if (p.info?.licenseCode === 'pd') pd++;
  }
  console.log(`  public domain: ${pd}/${plates.length}`);

  const byDate = new Map();
  for (const p of plates) {
    if (p.info?.licenseCode !== 'pd') continue;
    const k = `${p.month}-${p.day}`;
    byDate.set(k, [...(byDate.get(k) ?? []), p]);
  }

  const days = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const store = {};
  let matched = 0;
  let dateOnly = 0;
  for (const day of days) {
    const [, mm, dd] = day.date.split('-').map(Number);
    const sameDay = byDate.get(`${mm}-${dd}`) ?? [];
    if (!sameDay.length) continue;
    for (const entry of day.content ?? []) {
      const title = entry.fields?.title ?? '';
      if (entry.fields?.celeb) continue;
      // DATE-GATED: only plates from this very day are ever offered, so a wrong
      // match must at least be wrong on the right day. Name similarity then only
      // ORDERS them — it never widens the field.
      const ranked = sameDay.map((p) => ({ p, s: score(title, p.name) })).sort((a, b) => b.s - a.s);
      store[entry.id] = {
        id: entry.id,
        title,
        date: day.date,
        highRank: !!entry.fields?.high_rank,
        candidates: ranked.slice(0, 6).map(({ p, s }) => ({
          ...p.info,
          source: 'menaion-1903',
          label: `${p.name}  ·  ${p.month}/${p.day}`,
          nameScore: Number(s.toFixed(2)),
        })),
      };
      matched++;
      if (ranked[0].s === 0) dateOnly++;
    }
  }

  fs.writeFileSync(STORE, JSON.stringify(store, null, 2));
  console.log(
    `\ncommemorations offered a plate : ${matched} of 590` +
      `\n  with a name agreement        : ${matched - dateOnly}` +
      `\n  date-only (review carefully) : ${dateOnly}` +
      `\nwrote ${path.relative(ROOT, STORE)}` +
      `\nnext: node scripts/icon-contact-sheet.mjs`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
