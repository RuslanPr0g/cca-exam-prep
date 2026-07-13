// ── Storage keys ──────────────────────────────────────────────────────────────
const KEY_CORRECT   = 'quiz_correct';    // Set of question IDs answered correctly
const KEY_HARD      = 'quiz_hard';       // Set of question IDs marked as hard
const KEY_TAB       = 'quiz_tab';        // persisted active tab (see VALID_TABS below)

// A single enum of the four question sets replaces two independent booleans
// (hard mode x source). Two orthogonal toggles produce combinations that are
// easy to leave inconsistent (e.g. a stale message from one toggle's branch
// after switching the other); one tab value has no such cross-product to get
// out of sync.
export const VALID_TABS = ['standard', 'standard-hard', 'ai', 'ai-hard'];

// ── In-memory cache (BUG-08) ──────────────────────────────────────────────────
// Avoids redundant JSON.parse on every read within the same interaction.
// Invalidated on every write.
let _cacheCorrect = null;
let _cacheHard    = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
}

function saveSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

// ── Public API ────────────────────────────────────────────────────────────────
export function getCorrectIds() {
  // BUG-08: return cached set, populate on first call
  return (_cacheCorrect ??= loadSet(KEY_CORRECT));
}

export function getHardIds() {
  // BUG-08: return cached set, populate on first call
  return (_cacheHard ??= loadSet(KEY_HARD));
}

export function markCorrect(id) {
  const s = getCorrectIds();
  s.add(id);
  saveSet(KEY_CORRECT, s);
  _cacheCorrect = s; // keep cache in sync
}

/**
 * Toggle the hard-bookmark for a question.
 * BUG-01/02: renamed from `toggleHard` to `toggleHardQuestion` to avoid
 * shadowing confusion with the UI's `toggleHardMode` function.
 * Returns the NEW hard state: true = now marked hard, false = now unmarked.
 */
export function toggleHardQuestion(id) {
  const s = getHardIds();
  if (s.has(id)) {
    s.delete(id);
  } else {
    s.add(id);
  }
  saveSet(KEY_HARD, s);
  _cacheHard = s; // keep cache in sync
  // Explicitly return new state (true = hard, false = not hard)
  return s.has(id);
}

export function isHard(id)    { return getHardIds().has(id); }
export function isCorrect(id) { return getCorrectIds().has(id); }

/** Fisher-Yates shuffle (in-place). Returns array. */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build the active question queue from all parsed questions.
 * - Skip already-correct ones.
 * - Randomise order.
 * BUG-17: Shuffle is intentional — queue order is NOT persisted across
 * refreshes. Questions seen but not answered may reappear in a different
 * order. This is by design for a randomised study tool.
 */
export function buildQueue(questions) {
  const correct = getCorrectIds();
  const pending = questions.filter(q => !correct.has(q.id));
  return shuffle(pending);
}

/** Reset all progress (both correct and hard bookmarks). */
export function resetAll() {
  localStorage.removeItem(KEY_CORRECT);
  localStorage.removeItem(KEY_HARD);
  localStorage.removeItem(KEY_TAB);
  // Bust cache
  _cacheCorrect = null;
  _cacheHard    = null;
}

/**
 * Stats snapshot for the header, scoped to the given question set.
 * Counts must be filtered to `questions` (not read as global set sizes) —
 * otherwise progress from one source (e.g. standard) leaks into another
 * source's stats (e.g. AI-generated) since correct/hard ids are stored in a
 * single shared localStorage set across all sources.
 */
export function getStats(questions) {
  const correct = getCorrectIds();
  const hard    = getHardIds();
  let done = 0;
  let hardCount = 0;
  for (const q of questions) {
    if (correct.has(q.id)) done++;
    if (hard.has(q.id))    hardCount++;
  }
  return {
    total:   questions.length,
    done,
    hard:    hardCount,
    pending: questions.length - done,
  };
}

// ── Active tab persistence (BUG-16) ──────────────────────────────────────────
export function getPersistedTab() {
  const value = localStorage.getItem(KEY_TAB);
  return VALID_TABS.includes(value) ? value : 'standard';
}

export function setPersistedTab(tab) {
  localStorage.setItem(KEY_TAB, tab);
}
