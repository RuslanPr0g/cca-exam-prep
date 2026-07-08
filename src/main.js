import './style.css';
import {
  buildQueue,
  markCorrect,
  toggleHardQuestion,   // BUG-01: renamed from toggleHard to avoid shadowing
  isHard,
  resetAll,
  getStats,
  getHardIds,
  getPersistedHardMode, // BUG-16: restore hard mode on refresh
  setPersistedHardMode, // BUG-16
} from './store.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const screenLoading = document.getElementById('screen-loading');
const screenEmpty   = document.getElementById('screen-empty');
const screenQuiz    = document.getElementById('screen-quiz');

const statsEl      = document.getElementById('stats');
const emptyMsg     = document.getElementById('empty-msg');
const progressBar  = document.getElementById('progress-bar');
const qLabel       = document.getElementById('q-label');
const questionText = document.getElementById('question-text');
const optionsList  = document.getElementById('options-list');
const feedbackDiv  = document.getElementById('feedback');
const feedbackHdr  = document.getElementById('feedback-header');
const feedbackExp  = document.getElementById('feedback-explanation');
const btnBookmark  = document.getElementById('btn-bookmark');
const btnNext      = document.getElementById('btn-next');
const btnHardMode  = document.getElementById('btn-hard-mode');
const btnReset     = document.getElementById('btn-reset');
const btnRestart   = document.getElementById('btn-restart'); // BUG-11: use variable, not double getElementById

// ── State ─────────────────────────────────────────────────────────────────────
let allQuestions = [];
let queue        = [];
let current      = null;
let currentIndex = 0;
let hardModeOn   = getPersistedHardMode(); // BUG-16: restore from localStorage
let answered     = false; // BUG-06: guard against double-answer race

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    // BUG-03: handle fetch errors gracefully
    const res = await fetch('/questions.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allQuestions = data.questions ?? [];
  } catch (err) {
    console.error('Failed to load questions:', err);
    showScreen('empty');
    emptyMsg.textContent = 'Failed to load questions. Please refresh.';
    return;
  }

  // BUG-16: restore hard mode button state after refresh
  btnHardMode.classList.toggle('active', hardModeOn);
  btnHardMode.title = hardModeOn ? 'Exit hard mode' : 'Show hard questions only';

  queue = hardModeOn ? buildHardQueue() : buildQueue(allQuestions);

  if (queue.length === 0) {
    showScreen('empty');
  } else {
    showScreen('quiz');
    showQuestion(0);
  }

  updateStats();
}

function updateStats() {
  const s = getStats(allQuestions);
  statsEl.innerHTML = `
    <span class="stat-item"><strong>${s.done}</strong> / ${s.total} done</span>
    <span class="stat-item">⭐ <strong>${s.hard}</strong> hard</span>
  `;
}

function showScreen(name) {
  screenLoading.classList.add('hidden');
  screenEmpty.classList.add('hidden');
  screenQuiz.classList.add('hidden');

  if (name === 'loading') screenLoading.classList.remove('hidden');
  if (name === 'empty')   screenEmpty.classList.remove('hidden');
  if (name === 'quiz')    screenQuiz.classList.remove('hidden');
}

// BUG-05: buildHardQueue defined BEFORE handleNext to avoid hoisting dependency
function buildHardQueue() {
  const hardIds = getHardIds();
  const hardQs  = allQuestions.filter(q => hardIds.has(q.id));
  return buildQueue(hardQs);
}

function showQuestion(idx) {
  currentIndex = idx;
  current      = queue[idx];
  answered     = false; // BUG-06: reset answered flag per question

  // BUG-04/BUG-15: use 1-based index so bar is never 0% and reflects real progress
  const s   = getStats(allQuestions);
  const pct = (((s.done + idx + 1) / s.total) * 100).toFixed(1);
  progressBar.style.width = `${Math.min(pct, 100)}%`;

  // Q label with domain badge
  qLabel.textContent = `Q${current.id} · Domain ${current.domain} · Task ${current.task}`;

  questionText.textContent = current.questionText;

  // Bookmark button
  btnBookmark.classList.toggle('is-hard', isHard(current.id));
  btnBookmark.textContent = isHard(current.id) ? '★' : '☆';

  // Render options
  optionsList.innerHTML = '';
  ['A','B','C','D'].forEach(letter => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.letter = letter;

    const labelDiv = document.createElement('div');
    labelDiv.className = 'option-letter';
    labelDiv.textContent = letter;

    const textDiv = document.createElement('div');
    textDiv.className = 'option-text';
    textDiv.textContent = current.options[letter];

    btn.appendChild(labelDiv);
    btn.appendChild(textDiv);
    btn.addEventListener('click', () => handleAnswer(letter));

    optionsList.appendChild(btn);
  });

  // Hide feedback & show queue position
  feedbackDiv.classList.add('hidden');
  document.getElementById('q-position').textContent =
    `${idx + 1} / ${queue.length}`;
}

