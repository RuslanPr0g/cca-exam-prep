# Authoring Guide: 125 High-Difficulty Mock Questions for `public/ai-questions.json`

**Purpose of this document:** a self-contained brief for whoever (human or AI agent) writes the actual question content. It defines the target schema, the domain/task distribution, and — the important part — a concrete, opinionated definition of what makes a multiple-choice question *genuinely hard* versus fake-hard, with worked examples. Reading this document plus `public/exam.md` and `public/questions.json` should be enough to write all 125 questions without needing any other context.

This document does not itself contain the 125 questions. It is the spec for producing them.

---

## 0. Background

This repo is a practice-exam web app for Anthropic's **Claude Certified Architect — Foundations (CCA-F)** certification: a real, partner-gated exam (60 scenario-based multiple-choice questions, 120 minutes, pass at 720/1000) across 5 weighted domains. `public/exam.md` is the authoritative in-repo spec (domain weights, sub-task codes, 6 named exam scenarios, and the full 77-question canonical bank). `public/questions.json` holds those same 77 questions in the app's JSON format — that file is the quality bar for everything below.

`public/ai-questions.json` currently holds exactly **one placeholder stub**:

```json
{
  "id": "ai-1",
  "questionText": "[PLACEHOLDER] Your agentic system occasionally calls a tool with a malformed argument...",
  "domain": 6,
  "domainName": "AI-Generated Custom Questions",
  "task": "AI-1",
  "source": "ai",
  ...
}
```

It uses a fake `domain: 6` that doesn't exist in the real 5-domain taxonomy, and the question text is a literal placeholder, never finished. The goal is to replace this file's contents with **125 real, hard, well-explained questions — 25 per real domain (1 through 5)**.

**Why this matters (the actual problem being solved):** most mock exams — and this stub is a perfect example of the genre — are gameable without any subject knowledge, because the wrong answers are lazy: short, generic, or absurd, while the correct answer is long, specific, and reasonable. A test-taker who has never touched the Claude Agent SDK can still score well by pattern-matching "the detailed one is probably right." That defeats the purpose of practicing. The 125 new questions must not be gameable this way — see §3.

---

## 0.5 Official sources (provenance & calibration)

The primary official artifact is Anthropic's **"Claude Certified Architect – Foundations Exam Guide"**, publicly downloadable as a PDF. A copy of **v1.0 (Effective July 2026, exam code CCAR-F)** is saved in this repo at `reports/cca-f-official-exam-guide-v1.pdf` ([source URL](https://everpath-course-content.s3-accelerate.amazonaws.com/instructor/6nizmqk8tpzpfjvt6qmmav7rh/public/1783542750/Claude+Certified+Architect+%E2%80%93+Foundations+Exam+Guide.pdf)). Provenance chain: `public/exam.md` is retro-engineered from an earlier revision of this same guide (v0.1, Feb 2025 — stated in exam.md's own footer), so exam.md's domain/task taxonomy is grounded in the official blueprint, and the v1.0 PDF confirms it (Domain 1 tasks 1.1–1.7 match exactly, as do the 5 domain names and 27/18/20/20/15% weights).

What the v1.0 guide adds or corrects versus assumptions elsewhere in this document:

- **Item format:** the real exam uses "multiple-choice **and multiple-response** items; each item states how many responses to select." This mock bank deliberately stays 4-option single-correct because that's all the app renders — a known, accepted divergence, don't "fix" it.
- **Exam mechanics:** 60 items, 120 minutes, **4 scenarios drawn at random from a bank of 6** (all questions anchored to scenarios), scaled 100–1,000 with 720 to pass, $125 USD, credential valid 12 months, score report includes percent-correct by domain.
- **Distribution divergence (intentional):** real domain weights are 27/18/20/20/15%, but this bank uses a flat 25 per domain per the project owner's explicit request. Do not rebalance to the official weights.
- **The objectives are distractor gold.** Section 6 of the guide lists, per task, explicit "Knowledge of / Skills in" bullets — including named *anti-patterns* (e.g. for 1.1: "parsing natural language signals to determine loop termination, setting arbitrary iteration caps as the primary stopping mechanism, checking for assistant text content as a completion indicator"). Mine these bullets directly: each named anti-pattern is a ready-made near-miss distractor (§3.2), and each "Skills in" bullet is a ready-made correct answer to build a scenario around.
- **Caveat:** the downloaded 8-page copy contains front matter, the 6 scenarios, and Domain 1's detailed objectives, but cuts off before the later domains' objectives and the sample-questions section the guide's intro promises. For Domains 2–5 objectives, `exam.md`'s Domain-Task Index remains the working reference.

