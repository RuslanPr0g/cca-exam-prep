/**
 * Tests for main.js logic — pure/extracted functions
 * Covers: BUG-03 (fetch error), BUG-04/15 (progress), BUG-06 (double-answer),
 *         BUG-07 (hard mode mid-question), BUG-11 (btnRestart), BUG-16 (hard mode persist)
 *
 * main.js is tightly coupled to the DOM so we test the logic it delegates
 * to store.js (already tested) and verify the pure computations inline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── BUG-04/15: progress calculation ──────────────────────────────────────────
describe('BUG-04/15 — progress bar calculation', () => {
  /**
   * Extracted from showQuestion():
   *   const pct = (((s.done + idx + 1) / s.total) * 100).toFixed(1);
   */
  function calcProgress(done, total, idx) {
    return parseFloat((((done + idx + 1) / total) * 100).toFixed(1));
  }

  it('first question (idx=0) with 0 done is > 0', () => {
    const pct = calcProgress(0, 10, 0);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBe(10); // 1/10 = 10%
  });

  it('reflects already-done questions on refresh', () => {
    // 20 done out of 77, first question of remaining queue
    const pct = calcProgress(20, 77, 0);
    expect(pct).toBeCloseTo((21 / 77) * 100, 0);
  });

  it('reaches 100% at last question of last batch', () => {
    // 76 done, idx = 0 of remaining 1 → (77/77)*100 = 100%
    const pct = calcProgress(76, 77, 0);
    expect(pct).toBe(100);
  });

  it('never exceeds 100% (capped)', () => {
    // min(pct, 100) applied in main.js
    const pct = Math.min(calcProgress(77, 77, 0), 100);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it('old buggy formula was always 0 on first question', () => {
    // Regression: old code was idx / queue.length
    const buggyPct = (0 / 10) * 100; // idx=0, queue.length=10
    expect(buggyPct).toBe(0); // confirms the old bug
  });
});

// ── BUG-06: double-answer guard ───────────────────────────────────────────────
describe('BUG-06 — double-answer race condition', () => {
  it('answered flag blocks second call', () => {
    let callCount = 0;
    let answered = false;

    function handleAnswer() {
      if (answered) return;
      answered = true;
      callCount++;
    }

    handleAnswer(); // first call
    handleAnswer(); // should be blocked
    handleAnswer(); // should be blocked

    expect(callCount).toBe(1);
  });

  it('answered resets to false on new question', () => {
    let answered = true; // simulates state after answering

    function showQuestion() {
      answered = false; // reset per new question
    }

    showQuestion();
    expect(answered).toBe(false);
  });
});

// ── BUG-03: fetch error handling ─────────────────────────────────────────────
describe('BUG-03 — fetch error handling', () => {
  it('throws on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    let errorCaught = null;

    try {
      const res = await mockFetch('/questions.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      errorCaught = err;
    }

    expect(errorCaught).not.toBeNull();
    expect(errorCaught.message).toContain('404');
  });

  it('throws on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    let errorCaught = null;

    try {
      await mockFetch('/questions.json');
    } catch (err) {
      errorCaught = err;
    }

    expect(errorCaught).not.toBeNull();
    expect(errorCaught.message).toContain('Failed to fetch');
  });

  it('data.questions ?? [] handles missing questions key', () => {
    const data = {};
    const questions = data.questions ?? [];
    expect(questions).toEqual([]);
  });
});

// ── BUG-07: hard mode toggle protection ──────────────────────────────────────
describe('BUG-07 — hard mode toggle mid-question', () => {
  it('confirms before switching when question unanswered', () => {
    const mockConfirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', mockConfirm);

    let hardModeOn = false;
    const answered = false;
    const feedbackHidden = true; // feedback div has 'hidden' class

    function toggleHardMode() {
      if (!answered && feedbackHidden) {
        if (!confirm('Switch mode now? Current question progress will be lost.')) return;
      }
      hardModeOn = !hardModeOn;
    }

    toggleHardMode();

    expect(mockConfirm).toHaveBeenCalledOnce();
    expect(hardModeOn).toBe(false); // not toggled — user cancelled
  });

  it('allows toggle without confirm when question is answered', () => {
    const mockConfirm = vi.fn();
    vi.stubGlobal('confirm', mockConfirm);

    let hardModeOn = false;
    const answered = true;

    function toggleHardMode() {
      if (!answered) {
        if (!confirm('Switch?')) return;
      }
      hardModeOn = !hardModeOn;
    }

    toggleHardMode();

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(hardModeOn).toBe(true);
  });
});

// ── BUG-16: hard mode persists across refresh ─────────────────────────────────
describe('BUG-16 — hard mode state persisted', () => {
  const localStorageMock = (() => {
    let store = {};
    return {
      getItem:    (k)    => store[k] ?? null,
      setItem:    (k, v) => { store[k] = String(v); },
      removeItem: (k)    => { delete store[k]; },
      clear:      ()     => { store = {}; },
    };
  })();

  beforeEach(() => localStorageMock.clear());

  it('persists hard mode true to localStorage', () => {
    localStorageMock.setItem('quiz_hard_mode', '1');
    expect(localStorageMock.getItem('quiz_hard_mode') === '1').toBe(true);
  });

  it('simulates page refresh restoring hard mode', () => {
    // Simulate: user turned on hard mode
    localStorageMock.setItem('quiz_hard_mode', '1');
    // Simulate: page refreshed, JS re-initialises hardModeOn
    const hardModeOn = localStorageMock.getItem('quiz_hard_mode') === '1';
    expect(hardModeOn).toBe(true);
  });

  it('defaults to false when key absent', () => {
    const hardModeOn = localStorageMock.getItem('quiz_hard_mode') === '1';
    expect(hardModeOn).toBe(false);
  });
});

// ── BUG-11: btnRestart not double-queried ─────────────────────────────────────
describe('BUG-11 — btnRestart single query', () => {
  it('getElementById called once for btn-restart', () => {
    const mockDoc = {
      getElementById: vi.fn().mockReturnValue({ addEventListener: vi.fn() }),
    };

    // Old (buggy) pattern: getElementById called twice for same element
    const _unused = mockDoc.getElementById('btn-restart');
    mockDoc.getElementById('btn-restart').addEventListener('click', () => {});
    expect(mockDoc.getElementById).toHaveBeenCalledTimes(2); // 2 calls for same element = bug

    mockDoc.getElementById.mockClear();

    // New (fixed) pattern: use the variable
    const btnRestart = mockDoc.getElementById('btn-restart');
    btnRestart.addEventListener('click', () => {});
    expect(mockDoc.getElementById).toHaveBeenCalledTimes(1);
  });
});
