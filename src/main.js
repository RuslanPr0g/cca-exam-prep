import './style.css';
import {
  buildQueue,
  markCorrect,
  toggleHardQuestion,   // BUG-01: renamed from toggleHard to avoid shadowing
  isHard,
  resetAll,
  getStats,
  getHardIds,
  getCorrectIds,
  getPersistedTab, // BUG-16: restore active tab on refresh
  setPersistedTab,
} from './store.js';

// ── Tabs ──────────────────────────────────────────────────────────────────────
// One explicit tab replaces the old two independent toggles (hard mode x
// source). Two orthogonal booleans meant four implicit states, each of which
// needed its own rebuild/empty-message logic kept in sync by hand — that's
// where stale counters and mismatched empty-screen messages crept in. A
// single enum has one rebuild path and nothing to fall out of sync.
const TAB_META = {
  'standard':      { label: '📘 Regular',      title: 'Standard questions' },
  'standard-hard': { label: '⭐ Regular Hard',  title: 'Bookmarked hard questions (regular)' },
  'ai':            { label: '✨ AI',            title: 'AI-generated custom questions' },
  'ai-hard':       { label: '✨⭐ AI Hard',      title: 'Bookmarked hard questions (AI-generated)' },
};
const TABS = Object.keys(TAB_META);

function tabSource(tab) { return tab.startsWith('ai') ? 'ai' : 'standard'; }
function tabIsHard(tab)  { return tab.endsWith('-hard'); }

// ── DOM refs ──────────────────────────────────────────────────────────────────
const screenLoading = document.getElementById('screen-loading');
const screenEmpty   = document.getElementById('screen-empty');
const screenQuiz    = document.getElementById('screen-quiz');

const statsEl      = document.getElementById('stats');
const emptyEmoji   = document.getElementById('empty-emoji');
const emptyTitle   = document.getElementById('empty-title');
const emptyMsg     = document.getElementById('empty-msg');
const emptyActions = document.getElementById('empty-actions');
const progressBar  = document.getElementById('progress-bar');
const qLabel       = document.getElementById('q-label');
const questionText = document.getElementById('question-text');
const optionsList  = document.getElementById('options-list');
const feedbackDiv  = document.getElementById('feedback');
const feedbackHdr  = document.getElementById('feedback-header');
const feedbackExp  = document.getElementById('feedback-explanation');
const btnBookmark  = document.getElementById('btn-bookmark');
const btnNext      = document.getElementById('btn-next');
const btnReset     = document.getElementById('btn-reset');
const questionCard = document.getElementById('question-card');
const tabButtons   = Array.from(document.querySelectorAll('.tab-btn'));

// ── State ─────────────────────────────────────────────────────────────────────
let allQuestions = [];
let aiQuestions  = [];
let queue        = [];
let current      = null;
let currentIndex = 0;
let activeTab    = getPersistedTab(); // BUG-16: restore from localStorage
let answered     = false; // BUG-06: guard against double-answer race

// ── Tab / question-set helpers ────────────────────────────────────────────────
function getSourceQuestions(tab) {
  return tabSource(tab) === 'ai' ? aiQuestions : allQuestions;
}

function getTabBaseQuestions(tab) {
  const source = getSourceQuestions(tab);
  if (!tabIsHard(tab)) return source;
  const hardIds = getHardIds();
  return source.filter(q => hardIds.has(q.id));
}

function hasPending(tab) {
  const correct = getCorrectIds();
  return getTabBaseQuestions(tab).some(q => !correct.has(q.id));
}

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
    emptyEmoji.textContent = '⚠️';
    emptyTitle.textContent = 'Failed to load';
    emptyMsg.textContent = 'Failed to load questions. Please refresh.';
    emptyActions.innerHTML = '';
    return;
  }

  try {
    const aiRes = await fetch('/ai-questions.json');
    if (!aiRes.ok) throw new Error(`HTTP ${aiRes.status}`);
    const aiData = await aiRes.json();
    aiQuestions = aiData.questions ?? [];
  } catch (err) {
    console.warn('Failed to load AI-generated questions:', err);
    aiQuestions = [];
  }

  updateTabUI();
  rebuildQueue();
}

function updateStats() {
  const s = getStats(getTabBaseQuestions(activeTab));
  statsEl.innerHTML = `
    <span class="stat-item"><strong>${s.done}</strong> / ${s.total} done</span>
    <span class="stat-item">⭐ <strong>${s.hard}</strong> hard</span>
  `;
}

function updateTabUI() {
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });
  questionCard.classList.toggle('ai-mode', tabSource(activeTab) === 'ai');
}

function showScreen(name) {
  // Native `hidden` property (not a CSS class) — the browser hides these by
  // default via its own UA stylesheet, so screens can never flash stacked
  // together even before any author stylesheet has loaded.
  screenLoading.hidden = true;
  screenEmpty.hidden   = true;
  screenQuiz.hidden    = true;

  if (name === 'loading') screenLoading.hidden = false;
  if (name === 'empty')   screenEmpty.hidden   = false;
  if (name === 'quiz')    screenQuiz.hidden    = false;
}