Secondary (unofficial) calibration sources, useful only for style comparison, not as ground truth: [claudecertifications.com's free practice questions](https://claudecertifications.com/claude-certified-architect/practice-questions) and the [claude-architect-exam-prep GitHub repo](https://github.com/avidevelops/claude-architect-exam-prep). Do not copy their questions.

---

## 1. Target JSON schema

Each of the 125 records goes in `public/ai-questions.json`, replacing the single placeholder. Use the **real domain taxonomy** (drop the fake `domain: 6` bucket) and keep `source: "ai"` so the app's existing "AI Generated" tab keeps working without any code changes:

```json
{
  "id": "ai-1",
  "questionText": "...",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correct": "A",
  "explanation": "...",
  "domain": 1,
  "domainName": "Agentic Architecture &amp; Orchestration",
  "task": "1.4",
  "source": "ai"
}
```

Field notes:

- **`id`** — string, `"ai-1"` through `"ai-125"`, sequential, no gaps. Distinguishes these from the numeric `id`s used in `questions.json`.
- **`domain` / `domainName`** — must be one of the 5 real domains, spelled exactly as in `exam.md` / `questions.json` (including the literal `&amp;` HTML entity in `domainName` — keep that convention for consistency, don't "fix" it to a plain `&`):
  1. `Agentic Architecture &amp; Orchestration`
  2. `Tool Design &amp; MCP Integration`
  3. `Claude Code Configuration &amp; Workflows`
  4. `Prompt Engineering &amp; Structured Output`
  5. `Context Management &amp; Reliability`
- **`task`** — a real dotted sub-task code from `exam.md` (e.g. `"2.3"`), not a synthetic code like `"AI-1"`.
- **`correct`** — single letter, must match a key present in `options`.
- **`explanation`** — **must cover all four options**: why the correct one is right, plus why *each* of the three wrong options is wrong, referencing them by letter (see §5). An explanation that only justifies the correct answer is incomplete and must be rejected.
- **`source`** — always `"ai"`.
- Top-level file wrapper: `{ "version": 1, "total": 125, "questions": [ ... ] }`.

**No scenario reuse.** Do not reuse `questionText` scenarios, company names, or specific tool names (`get_customer`, `lookup_order`, etc.) from the 77 questions already in `questions.json`. Every new question needs a fresh scenario — different product, different tool names, different framing — so studying isn't just re-memorizing the same setup twice. Reusing an underlying *concept* across both files (e.g. "programmatic enforcement beats prompt instructions") is fine and expected; reusing the *scenario* that concept was taught through is not.

---

## 2. Domain × task distribution (25 questions per domain)

Sub-task lists are pulled directly from `exam.md`'s Domain-Task Index. Spread the 25 questions per domain across all of that domain's sub-tasks so nothing is neglected or over-represented. Counts below are a starting allocation — adjust by ±1 as needed, but hit exactly 25 per domain and cover every listed sub-task at least twice.

**Domain 1 — Agentic Architecture & Orchestration (7 tasks → 25 Qs)**
| Task | Topic | Count |
|---|---|---|
| 1.1 | Agentic loops for autonomous task execution | 4 |
| 1.2 | Multi-agent coordinator-subagent patterns | 4 |
| 1.3 | Subagent invocation, context passing, spawning | 4 |
| 1.4 | Multi-step workflows with enforcement/handoff | 4 |
| 1.5 | Agent SDK hooks for tool call interception | 4 |
| 1.6 | Task decomposition strategies | 3 |
| 1.7 | Session state, resumption, and forking | 2 |

**Domain 2 — Tool Design & MCP Integration (5 tasks → 25 Qs)**
| Task | Topic | Count |
|---|---|---|
| 2.1 | Tool interface design with clear descriptions | 5 |
| 2.2 | Structured error responses for MCP tools | 5 |
| 2.3 | Tool distribution across agents, `tool_choice` | 5 |
| 2.4 | MCP server integration into Claude Code | 5 |
| 2.5 | Built-in tools (Read, Write, Edit, Bash, Grep, Glob) | 5 |

**Domain 3 — Claude Code Configuration & Workflows (6 tasks → 25 Qs)**
| Task | Topic | Count |
|---|---|---|
| 3.1 | CLAUDE.md hierarchy, scoping, modular organization | 5 |
| 3.2 | Custom slash commands and skills | 4 |
| 3.3 | Path-specific rules for conditional loading | 4 |
| 3.4 | Plan mode vs. direct execution | 4 |
| 3.5 | Iterative refinement techniques | 4 |
| 3.6 | Claude Code in CI/CD pipelines | 4 |

**Domain 4 — Prompt Engineering & Structured Output (6 tasks → 25 Qs)**
| Task | Topic | Count |
|---|---|---|
| 4.1 | Explicit criteria for precision, false-positive reduction | 5 |
| 4.2 | Few-shot prompting for consistency and quality | 4 |
| 4.3 | Structured output via tool use / JSON schemas | 4 |
| 4.4 | Validation, retry, and feedback loops | 4 |
| 4.5 | Batch processing strategies | 4 |
| 4.6 | Multi-instance and multi-pass review architectures | 4 |

**Domain 5 — Context Management & Reliability (6 tasks → 25 Qs)**
| Task | Topic | Count |
|---|---|---|
| 5.1 | Conversation context preservation | 4 |
| 5.2 | Escalation and ambiguity resolution | 5 |
| 5.3 | Error propagation across multi-agent systems | 4 |
| 5.4 | Context management in large codebase exploration | 4 |
| 5.5 | Human review workflows and confidence calibration | 4 |
| 5.6 | Information provenance and uncertainty | 4 |

---

## 3. What makes a question genuinely hard

Restating the core problem precisely: bad mock questions are gameable **without domain knowledge**, because the answer choices themselves leak the answer — through length, tone, specificity, or absurdity — rather than requiring the test-taker to actually understand the tradeoff. A hard, exam-realistic question should be gameable **only through understanding**.

### 3.1 Anti-patterns to eliminate (the "3 dumb + 1 obvious" problem)

1. **Length/detail asymmetry.** Correct answer is a full sentence with specific reasoning; wrong answers are short, vague, or generic ("Ask the user to rephrase," "Disable the tool"). *Fix:* all 4 options should be within roughly 15-25% of each other in word count and similarly specific.
2. **Absurdity distractors.** An option no competent engineer would seriously propose (delete all logs, ignore the problem, do something obviously unsafe). *Fix:* every distractor must be something a plausible, reasonably competent engineer might genuinely propose.
3. **Giveaway absolutes.** Options using "always / never / only / guarantee" that experienced test-takers learn to auto-eliminate, while the correct answer is comfortably hedged. *Fix:* don't let absolutism alone be the tell in either direction — an option should be wrong on the merits, not wrong because of its grammar.
4. **Real vs. fabricated terminology used as the only trick.** A distractor invents a nonexistent API/flag/parameter that only fools novices. This is a legitimate technique (the real exam uses it — see `exam.md` Q18, Q41) but shouldn't be the *only* trick in the question set; pair it with distractors that use **real, correct terminology applied incorrectly** (wrong layer, wrong order, wrong tradeoff).
5. **Off-topic distractors.** If 3 options address unrelated topics and only 1 addresses the actual stated problem, the mismatch alone signals the answer. *Fix:* all 4 options must be coherent responses to the *same* stated problem.
6. **Generic wrongness.** Good questions (see `exam.md` Q13-Q17, Q32-Q34) make each wrong option fail for a specific, scenario-grounded reason, not a generic "this is bad practice." The explanation should always be able to say precisely *why*, given the scenario's specific numbers/constraints — never just "this doesn't fix it."

### 3.2 The core positive technique: near-miss distractors

The strongest wrong answers are correct patterns *misapplied*, not wrong ideas. Four reliable shapes to draw from (vary across the 125 questions — don't let every question use the same one):

- **Right mechanism, wrong layer/scope.** e.g. enforcing a rule in the system prompt when it needs to be a hook; validating in a hook when it needs to be a JSON schema.
- **Right principle, wrong problem.** A genuinely good pattern that solves an adjacent problem the scenario doesn't actually have — e.g. fixing tool *selection* when the described bug is tool *ordering*.
- **Right idea, wrong scale/constraint.** A solution that would work under different numbers, but the scenario's stated metric (a percentage, a latency figure, a count) specifically rules it out — forcing the test-taker to actually read and apply the given data rather than pattern-match on keywords.
- **Correct answer to a similar-but-different scenario.** Tests whether the candidate discriminates between similar-sounding mechanisms, e.g. `fork_session` vs. `--resume`, or `PreToolUse` vs. `PostToolUse` hooks.

### 3.3 Per-question checklist

Run every one of the 125 questions through this before accepting it:

- [ ] All 4 options are within ~15-25% of each other in word count.
- [ ] All 4 options directly respond to the same stated problem.
- [ ] No option is absurd or something no engineer would seriously propose.
- [ ] At least 2 of the 3 wrong options are near-misses (right idea/mechanism, wrong application) rather than flatly wrong.
- [ ] No option relies on "always/never/only" language as its sole tell.
- [ ] The scenario contains a specific, concrete detail (a metric, a tool name, a constraint) that is *necessary* to eliminate at least one distractor — you can't answer from the stem's general shape alone.
- [ ] The explanation addresses **all three wrong options by letter**, each with the *specific* reason it fails in *this* scenario — no wrong option left unmentioned.
- [ ] The correct answer, read alone, doesn't sound obviously "the right sounding one" — it should require ruling out real competitors.

A useful stress test: **if you can delete a number from the scenario and the question still works exactly the same way, that number wasn't load-bearing — add one that is, or cut it.**

---

## 4. Worked examples

### Example A — Domain 1, Task 1.5 (SDK hooks)

**❌ Bad — what to avoid:**

> Q: Your agent needs to block refunds over $500 without manager approval. What should you do?
> - A) Use a hook to intercept the `process_refund` call and block it if the amount exceeds $500 and no approval flag is set. **(correct)**
> - B) Tell the agent nicely to please not do that.
> - C) Delete the refund tool.
> - D) Hope it doesn't happen again.

