/**
 * Tests for src/markdown.js — the Study Guide's runtime Markdown renderer and
 * chapter splitter.
 */
import { describe, it, expect } from 'vitest';
import { renderMarkdown, renderInline, splitChapters } from '../markdown.js';

// ── Inline ────────────────────────────────────────────────────────────────────
describe('renderInline', () => {
  it('renders bold', () => {
    expect(renderInline('a **bold** b')).toBe('a <strong>bold</strong> b');
  });

  it('renders italic', () => {
    expect(renderInline('a *em* b')).toBe('a <em>em</em> b');
  });

  it('renders inline code and escapes its contents', () => {
    expect(renderInline('use `a < b`')).toBe('use <code>a &lt; b</code>');
  });

  it('does not format inside code spans', () => {
    expect(renderInline('`**not bold**`')).toBe('<code>**not bold**</code>');
  });

  it('renders links with safe attributes', () => {
    const html = renderInline('[docs](https://example.com/a)');
    expect(html).toContain('href="https://example.com/a"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('>docs</a>');
  });

  it('escapes raw HTML in plain text', () => {
    expect(renderInline('1 < 2 & 3 > 0')).toBe('1 &lt; 2 &amp; 3 &gt; 0');
  });
});

// ── Blocks ────────────────────────────────────────────────────────────────────
describe('renderMarkdown', () => {
  it('renders headings at the right level', () => {
    expect(renderMarkdown('## Hello')).toBe('<h2>Hello</h2>');
    expect(renderMarkdown('#### Deep')).toBe('<h4>Deep</h4>');
  });

  it('renders paragraphs and joins soft-wrapped lines', () => {
    expect(renderMarkdown('one\ntwo')).toBe('<p>one two</p>');
  });

  it('renders a fenced code block with a language class and escaping', () => {
    const html = renderMarkdown('```json\n{"a": 1 < 2}\n```');
    expect(html).toBe('<pre><code class="lang-json">{"a": 1 &lt; 2}</code></pre>');
  });

  it('does not treat a "#" inside a code fence as a heading', () => {
    const html = renderMarkdown('```bash\n# a comment\n```');
    expect(html).toBe('<pre><code class="lang-bash"># a comment</code></pre>');
  });

  it('renders an unordered list', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('renders an ordered list', () => {
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
  });

  it('renders nested lists', () => {
    const html = renderMarkdown('- a\n   - a1\n   - a2\n- b');
    expect(html).toBe('<ul><li>a<ul><li>a1</li><li>a2</li></ul></li><li>b</li></ul>');
  });

  it('keeps ordered list items separated by blank lines in one list', () => {
    const html = renderMarkdown('1. first\n\n2. second');
    expect(html).toBe('<ol><li>first</li><li>second</li></ol>');
  });

  it('renders a table', () => {
    const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<th>A</th><th>B</th>');
    expect(html).toContain('<td>1</td><td>2</td>');
    expect(html).toContain('<table>');
  });

  it('renders a horizontal rule', () => {
    expect(renderMarkdown('---')).toBe('<hr>');
  });

  it('renders a blockquote', () => {
    expect(renderMarkdown('> quoted')).toBe('<blockquote><p>quoted</p></blockquote>');
  });

  it('stops a paragraph at a following list', () => {
    const html = renderMarkdown('intro line\n- item');
    expect(html).toBe('<p>intro line</p>\n<ul><li>item</li></ul>');
  });
});

// ── Chapter splitting ─────────────────────────────────────────────────────────
describe('splitChapters', () => {
  it('splits on top-level headings', () => {
    const chapters = splitChapters('# One\ntext a\n# Two\ntext b');
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe('One');
    expect(chapters[1].title).toBe('Two');
    expect(chapters[0].markdown).toBe('# One\ntext a');
  });

  it('ignores "#" lines inside code fences', () => {
    const md = '# Real\n```bash\n# not a chapter\n```\nbody';
    const chapters = splitChapters(md);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('Real');
  });

  it('assigns stable slug ids and dedupes collisions', () => {
    const chapters = splitChapters('# Intro\n# Intro');
    expect(chapters[0].id).toBe('intro');
    expect(chapters[1].id).toBe('intro-2');
  });

  it('strips inline markdown from the title', () => {
    const chapters = splitChapters('# Chapter `x` and **y**');
    expect(chapters[0].title).toBe('Chapter x and y');
  });

  it('carries a 0-based index', () => {
    const chapters = splitChapters('# A\n# B\n# C');
    expect(chapters.map(c => c.index)).toEqual([0, 1, 2]);
  });
});
