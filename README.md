# CCA Exam Prep

A free practice quiz for the **Claude Certified Architect – Foundations (CCA-F)** exam.

**Live site:** https://ruslanpr0g.github.io/cca-exam-prep/

## What it does

Answer real exam-style multiple-choice questions and get an explanation after every answer — right or wrong. Your progress is saved automatically in your browser, so you can close the tab and pick up where you left off.

- **📘 Regular** — the core question bank
- **⭐ Regular Hard** — questions you bookmarked as tricky, for focused review
- **✨ AI** — a supplementary bank of AI-generated questions covering the same material from different angles
- **✨⭐ AI Hard** — your bookmarked AI questions
- **🎲 Random** — a random mix of every question
- **📖 Guide** — the full study guide to read chapter by chapter, with a table of contents and per-chapter "read" tracking saved in your browser

Bookmark any question mid-quiz with the ☆ button to add it to its "Hard" tab. The ↺ Reset button is scoped to the page you're on — it clears just the Regular questions on the Regular/Regular Hard tabs, just the AI questions on the AI/AI Hard tabs, and just your reading progress on the Guide (Random clears everything, since it mixes both sets).

No account, no sign-up, no tracking — everything lives in your browser.

## Contributing questions

Have a question that should be in the bank, or spotted one that's wrong? Open an issue or a PR. See `reports/ai-questions-authoring-guide.md` for the format used by the AI-generated bank.

The study guide text (`public/guide.md`) comes from [paullarionov/claude-certified-architect](https://github.com/paullarionov/claude-certified-architect).

## Running it locally

```bash
npm install
npm run dev
```

```bash
npm test    # run the test suite
```
