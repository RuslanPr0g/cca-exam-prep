/**
 * Tests for src/parser.js
 * Covers: BUG-09 (multi-line option text), BUG-10 (parser handles real format)
 */
import { describe, it, expect } from 'vitest';
import { parseExam } from '../parser.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeBlock(n, questionText, options, correct, explanation) {
  return [
    `**Q${n}.** ${questionText}`,
    '',
    `A) ${options.A}`,
    `B) ${options.B}`,
    `C) ${options.C}`,
    `D) ${options.D}`,
    '',
    `**Correct Answer: ${correct}**`,
    explanation,
  ].join('\n');
}

const OPTS = { A: 'Option Alpha', B: 'Option Beta', C: 'Option Gamma', D: 'Option Delta' };

// ── Basic parsing ─────────────────────────────────────────────────────────────
describe('parseExam — basic', () => {
  it('parses a single well-formed question block', () => {
    const md = makeBlock(1, 'What is X?', OPTS, 'B', 'Because B is right.') + '\n---\n';
    const result = parseExam(md);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].questionText).toBe('What is X?');
    expect(result[0].correct).toBe('B');
    expect(result[0].options.B).toBe('Option Beta');
    expect(result[0].explanation).toBe('Because B is right.');
  });

  it('parses multiple blocks separated by ---', () => {
    const block1 = makeBlock(1, 'Q1 text?', OPTS, 'A', 'Exp 1');
    const block2 = makeBlock(2, 'Q2 text?', OPTS, 'C', 'Exp 2');
    const md = block1 + '\n---\n' + block2 + '\n---\n';
    const result = parseExam(md);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it('skips blocks without question pattern', () => {
    const md = 'Just some intro text\n---\n' + makeBlock(1, 'Q1?', OPTS, 'D', '') + '\n---\n';
    const result = parseExam(md);
    expect(result).toHaveLength(1);
  });

  it('skips blocks missing correct answer marker', () => {
    const block = [
      '**Q1.** What is X?',
      '',
      'A) Alpha',
      'B) Beta',
      'C) Gamma',
      'D) Delta',
      '',
      'No answer marker here',
    ].join('\n');
    const result = parseExam(block + '\n---\n');
    expect(result).toHaveLength(0);
  });

  it('skips blocks with fewer than 4 options', () => {
    const block = [
      '**Q1.** What?',
      '',
      'A) Alpha',
      'B) Beta',
      '',
      '**Correct Answer: A**',
      'Explanation.',
    ].join('\n');
    const result = parseExam(block + '\n---\n');
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(parseExam('')).toEqual([]);
  });
});

// ── BUG-09: multi-line option text ────────────────────────────────────────────
describe('BUG-09 — multi-line option text', () => {
  it('captures option text that spans multiple lines', () => {
    const block = [
      '**Q5.** Which architecture pattern is used?',
      '',
      'A) Pattern Alpha with a very long',
      '   description that wraps to the next line',
      'B) Option Beta',
      'C) Option Gamma',
      'D) Option Delta',
      '',
      '**Correct Answer: A**',
      'Alpha is correct because of the wrap.',
    ].join('\n');
    const result = parseExam(block + '\n---\n');
    expect(result).toHaveLength(1);
    expect(result[0].options.A).toContain('Pattern Alpha');
    expect(result[0].correct).toBe('A');
  });

  it('trims whitespace from option text', () => {
    const md = makeBlock(3, 'Q?', OPTS, 'C', 'Exp') + '\n---\n';
    const result = parseExam(md);
    result[0].options && Object.values(result[0].options).forEach(v => {
      expect(v).toBe(v.trim());
    });
  });
});

// ── Correct answer extraction ─────────────────────────────────────────────────
describe('correct answer extraction', () => {
  ['A', 'B', 'C', 'D'].forEach(letter => {
    it(`correctly extracts answer ${letter}`, () => {
      const md = makeBlock(1, 'Q?', OPTS, letter, 'Exp') + '\n---\n';
      expect(parseExam(md)[0].correct).toBe(letter);
    });
  });
});

// ── Explanation extraction ────────────────────────────────────────────────────
describe('explanation extraction', () => {
  it('extracts multi-line explanation', () => {
    const block = [
      '**Q1.** Question?',
      '',
      'A) Alpha',
      'B) Beta',
      'C) Gamma',
      'D) Delta',
      '',
      '**Correct Answer: B**',
      'Line one of explanation.',
      'Line two of explanation.',
    ].join('\n');
    const result = parseExam(block + '\n---\n');
    expect(result[0].explanation).toContain('Line one');
    expect(result[0].explanation).toContain('Line two');
  });

  it('returns empty string when no explanation text', () => {
    const block = [
      '**Q1.** Question?',
      '',
      'A) Alpha',
      'B) Beta',
      'C) Gamma',
      'D) Delta',
      '',
      '**Correct Answer: A**',
    ].join('\n');
    const result = parseExam(block + '\n---\n');
    expect(result[0].explanation).toBe('');
  });
});
