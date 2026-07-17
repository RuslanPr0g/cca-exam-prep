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
  setPersistedTab, // still persisted for any future non-URL entry point
  getGuideReadIds,
  isGuideRead,
  toggleGuideRead,
  getGuideLast,
  setGuideLast,
} from './store.js';
import { renderMarkdown, splitChapters } from './markdown.js';

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
  'random':        { label: '🎲 Random',       title: 'Random mix of all questions' },
};
const TABS = Object.keys(TAB_META);

function tabSource(tab) { return tab.startsWith('ai') ? 'ai' : 'standard'; }
function tabIsHard(tab)  { return tab.endsWith('-hard'); }
function tabIsRandom(tab) { return tab === 'random'; }

// ── URL routing ───────────────────────────────────────────────────────────────
// Random is the default: bare root, or any path that doesn't match one of the
// routes below, resolves to 'random'. The catch-all also covers direct/deep
// links on GitHub Pages, which 404s server-side for any path but the site
// root — see public/404.html, which redirects those straight to /random.
// The Study Guide ('guide') is a routable tab too, but it is deliberately NOT
// in TAB_META above: TAB_META drives the quiz question-set machinery (queues,
// stats, empty-state shortcuts), and the guide renders its own screen instead.
const TAB_ROUTES = {
  'standard':      'regular',
  'standard-hard': 'regular-hard',
  'ai':            'ai',
  'ai-hard':       'ai-hard',
  'random':        'random',
  'guide':         'guide',
};
const ROUTE_TABS = Object.fromEntries(
  Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab])
);

function routeFromTab(tab) { return TAB_ROUTES[tab] ?? 'random'; }

function currentRoute() {
  // A direct/refreshed visit to a pretty path (e.g. /random) 404s server-side
  // on GitHub Pages and gets redirected here via public/404.html, which packs
  // the route it couldn't serve into `?route=` on the real root URL instead.
  // That takes priority over the pathname whenever present.
  const fromQuery = new URLSearchParams(location.search).get('route');
  if (fromQuery !== null) return fromQuery.replace(/^\/+|\/+$/g, '');

  const base = import.meta.env.BASE_URL; // e.g. '/cca-exam-prep/'
  let path = location.pathname;
  if (path.startsWith(base)) path = path.slice(base.length);
  return path.replace(/^\/+|\/+$/g, ''); // '' for bare root
}

function tabFromRoute(route) { return ROUTE_TABS[route] ?? 'random'; }

function urlForTab(tab) { return `${import.meta.env.BASE_URL}${routeFromTab(tab)}`; }

// ── DOM refs ──────────────────────────────────────────────────────────────────
const screenLoading = document.getElementById('screen-loading');
const screenEmpty   = document.getElementById('screen-empty');
const screenQuiz    = document.getElementById('screen-quiz');
const screenGuide   = document.getElementById('screen-guide');

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

// Study Guide refs
const guideLayout    = document.getElementById('guide-layout');
const guideTocList   = document.getElementById('guide-toc-list');
const guideTocCount  = document.getElementById('guide-toc-count');
const guideProgress  = document.getElementById('guide-progress-bar');
const guideContent   = document.getElementById('guide-content');
const guideMarkRead  = document.getElementById('guide-mark-read');
const guideBack      = document.getElementById('guide-back');
const guidePrev      = document.getElementById('guide-prev');
const guideNext      = document.getElementById('guide-next');

// ── State ─────────────────────────────────────────────────────────────────────
let allQuestions = [];
let aiQuestions  = [];
let queue        = [];
let current      = null;
let currentIndex = 0;
// The URL is the source of truth for which tab is active (not localStorage —
// see TAB_ROUTES above): bare/unrecognized paths default to 'random'.
let activeTab    = tabFromRoute(currentRoute());
let answered     = false; // BUG-06: guard against double-answer race

// Study Guide state (lazily loaded the first time the Guide tab is opened).
let guideChapters = [];
let guideLoaded   = false;
let guideCurrentId = null;

// ── Tab / question-set helpers ────────────────────────────────────────────────
function getSourceQuestions(tab) {
  if (tabIsRandom(tab)) return [...allQuestions, ...aiQuestions];
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
  // Canonicalize the URL up front: bare root or anything unrecognized becomes
  // /random so the address bar always matches the tab actually shown.
  history.replaceState({ tab: activeTab }, '', urlForTab(activeTab));

  try {
    // BUG-03: handle fetch errors gracefully
    const res = await fetch(`${import.meta.env.BASE_URL}questions.json`);
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
    const aiRes = await fetch(`${import.meta.env.BASE_URL}ai-questions.json`);
    if (!aiRes.ok) throw new Error(`HTTP ${aiRes.status}`);
    const aiData = await aiRes.json();
    aiQuestions = aiData.questions ?? [];
  } catch (err) {
    console.warn('Failed to load AI-generated questions:', err);
    aiQuestions = [];
  }

  updateTabUI();
  showActiveTab();
}

