// ── Storage keys ──────────────────────────────────────────────────────────────
const KEY_CORRECT   = 'quiz_correct';    // Set of question IDs answered correctly
const KEY_HARD      = 'quiz_hard';       // Set of question IDs marked as hard
const KEY_HARD_MODE = 'quiz_hard_mode';  // BUG-16: persist hard mode toggle

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
  localStorage.removeItem(KEY_HARD_MODE);
  // Bust cache
  _cacheCorrect = null;
  _cacheHard    = null;
}

/** Stats snapshot for the header. */
export function getStats(allQuestions) {
  const correct = getCorrectIds();
  const hard    = getHardIds();
  return {
    total:   allQuestions.length,
    done:    correct.size,
    hard:    hard.size,
    pending: allQuestions.length - correct.size,
  };
}

// ── Hard mode persistence (BUG-16) ───────────────────────────────────────────
export function getPersistedHardMode() {
  return localStorage.getItem(KEY_HARD_MODE) === '1';
}

export function setPersistedHardMode(value) {
  localStorage.setItem(KEY_HARD_MODE, value ? '1' : '0');
}