// Single rebuild path for every tab switch / "next question at end of queue"
// case — replaces the old buildHardQueue()/toggleHardMode()/toggleAiMode()
// trio that each rebuilt the queue and set the empty message separately.
function rebuildQueue() {
  queue = buildQueue(getTabBaseQuestions(activeTab));
  updateStats();

  if (queue.length === 0) {
    renderEmptyState();
  } else {
    showScreen('quiz');
    showQuestion(0);
  }
}

function renderEmptyState() {
  const isHardTab = tabIsHard(activeTab);
  const noBaseQuestions = getTabBaseQuestions(activeTab).length === 0;

  if (noBaseQuestions && isHardTab) {
    emptyEmoji.textContent = '⭐';
    emptyTitle.textContent = 'No hard questions yet';
    emptyMsg.textContent = `You haven't bookmarked any ${tabSource(activeTab) === 'ai' ? 'AI' : 'regular'} questions as hard yet. Open a question and tap ☆ to bookmark it.`;
  } else if (noBaseQuestions) {
    emptyEmoji.textContent = '🚧';
    emptyTitle.textContent = 'Nothing here yet';
    emptyMsg.textContent = 'No questions available in this set yet.';
  } else {
    emptyEmoji.textContent = '🎉';
    emptyTitle.textContent = isHardTab ? 'Hard queue cleared!' : 'All done!';
    emptyMsg.textContent = isHardTab
      ? 'No hard questions left here. Great work!'
      : `You answered all ${tabSource(activeTab) === 'ai' ? 'AI-generated ' : ''}questions correctly. 🎉`;
  }

  // Offer a shortcut into any other tab that still has pending questions.
  const actions = TABS
    .filter(tab => tab !== activeTab && hasPending(tab))
    .map(tab => ({ label: `Go to ${TAB_META[tab].label}`, onClick: () => switchTab(tab) }));
  actions.push({ label: '↺ Reset All Progress', onClick: handleReset, danger: true });

  emptyActions.innerHTML = '';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'btn-primary' + (a.danger ? ' btn-danger' : '');
    btn.textContent = a.label;
    btn.addEventListener('click', a.onClick);
    emptyActions.appendChild(btn);
  });

  showScreen('empty');
}

function showQuestion(idx) {
  currentIndex = idx;
  current      = queue[idx];
  answered     = false; // BUG-06: reset answered flag per question

  // BUG-04/BUG-15: use 1-based index so bar is never 0% and reflects real progress
  const s   = getStats(getTabBaseQuestions(activeTab));
  const pct = s.total === 0 ? 0 : (((s.done + idx + 1) / s.total) * 100).toFixed(1);
  progressBar.style.width = `${Math.min(pct, 100)}%`;

  // Q label (AI-generated questions get their own label instead of a domain number)
  qLabel.textContent = tabSource(activeTab) === 'ai'
    ? `✨ AI Generated · Task ${current.task}`
    : `Q${current.id} · Domain ${current.domain} · Task ${current.task}`;

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
  feedbackDiv.hidden = true;
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

  feedbackDiv.hidden = false;
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
    rebuildQueue();
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

function switchTab(tab) {
  if (tab === activeTab) return;

  activeTab = tab;
  setPersistedTab(tab); // BUG-16: persist across refresh
  updateTabUI();
  rebuildQueue();
}

// ── Space background (fewer stars on narrow viewports, never fully hidden) ──
function initSpaceBackground() {
  const spaceBg = document.getElementById('space-bg');
  if (!spaceBg) return;

  const starCount = window.innerWidth < 700 ? 20 : 50;
  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 3 + 2;
    star.style.top      = `${Math.random() * 100}%`;
    star.style.left     = `${Math.random() * 100}%`;
    star.style.width    = `${size}px`;
    star.style.height   = `${size}px`;
    star.style.animationDuration = `${Math.random() * 20 + 10}s`;
    star.style.animationDelay    = `${Math.random() * 45}s`;
    spaceBg.appendChild(star);
  }

  for (let i = 0; i < 2; i++) {
    const shootingStar = document.createElement('div');
    shootingStar.className = 'shooting-star';
    shootingStar.style.top      = `${Math.random() * 50}%`;
    shootingStar.style.left     = `${Math.random() * 100}%`;
    shootingStar.style.animationDuration = `${Math.random() * 10 + 15}s`;
    shootingStar.style.animationDelay    = `${Math.random() * 56}s`;
    spaceBg.appendChild(shootingStar);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────
btnNext.addEventListener('click', handleNext);
btnBookmark.addEventListener('click', handleToggleHard);
btnReset.addEventListener('click', handleReset);
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Start ─────────────────────────────────────────────────────────────────────
// Flat space-gradient shows first (see index.html); reveal everything with a
// fade after a short beat rather than popping in the instant the script runs.
setTimeout(() => document.documentElement.classList.add('ready'), 500);
initSpaceBackground();
init();
