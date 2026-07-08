import './style.css';
import {
  buildQueue,
  markCorrect,
  toggleHard,
  isHard,
  resetAll,
  getStats,
  getHardIds,
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
const btnRestart   = document.getElementById('btn-restart');

// ── State ─────────────────────────────────────────────────────────────────────
let allQuestions = [];
let queue        = [];
let current      = null;
let currentIndex = 0;
let hardModeOn   = false;

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const res = await fetch('/questions.json');
  const data = await res.json();
  allQuestions = data.questions;

  queue = buildQueue(allQuestions);

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

function showQuestion(idx) {
  currentIndex = idx;
  current = queue[idx];

  const pct = ((idx / queue.length) * 100).toFixed(1);
  progressBar.style.width = `${pct}%`;

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
  const correct = chosen === current.correct;

  const buttons = optionsList.querySelectorAll('.option-btn');
  buttons.forEach(b => b.disabled = true);

  buttons.forEach(b => {
    const letter = b.dataset.letter;
    if (letter === chosen)              b.classList.add(correct ? 'correct' : 'wrong');
    if (letter === current.correct && letter !== chosen) b.classList.add('reveal');
  });

  feedbackDiv.classList.remove('hidden');
  feedbackHdr.className = 'feedback-header ' + (correct ? 'ok' : 'bad');
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
  const isNowHard = toggleHard(current.id);
  btnBookmark.classList.toggle('is-hard', isNowHard);
  btnBookmark.textContent = isNowHard ? '★' : '☆';
  updateStats();
}

function handleReset() {
  if (!confirm('Reset all progress (correct answers + hard bookmarks)?')) return;
  resetAll();
  location.reload();
}

function buildHardQueue() {
  const hardIds = getHardIds();
  const hardQs = allQuestions.filter(q => hardIds.has(q.id));
  return buildQueue(hardQs);
}

function toggleHardMode() {
  hardModeOn = !hardModeOn;
  btnHardMode.classList.toggle('active', hardModeOn);
  btnHardMode.title = hardModeOn ? 'Exit hard mode' : 'Show hard questions only';

  if (hardModeOn) {
    queue = buildHardQueue();
    if (queue.length === 0) {
      alert('No hard questions marked yet. Bookmark some with ★ first.');
      hardModeOn = false;
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
document.getElementById('btn-restart').addEventListener('click', () => location.reload());
btnHardMode.addEventListener('click', toggleHardMode);

// ── Start ─────────────────────────────────────────────────────────────────────
init();
