// ── Storage keys ──────────────────────────────────────────────────────────────
const KEY_CORRECT = 'quiz_correct';   // Set of question IDs answered correctly
const KEY_HARD    = 'quiz_hard';      // Set of question IDs marked as hard

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
export function getCorrectIds()  { return loadSet(KEY_CORRECT); }
export function getHardIds()     { return loadSet(KEY_HARD); }

export function markCorrect(id) {
  const s = loadSet(KEY_CORRECT);
  s.add(id);
  saveSet(KEY_CORRECT, s);
}

export function toggleHard(id) {
  const s = loadSet(KEY_HARD);
  if (s.has(id)) s.delete(id); else s.add(id);
  saveSet(KEY_HARD, s);
  return s.has(id);
}

export function isHard(id)    { return loadSet(KEY_HARD).has(id); }
export function isCorrect(id) { return loadSet(KEY_CORRECT).has(id); }

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
 */
export function buildQueue(allQuestions) {
  const correct = getCorrectIds();
  const pending = allQuestions.filter(q => !correct.has(q.id));
  return shuffle(pending);
}

/** Reset all progress (both correct and hard bookmarks). */
export function resetAll() {
  localStorage.removeItem(KEY_CORRECT);
  localStorage.removeItem(KEY_HARD);
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
