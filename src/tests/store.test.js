/**
 * Tests for src/store.js
 * Covers: BUG-01/02 (toggleHardQuestion rename + return), BUG-08 (cache),
 *         BUG-16 (active tab persistence), BUG-17 (shuffle/buildQueue)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCorrectIds,
  getHardIds,
  markCorrect,
  toggleHardQuestion,
  isHard,
  isCorrect,
  shuffle,
  buildQueue,
  resetAll,
  resetProgressForIds,
  resetGuide,
  getStats,
  getPersistedTab,
  setPersistedTab,
} from '../store.js';

// ── localStorage mock ─────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store = {};
  return {
    getItem:    (k)    => store[k] ?? null,
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k)    => { delete store[k]; },
    clear:      ()     => { store = {}; },
    _store:     ()     => store,
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

beforeEach(() => {
  localStorageMock.clear();
  // Reset module-level cache between tests by calling resetAll
  resetAll();
});

// ── getCorrectIds / getHardIds ────────────────────────────────────────────────
describe('getCorrectIds', () => {
  it('returns empty set when nothing stored', () => {
    expect(getCorrectIds().size).toBe(0);
  });

  it('returns stored ids', () => {
    localStorageMock.setItem('quiz_correct', JSON.stringify([1, 2, 3]));
    // BUG-08: cache may hold stale value — reset between tests via beforeEach/resetAll
    const ids = getCorrectIds();
    expect(ids.has(1)).toBe(true);
    expect(ids.has(99)).toBe(false);
  });

  it('returns empty set on corrupt JSON (BUG-08 resilience)', () => {
    localStorageMock.setItem('quiz_correct', 'not-json');
    expect(getCorrectIds().size).toBe(0);
  });
});

describe('getHardIds', () => {
  it('returns empty set when nothing stored', () => {
    expect(getHardIds().size).toBe(0);
  });
});

// ── markCorrect ───────────────────────────────────────────────────────────────
describe('markCorrect', () => {
  it('adds id to correct set', () => {
    markCorrect(42);
    expect(getCorrectIds().has(42)).toBe(true);
  });

  it('persists to localStorage', () => {
    markCorrect(7);
    const raw = JSON.parse(localStorageMock.getItem('quiz_correct'));
    expect(raw).toContain(7);
  });

  it('idempotent — marking same id twice keeps it once', () => {
    markCorrect(5);
    markCorrect(5);
    expect(getCorrectIds().size).toBe(1);
  });
});

// ── toggleHardQuestion (BUG-01/02) ───────────────────────────────────────────
describe('toggleHardQuestion', () => {
  it('marks question as hard and returns true', () => {
    const result = toggleHardQuestion(10);
    expect(result).toBe(true);
    expect(getHardIds().has(10)).toBe(true);
  });

  it('unmarks hard question and returns false (BUG-02: correct new-state return)', () => {
    toggleHardQuestion(10); // mark
    const result = toggleHardQuestion(10); // unmark
    expect(result).toBe(false);
    expect(getHardIds().has(10)).toBe(false);
  });

  it('persists to localStorage', () => {
    toggleHardQuestion(99);
    const raw = JSON.parse(localStorageMock.getItem('quiz_hard'));
    expect(raw).toContain(99);
  });
});

// ── isHard / isCorrect ────────────────────────────────────────────────────────
describe('isHard', () => {
  it('returns false for unmarked question', () => {
    expect(isHard(1)).toBe(false);
  });

  it('returns true after marking', () => {
    toggleHardQuestion(1);
    expect(isHard(1)).toBe(true);
  });

  it('returns false after toggling twice', () => {
    toggleHardQuestion(1);
    toggleHardQuestion(1);
    expect(isHard(1)).toBe(false);
  });
});

describe('isCorrect', () => {
  it('returns false before marking', () => {
    expect(isCorrect(3)).toBe(false);
  });

  it('returns true after markCorrect', () => {
    markCorrect(3);
    expect(isCorrect(3)).toBe(true);
  });
});

// ── BUG-08: cache does not serve stale data across write operations ────────────
describe('BUG-08 cache invalidation', () => {
  it('getCorrectIds reflects markCorrect without re-read', () => {
    markCorrect(100);
    expect(getCorrectIds().has(100)).toBe(true);
  });

  it('getHardIds reflects toggleHardQuestion without re-read', () => {
    toggleHardQuestion(200);
    expect(getHardIds().has(200)).toBe(true);
    toggleHardQuestion(200);
    expect(getHardIds().has(200)).toBe(false);
  });

  it('resetAll clears cache so fresh reads return empty', () => {
    markCorrect(1);
    toggleHardQuestion(2);
    resetAll();
    expect(getCorrectIds().size).toBe(0);
    expect(getHardIds().size).toBe(0);
  });
});

// ── shuffle ───────────────────────────────────────────────────────────────────
describe('shuffle', () => {
  it('returns same array reference', () => {
    const arr = [1, 2, 3];
    expect(shuffle(arr)).toBe(arr);
  });

  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle([...arr]);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  it('handles empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(shuffle([42])).toEqual([42]);
  });
});

// ── buildQueue ────────────────────────────────────────────────────────────────
describe('buildQueue', () => {
  const questions = [
    { id: 1, questionText: 'Q1' },
    { id: 2, questionText: 'Q2' },
    { id: 3, questionText: 'Q3' },
  ];

  it('returns all questions when none answered', () => {
    const q = buildQueue(questions);
    expect(q).toHaveLength(3);
  });

  it('excludes already-correct questions', () => {
    markCorrect(1);
    const q = buildQueue(questions);
    expect(q.some(x => x.id === 1)).toBe(false);
    expect(q).toHaveLength(2);
  });

  it('returns empty array when all answered', () => {
    questions.forEach(q => markCorrect(q.id));
    expect(buildQueue(questions)).toHaveLength(0);
  });

  it('excludeCorrect: false includes already-correct questions (Hard tabs standing review list)', () => {
    markCorrect(1);
    const q = buildQueue(questions, { excludeCorrect: false });
    expect(q).toHaveLength(3);
    expect(q.some(x => x.id === 1)).toBe(true);
  });

  it('omitting the options object still defaults to excluding correct questions', () => {
    markCorrect(1);
    const q = buildQueue(questions);
    expect(q).toHaveLength(2);
    expect(q.some(x => x.id === 1)).toBe(false);
  });
});

// ── resetAll ──────────────────────────────────────────────────────────────────
describe('resetAll', () => {
  it('clears correct and hard sets', () => {
    markCorrect(1);
    toggleHardQuestion(2);
    resetAll();
    expect(getCorrectIds().size).toBe(0);
    expect(getHardIds().size).toBe(0);
  });

  it('removes active tab preference (BUG-16)', () => {
    setPersistedTab('ai-hard');
    resetAll();
    expect(getPersistedTab()).toBe('random');
  });
});

// ── resetProgressForIds (scoped reset button) ────────────────────────────────
describe('resetProgressForIds', () => {
  it('clears correct + hard only for the given ids, leaving others intact', () => {
    markCorrect(1);
    markCorrect('ai-1');
    toggleHardQuestion(2);
    toggleHardQuestion('ai-2');

    // Reset only the standard ids — AI progress must survive.
    resetProgressForIds([1, 2]);

    expect(isCorrect(1)).toBe(false);
    expect(isHard(2)).toBe(false);
    expect(isCorrect('ai-1')).toBe(true);
    expect(isHard('ai-2')).toBe(true);
  });

  it('accepts a Set as well as an array', () => {
    markCorrect(5);
    toggleHardQuestion(6);
    resetProgressForIds(new Set([5, 6]));
    expect(isCorrect(5)).toBe(false);
    expect(isHard(6)).toBe(false);
  });

  it('persists the trimmed sets to localStorage', () => {
    markCorrect(1);
    markCorrect(2);
    resetProgressForIds([1]);
    expect(JSON.parse(localStorage.getItem('quiz_correct'))).toEqual([2]);
  });

  it('ignores ids that were never set', () => {
    markCorrect(1);
    resetProgressForIds([99]);
    expect(isCorrect(1)).toBe(true);
  });

  it('does not touch guide reading progress', () => {
    toggleHardQuestion(1);
    localStorage.setItem('guide_read', JSON.stringify(['ch-1']));
    resetProgressForIds([1]);
    expect(JSON.parse(localStorage.getItem('guide_read'))).toEqual(['ch-1']);
  });
});

// ── resetGuide (scoped reset on the Study Guide page) ─────────────────────────
describe('resetGuide', () => {
  it('clears guide read set and resume point, leaving quiz progress intact', () => {
    markCorrect(1);
    toggleHardQuestion(2);
    localStorage.setItem('guide_read', JSON.stringify(['ch-1', 'ch-2']));
    localStorage.setItem('guide_last', 'ch-2');

    resetGuide();

    expect(localStorage.getItem('guide_read')).toBe(null);
    expect(localStorage.getItem('guide_last')).toBe(null);
    expect(isCorrect(1)).toBe(true);
    expect(isHard(2)).toBe(true);
  });
});

// ── getStats ──────────────────────────────────────────────────────────────────
describe('getStats', () => {
  const questions = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));

  it('returns correct totals', () => {
    markCorrect(1);
    markCorrect(2);
    toggleHardQuestion(3);
    const s = getStats(questions);
    expect(s.total).toBe(5);
    expect(s.done).toBe(2);
    expect(s.hard).toBe(1);
    expect(s.pending).toBe(3);
  });
});

// ── BUG-16: active tab persistence ───────────────────────────────────────────
describe('BUG-16 active tab persistence', () => {
  it('getPersistedTab defaults to "random"', () => {
    expect(getPersistedTab()).toBe('random');
  });

  it('setPersistedTab persists across reads', () => {
    setPersistedTab('ai');
    expect(getPersistedTab()).toBe('ai');
  });

  it('falls back to "random" for an invalid/corrupted stored value', () => {
    localStorage.setItem('quiz_tab', 'not-a-real-tab');
    expect(getPersistedTab()).toBe('random');
  });

  it('round-trips every valid tab', () => {
    for (const tab of ['standard', 'standard-hard', 'ai', 'ai-hard', 'random']) {
      setPersistedTab(tab);
      expect(getPersistedTab()).toBe(tab);
    }
  });
});
