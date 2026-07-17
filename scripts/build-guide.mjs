/**
 * build-guide.mjs — BUILD UTILITY (run at commit time and in `prebuild`).
 *
 * Migrates the study guide from a single Markdown source (content/guide.md)
 * into a set of pre-rendered, static HTML pages — one per chapter — plus a
 * manifest that describes the chapter order and the PART → chapter nesting.
 *
 * Output (all under public/guide/):
 *   - manifest.json          ordered chapters: { id, title, type }
 *   - <chapter-id>.html      the rendered HTML body of each chapter
 *
 * The app fetches these at runtime instead of parsing Markdown in the browser,
 * so what ships is exactly the HTML produced here (tables, code, nesting and
 * all). src/markdown.js is used only here, as a build tool — never at runtime.
 *
 * Usage:  node scripts/build-guide.mjs      (also wired into `npm run prebuild`)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { splitChapters, renderMarkdown } from '../src/markdown.js';

const here    = dirname(fileURLToPath(import.meta.url));
const root    = join(here, '..');
const SRC     = join(root, 'content', 'guide.md');
const OUT_DIR = join(root, 'public', 'guide');

// A PART heading is a section that groups the chapters/domains that follow it.
const isSection = t => /^part\b/i.test(t);
const isChild   = t => /^(chapter|domain)\b/i.test(t);

/**
 * Classify chapters into a nested order. A PART starts a section; the
 * Chapter/Domain headings that immediately follow nest under it as children.
 * Anything else (intro, appendices, exam questions…) sits at the top level.
 */
function classify(chapters) {
  const out = [];
  let inSection = false;
  for (const ch of chapters) {
    let type;
    if (isSection(ch.title)) { type = 'section'; inSection = true; }
    else if (inSection && isChild(ch.title)) { type = 'child'; }
    else { type = 'top'; inSection = false; }
    out.push({ id: ch.id, title: ch.title, type });
  }
  return out;
}

function build() {
  const md = readFileSync(SRC, 'utf8');
  const chapters = splitChapters(md);

  // Safety net for "nothing is missed": splitChapters assigns every line from
  // the first heading onward to exactly one chapter, so re-joining the chapter
  // bodies must reproduce the source verbatim (the guide starts at an H1, so no
  // preamble is dropped). Compare ignoring a trailing-newline difference.
  const norm = s => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  if (norm(chapters.map(c => c.markdown).join('\n')) !== norm(md)) {
    throw new Error('Chapter split does not reproduce the source — content would be lost.');
  }

  // Fresh output dir.
  if (existsSync(OUT_DIR)) {
    for (const f of readdirSync(OUT_DIR)) rmSync(join(OUT_DIR, f));
  } else {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const manifestChapters = classify(chapters);

  for (const ch of chapters) {
    const html = renderMarkdown(ch.markdown);
    writeFileSync(join(OUT_DIR, `${ch.id}.html`), html + '\n', 'utf8');
  }

  const manifest = {
    generatedFrom: 'guide.md',
    generatedAt: new Date().toISOString().slice(0, 10),
    count: chapters.length,
    chapters: manifestChapters,
  };
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`Guide built: ${chapters.length} chapters → public/guide/`);
  const counts = manifestChapters.reduce((a, c) => (a[c.type] = (a[c.type] || 0) + 1, a), {});
  console.log('  types:', JSON.stringify(counts));
}

build();