// Route the active tab to its screen: the Study Guide renders its own reading
// view, every other tab runs the quiz queue.
function showActiveTab() {
  if (activeTab === 'guide') showGuide();
  else rebuildQueue();
}

function updateStats() {
  if (activeTab === 'guide') { updateGuideStats(); return; }
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
  // Widen the layout for the Guide's two-pane reading view (see .guide-active
  // in style.css); quiz tabs keep the narrow single-column width.
  document.body.classList.toggle('guide-active', activeTab === 'guide');
  // .ai-mode is decided per-question in showQuestion() now, not per-tab —
  // Random mixes both sources, so a tab-level decision would be wrong there.
}

function showScreen(name) {
  // Native `hidden` property (not a CSS class) — the browser hides these by
  // default via its own UA stylesheet, so screens can never flash stacked
  // together even before any author stylesheet has loaded.
  screenLoading.hidden = true;
  screenEmpty.hidden   = true;
  screenQuiz.hidden    = true;
  screenGuide.hidden   = true;

  if (name === 'loading') screenLoading.hidden = false;
  if (name === 'empty')   screenEmpty.hidden   = false;
  if (name === 'quiz')    screenQuiz.hidden    = false;
  if (name === 'guide')   screenGuide.hidden   = false;
}

// Single rebuild path for every tab switch / "next question at end of queue"
// case — replaces the old buildHardQueue()/toggleHardMode()/toggleAiMode()
// trio that each rebuilt the queue and set the empty message separately.
function rebuildQueue() {
  // Hard tabs are a standing review list — bookmark a question hard and it
  // stays visible there even after you've answered it correctly elsewhere.
  // Every other tab (including Random) still hides a question once correct.
  queue = buildQueue(getTabBaseQuestions(activeTab), { excludeCorrect: !tabIsHard(activeTab) });
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
      : tabIsRandom(activeTab)
        ? 'You answered every regular and AI question correctly. 🎉'
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

  // Random mixes both sources, so "is this an AI question" has to be decided
  // per-question (via the explicit `source` field on AI rows), not per-tab.
  const isAiQuestion = current.source === 'ai';
  questionCard.classList.toggle('ai-mode', isAiQuestion);

  // Random has "no count or order" by design — hide the progress bar and
  // queue position, which are both about sequence through a fixed set.
  const progressWrap = document.querySelector('.progress-wrap');
  const positionEl    = document.getElementById('q-position');
  progressWrap.hidden = tabIsRandom(activeTab);

  if (!tabIsRandom(activeTab)) {
    // BUG-04/BUG-15: use 1-based index so bar is never 0% and reflects real progress
    const s   = getStats(getTabBaseQuestions(activeTab));
    const pct = s.total === 0 ? 0 : (((s.done + idx + 1) / s.total) * 100).toFixed(1);
    progressBar.style.width = `${Math.min(pct, 100)}%`;
    positionEl.textContent = `${idx + 1} / ${queue.length}`;
  } else {
    positionEl.textContent = '';
  }

  // Q label (AI-generated questions get their own label instead of a domain number)
  qLabel.textContent = isAiQuestion
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

  // Hide feedback (position already set above)
  feedbackDiv.hidden = true;
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
  history.pushState({ tab }, '', urlForTab(tab));
  updateTabUI();
  showActiveTab();
}

// Back/forward navigation between tab URLs — re-sync state from the URL
// rather than trusting event.state, so it still works if the entry was typed
// or opened directly rather than pushed by switchTab().
window.addEventListener('popstate', () => {
  const tab = tabFromRoute(currentRoute());
  if (tab === activeTab) return;
  activeTab = tab;
  updateTabUI();
  showActiveTab();
});

// ── Study Guide ─────────────────────────────────────────────────────────────
// The guide is a big Markdown document (public/guide.md) split into chapters.
// It's fetched and parsed lazily the first time the tab is opened, then read
// per-chapter with read-state persisted in localStorage (see store.js).

async function showGuide() {
  showScreen('guide');

  if (!guideLoaded) {
    guideContent.innerHTML = '<div class="guide-loading"><div class="spinner"></div><p>Loading study guide…</p></div>';
    await loadGuide();
    // Bail if the user switched tabs while the fetch was in flight.
    if (activeTab !== 'guide') return;
  }

  if (guideChapters.length === 0) {
    guideContent.innerHTML = '<p class="guide-error">⚠️ Failed to load the study guide. Please refresh.</p>';
    updateGuideStats();
    return;
  }

  buildToc();
  updateGuideStats();

  // Resume at the last-opened chapter if it still exists, else the first one.
  const last = getGuideLast();
  const startId = guideChapters.some(c => c.id === last) ? last : guideChapters[0].id;
  // openReader:false — on mobile this leaves the chapter list showing rather
  // than jumping straight into the reader (desktop shows both panes anyway).
  selectChapter(startId, { openReader: false });
}