Why it's bad: B/C/D aren't real engineering proposals; A is three times longer and specific. Anyone can guess A with zero knowledge of Claude, hooks, or MCP.

**✅ Good — this is `exam.md` Q24 verbatim, the calibration target:**

> Q: Your customer support agent has a policy: refunds above $500 require manager approval and must not be processed autonomously. Your system prompt states "Do not process refunds above $500 without manager approval." Production logs show this rule is violated in approximately 3% of cases. What is the most effective way to guarantee compliance?
> - A) Strengthen the system prompt language: "You are strictly forbidden from processing refunds above $500 without explicit manager approval under any circumstances."
> - B) Add 10 few-shot examples in the system prompt, all demonstrating the agent requesting manager approval for high-value refunds.
> - C) Implement a hook that intercepts outgoing `process_refund` tool calls, checks the refund amount, and blocks execution or redirects to the manager approval workflow when the amount exceeds $500. **(correct)**
> - D) Implement a validation step that runs after `process_refund` completes and reverses any refunds that exceeded the threshold.

Why it's good: all four are real, sensible-sounding engineering responses of similar length and specificity. A and B are the natural first instinct ("just prompt harder") and are wrong for a precise, statable reason — probabilistic compliance vs. deterministic enforcement. D is a genuine near-miss: it's the right *category* of fix (programmatic) but applied *after* the harmful action has already occurred — a subtler distinction than "wrong vs. right." The stated 3% figure matters: it tells you prompt-only approaches have already effectively been tried and still fail, which is what rules out A and B specifically.