function handleAnswer(chosen) {
  // BUG-06: prevent double-answer race condition
  if (answered) return;
  answered = true;

  const correct = chosen === current.correct;

  const buttons = optionsList.querySelectorAll('.option-btn');
  buttons.forEach(b => b.disabled = true);

  buttons.forEach(b => {
    const letter = b.dataset.letter;
    if (letter === chosen)                               b.classList.add(correct ? 'correct' : 'wrong');
    if (letter === current.correct && letter !== chosen) b.classList.add('reveal');
  });

  feedbackDiv.classList.remove('hidden');
  feedbackHdr.className   = 'feedback-header ' + (correct ? 'ok' : 'bad');
  feedbackHdr.textContent = correct
    ? '✓ Correct!'
    : `✗ Wrong — correct answer: ${current.correct}`;
  feedbackExp.textContent = current.explanation;

  if (correct) markCorrect(current.id);
  updateStats();
}

function handleNext() {
  const nextIdx = currentIndex + 1;
  if (nextIdx < queue.length) {
    showQuestion(nextIdx);
  } else {
    queue = hardModeOn ? buildHardQueue() : buildQueue(allQuestions);
    updateStats();
    if (queue.length === 0) {
      emptyMsg.textContent = hardModeOn
        ? 'No hard questions left. Great work!'
        : 'You answered all questions correctly. 🎉';
      showScreen('empty');
    } else {
      showQuestion(0);
    }
  }
}

function handleToggleHard() {
  // BUG-01: calls renamed toggleHardQuestion (not toggleHard) to avoid confusion
  const isNowHard = toggleHardQuestion(current.id);
  btnBookmark.classList.toggle('is-hard', isNowHard);
  btnBookmark.textContent = isNowHard ? '★' : '☆';
  updateStats();
}

function handleReset() {
  if (!confirm('Reset all progress (correct answers + hard bookmarks)?')) return;
  resetAll();
  location.reload();
}

function toggleHardMode() {
  // BUG-07: only allow toggle between questions (not mid-answer before feedback)
  // Queue is rebuilt and navigation jumps to Q0 — warn if mid-question.
  if (!answered && feedbackDiv.classList.contains('hidden') && queue.length > 0) {
    // User hasn't answered current question yet — confirm before discarding it
    if (!confirm('Switch mode now? Current question progress will be lost.')) return;
  }

  hardModeOn = !hardModeOn;
  setPersistedHardMode(hardModeOn); // BUG-16: persist across refresh
  btnHardMode.classList.toggle('active', hardModeOn);
  btnHardMode.title = hardModeOn ? 'Exit hard mode' : 'Show hard questions only';

  if (hardModeOn) {
    queue = buildHardQueue();
    if (queue.length === 0) {
      alert('No hard questions marked yet. Bookmark some with ★ first.');
      hardModeOn = false;
      setPersistedHardMode(false);
      btnHardMode.classList.remove('active');
      return;
    }
  } else {
    queue = buildQueue(allQuestions);
    if (queue.length === 0) { showScreen('empty'); return; }
  }
  showQuestion(0);
}

// ── Event listeners ───────────────────────────────────────────────────────────
btnNext.addEventListener('click', handleNext);
btnBookmark.addEventListener('click', handleToggleHard);
btnReset.addEventListener('click', handleReset);
btnRestart.addEventListener('click', () => location.reload()); // BUG-11: use variable
btnHardMode.addEventListener('click', toggleHardMode);

// ── Start ─────────────────────────────────────────────────────────────────────
init();
