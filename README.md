# CCA Exam Prep

A self-hosted, offline-first practice quiz for the **Claude Certified Architect – Foundations (CCA-F)** exam. Vanilla JS, no framework, no backend — questions are static JSON served by Vite, progress is tracked entirely in `localStorage`.

## Why this exists

Certification study tools are usually either a paid SaaS product or a pile of flashcards in a spreadsheet. This is neither: a small, dependency-free app you can run locally, extend with your own questions, and audit end to end in a few hundred lines of code.

## Features

- **Four question modes** — regular and AI-generated question banks, each with a "hard" subset built from questions you bookmark mid-session
- **Persistent progress** — correct answers and bookmarks survive reloads via `localStorage`; a reset control clears state intentionally
- **Zero-backend architecture** — questions are fetched as static JSON (`public/questions.json`, `public/ai-questions.json`); the whole app is deployable as static files
- **Exam-source parser** (`src/parser.js`) — a standalone Node build tool that converts a Markdown exam dump (`public/exam.md`) into the structured JSON the app consumes, decoupling authoring format from runtime format
- **Unit-tested core** — 61 tests across state management, parsing, and UI wiring (`npm test`)

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. To produce a static production build:

```bash
npm run build
npm run preview   # sanity-check the built output
```

## Project layout

```
index.html            entry point; inline critical CSS to avoid a flash of unstyled content
src/
  main.js             UI rendering, event wiring, quiz flow
  store.js            localStorage-backed state (correct/hard sets, active tab), in-memory cached
  parser.js            build-time tool: exam.md -> questions.json (not imported at runtime)
  tests/              vitest suite for store, parser, and main
public/
  questions.json       primary question bank
  ai-questions.json    supplementary AI-generated question bank
  exam.md              raw source markdown consumed by parser.js
reports/
  bug-report.md                     fix log from the initial hardening pass
  ai-questions-authoring-guide.md   format/spec for adding AI-generated questions
```

## Adding questions

- **Regular bank**: edit `public/exam.md` following the format documented at the top of `src/parser.js`, then regenerate with `node src/parser.js > public/questions.json`.
- **AI-generated bank**: edit `public/ai-questions.json` directly, following `reports/ai-questions-authoring-guide.md`.

Each question object requires `id`, `questionText`, `options` (A–D), `correct`, and `explanation`.

## Testing

```bash
npm test          # single run
npm run test:watch
```

## Notes

- The official exam guide PDF used as a reference during authoring is kept out of version control (`private/`, gitignored) since it's third-party copyrighted material — not redistributed here.
- No analytics, no network calls beyond fetching the local JSON question banks. All state is local to the browser.