### Example B — Domain 4, Task 4.4 (validation/retry loops)

**❌ Bad:**

> Q: Your JSON extraction sometimes returns invalid JSON. What's the best fix?
> - A) Parse the output, and if it fails validation, send the error back to Claude along with the original schema and ask it to correct the specific fields that failed, retrying up to a small fixed limit. **(correct)**
> - B) Just ask Claude to try again.
> - C) Turn off structured output.
> - D) Increase max_tokens.

**✅ Good — target quality, a new question in this style:**

> Q: Your document extraction pipeline asks Claude to return structured JSON matching a schema with 12 required fields. On complex multi-page invoices, roughly 6% of responses fail schema validation — usually because one or two nested fields are malformed while the rest of the object is correct. Your current retry logic discards the entire response and resends the original extraction prompt unchanged, asking Claude to try the whole document again. Retries succeed about half the time, but token cost has tripled and latency has roughly doubled for that 6% of documents.
> - A) Increase `max_tokens` for the extraction call, since malformed nested fields are likely caused by the response being truncated mid-object.
> - B) On validation failure, send Claude only the specific validation errors (which fields failed and why) along with its own prior output, and ask it to return a corrected version of just those fields rather than re-extracting from scratch. **(correct)**
> - C) Switch from a single 12-field schema to two smaller sequential extraction calls, splitting the fields roughly in half, on the theory that smaller schemas are inherently less error-prone per call.
> - D) Lower the model's temperature to 0 for the extraction call, since malformed JSON is most likely caused by sampling variance in field formatting.