async function loadGuide() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}guide.md`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    guideChapters = splitChapters(md);
  } catch (err) {
    console.error('Failed to load study guide:', err);
    guideChapters = [];
  }
  guideLoaded = true;
}

function buildToc() {
  guideTocList.innerHTML = '';
  guideChapters.forEach((ch, idx) => {
    const li = document.createElement('li');
    li.className = 'guide-toc-item';
    li.dataset.id = ch.id;
    if (ch.id === guideCurrentId) li.classList.add('active');
    if (isGuideRead(ch.id))       li.classList.add('read');

    const check = document.createElement('button');
    check.className = 'guide-toc-check';
    check.title = 'Mark chapter as read';
    check.textContent = isGuideRead(ch.id) ? '✓' : '○';
    check.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGuideRead(ch.id);
      refreshGuideReadUI();
    });

    const link = document.createElement('button');
    link.className = 'guide-toc-link';
    link.innerHTML = `<span class="guide-toc-num">${idx + 1}</span><span class="guide-toc-text">${escapeText(ch.title)}</span>`;
    link.addEventListener('click', () => selectChapter(ch.id, { openReader: true }));

    li.appendChild(check);
    li.appendChild(link);
    guideTocList.appendChild(li);
  });
}

// Refresh only the parts that depend on read-state (TOC ticks, progress bar,
// header count, mark-read button) without re-selecting the chapter.
function refreshGuideReadUI() {
  Array.from(guideTocList.children).forEach(li => {
    const read = isGuideRead(li.dataset.id);
    li.classList.toggle('read', read);
    const check = li.querySelector('.guide-toc-check');
    if (check) check.textContent = read ? '✓' : '○';
  });
  setMarkReadButton();
  updateGuideStats();
}

function updateGuideStats() {
  const total = guideChapters.length;
  const read = guideChapters.filter(c => isGuideRead(c.id)).length;
  const pct = total === 0 ? 0 : (read / total) * 100;
  guideProgress.style.width = `${pct}%`;
  guideTocCount.textContent = `${read} / ${total} read`;
  statsEl.innerHTML = `<span class="stat-item"><strong>${read}</strong> / ${total} read</span>`;
}

function selectChapter(id, { openReader = false } = {}) {
  const ch = guideChapters.find(c => c.id === id);
  if (!ch) return;

  guideCurrentId = id;
  setGuideLast(id);

  guideContent.innerHTML = renderMarkdown(ch.markdown);
  guideContent.scrollTop = 0;

  // Highlight the active chapter in the TOC.
  Array.from(guideTocList.children).forEach(li => {
    li.classList.toggle('active', li.dataset.id === id);
  });

  // Prev/Next availability.
  const idx = guideChapters.findIndex(c => c.id === id);
  guidePrev.disabled = idx <= 0;
  guideNext.disabled = idx >= guideChapters.length - 1;

  setMarkReadButton();

  // On mobile, swap the single column from the chapter list to the reader.
  if (openReader) guideLayout.classList.add('reading');
}

function setMarkReadButton() {
  const read = guideCurrentId != null && isGuideRead(guideCurrentId);
  guideMarkRead.classList.toggle('is-read', read);
  guideMarkRead.textContent = read ? '✓ Read' : 'Mark as read';
}

function handleGuideMarkRead() {
  if (guideCurrentId == null) return;
  toggleGuideRead(guideCurrentId);
  refreshGuideReadUI();
}

function handleGuideNav(delta) {
  const idx = guideChapters.findIndex(c => c.id === guideCurrentId);
  const nextIdx = idx + delta;
  if (nextIdx < 0 || nextIdx >= guideChapters.length) return;
  selectChapter(guideChapters[nextIdx].id, { openReader: true });
}

// Small helper for text inserted via innerHTML in the TOC (titles are already
// markdown-stripped by splitChapters, but escape defensively all the same).
function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

  for (let i = 0; i < 1; i++) {
    const shootingStar = document.createElement('div');
    shootingStar.className = 'shooting-star';
    shootingStar.style.top      = `${Math.random() * 50}%`;
    shootingStar.style.left     = `${Math.random() * 100}%`;
    // Full cycle (streak + hidden gap) is ~60s, so a streak fires roughly once a minute.
    shootingStar.style.animationDuration = `${Math.random() * 20 + 55}s`;
    shootingStar.style.animationDelay    = `${Math.random() * 60}s`;
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

// Study Guide controls
guideMarkRead.addEventListener('click', handleGuideMarkRead);
guidePrev.addEventListener('click', () => handleGuideNav(-1));
guideNext.addEventListener('click', () => handleGuideNav(1));
guideBack.addEventListener('click', () => guideLayout.classList.remove('reading'));

// ── Start ─────────────────────────────────────────────────────────────────────
// Flat space-gradient shows first (see index.html); reveal everything with a
// fade after a short beat rather than popping in the instant the script runs.
setTimeout(() => document.documentElement.classList.add('ready'), 500);
initSpaceBackground();
init();