Why B is correct, and why A/C/D are near-misses rather than jokes:
- **A** names a real failure mode (truncation) but doesn't match the stated symptom — most of the object is correct and only 1-2 nested fields are malformed, which is a localized formatting error, not truncation.
- **C** is a legitimate architectural pattern (task decomposition) but doesn't target this specific problem, and it adds a second full round-trip's cost/latency to *every* document, not just the 6% that fail.
- **D** is a real, meaningful lever (temperature) but malformed structural JSON is a schema-adherence problem, not a sampling-randomness problem; temperature 0 doesn't guarantee valid JSON.
- **B** is the only option that fixes the actual localized failure precisely *and* explains the observed cost/latency regression (full re-extraction vs. targeted correction of just the failed fields).

Note that every number in the scenario ("6%", "one or two nested fields", "about half the time", "tripled... doubled") is load-bearing for eliminating a specific option — none of it is flavor text.

---

## 5. Explanation-writing guidance

**Hard requirement: every explanation must state why each of the three wrong options is wrong — all 125 explanations, no exceptions.** This is the whole point of a study bank: a wrong option whose failure is never explained teaches nothing, and near-miss distractors (§3.2) are precisely the ones where the test-taker needs the distinction spelled out.

Match the style already used in `questions.json`: 2-5 sentences, structured as (1) why the correct answer is right, tied to a specific mechanism, then (2) one clause or sentence **per wrong option, referenced by its letter** ("Option A fails because…"), stating its specific, scenario-grounded failure — never just "this is wrong," always "this fails because X, given the stated Y." For near-miss distractors, name what the option *gets right* before what it gets wrong ("Option D is programmatic enforcement, which is the right category, but it runs after the harmful action has already executed"). See `exam.md` Q13, Q21, Q32, Q34 for calibration, and Example B's per-option breakdown in §4 for the target depth.

Add this to final validation (§7 step 5): programmatically check every explanation mentions all three wrong letters (e.g. contains "A", "B", "C", "D" as option references, or an equivalent per-option structure).

---

## 6. Files involved

- **Read for reference/style (do not modify):** `public/exam.md` (domain/task taxonomy + full 77-question canonical bank), `public/questions.json` (the same 77 questions in app JSON format — the quality bar, and the set to avoid scenario-duplicating), `reports/cca-f-official-exam-guide-v1.pdf` (official exam guide — see §0.5, especially its per-task objective bullets for Domain 1).
- **Write target:** `public/ai-questions.json` — replace the single placeholder record with the 125 new question objects; update `total` to `125`.
- **No app code changes needed.** `src/main.js` and `src/store.js` consume this file generically (by `id`, `questionText`, `options`, `correct`, `explanation`), with no schema validation to update. `domainName` isn't even read by the UI today — only `task` is shown, prefixed "✨ AI Generated · Task {task}".
- **Tests:** `src/tests/store.test.js` uses synthetic fixtures, not the real JSON files, so no test changes are required by this data change alone. Optional: add a lightweight schema/count assertion (125 questions total, 25 per domain, `correct` always a valid key present in `options`, non-empty `explanation`) for regression protection — not required, just worth considering.

---

## 7. Suggested authoring workflow

1. Re-read all 77 questions in `questions.json` once, in full, for tone calibration — don't rely only on the excerpts quoted above. Skim the official guide's Domain 1 objectives (`reports/cca-f-official-exam-guide-v1.pdf`, §0.5) for anti-pattern bullets to reuse as distractors.
2. Draft questions domain-by-domain, task-by-task, per the distribution in §2, running each one through the §3.3 checklist before finalizing it.
3. Vary the near-miss "shape" (§3.2) across the 125 questions so the set doesn't become predictable in its own way — mix "wrong layer," "wrong problem," "wrong scale," and "similar-but-different scenario" distractors.
4. Spot-check a sample: try to answer using only elimination heuristics (length, absolutism, absurdity) with no domain knowledge. If that works, revise.
5. Validate the final JSON: valid syntax, `total` matches the array length, all `id`s unique and sequential (`ai-1` … `ai-125`), `correct` always one of A/B/C/D and present in that question's `options`, and every `explanation` non-empty and covering all three wrong options per §5.
