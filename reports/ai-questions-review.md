# Review: `public/ai-questions.json` vs the Authoring Guide

**Date:** 2026-07-14 · **Scope:** all 125 AI-generated questions, audited against `reports/ai-questions-authoring-guide.md` (schema §1, distribution §2, hardness criteria §3, explanations §5). Combines programmatic checks with a manual read of every question.

---

## Summary

**Mechanically, the bank is fully compliant.** Wrapper, ids, domains, tasks, `source`, per-task distribution (§2, exact match), single valid `correct` key, and explanation coverage of all three wrong options by letter (§5) — all 125 pass with zero defects. Overall answer-key balance is fine (A 34 / B 31 / C 30 / D 30).

**Qualitatively, the guide's central goal — questions not gameable without domain knowledge (§3) — is only met by Domain 1.** Domain 1 was already de-gamed (commit `811a3f8`); Domains 2–5 were not, and they exhibit the exact anti-patterns §3.1 tells authors to eliminate, plus a few of their own:

| Finding | Severity | Scale |
|---|---|---|
| Scenario reuse from `questions.json` (§1 hard rule) | **Fix required** | 4 questions (ai-86, ai-87, ai-89, ai-94) |
| Length tell: correct option is the longest (§3.1.1) | **Fix required** | 93/125 bank-wide; 70 flagged >1.5× shortest, all in Domains 2–5 |
| Structural giveaways in individual questions | **Fix required** | ai-110, ai-119, ai-100, ai-113, ai-72 |
| "Correct answer argues its own correctness" tone tell | Should improve | 20 questions |
| Predictable distractor archetypes (prompt-instruction / max_tokens / confidence-score ≈ always wrong) | Should improve | ~40 wrong options across Domains 2–5 |
| Mechanically rotating answer key (authoring artifact) | Should improve | Domains 2–5 entirely; Domain 1 opens A,A,A,A,A |
| Numbers that aren't load-bearing; stems with no concrete metric (§3.3) | Minor | 56 stems have no digits; many others carry flavor-only percentages |
| Absolutes asymmetry (§3.1.3) | Minor | 4 questions |

**Recommended action:** run the same de-gaming pass applied to Domain 1 over Domains 2–5 (details in "Suggested fixes" below), and rewrite the four reused scenarios.

---

## Bank-wide findings

### 1. The length tell (§3.1.1) — the biggest problem

The guide's core anti-pattern #1: all four options should be within ~15–25% of each other in word count. Instead, the correct answer is the strictly longest option in **93 of 125** questions (chance would be ~31), and strictly shortest in only 16.

Per domain — note the before/after effect of the Domain 1 de-gaming commit:

| Domain | Correct is longest | Correct >125% of shortest option |
|---|---|---|
| 1 (de-gamed) | 12/25 | **2/25** |
| 2 | 22/25 | 22/25 |
| 3 | 15/25 | 18/25 |
| 4 | 21/25 | 21/25 |
| 5 | 23/25 | 23/25 |

A test-taker who always picks the longest option scores ~74% on this bank without reading the questions. Worst offenders (correct-option word count vs the others): **ai-100** (49 vs 19–22), **ai-102** (45 vs 13–17), **ai-26** (45 vs 20–24), **ai-75** (42 vs 15–23), **ai-45** (41 vs 15–20), **ai-29** (40 vs 14–26), **ai-30** (40 vs 13–18). Full flagged list in Appendix A.

### 2. Scenario reuse from `questions.json` (§1 hard rule violation)

§1: "Do not reuse `questionText` scenarios, company names, or specific tool names … from the 77 questions already in `questions.json`."

- **ai-87** reuses the tool names `extract_invoice_schema` and `extract_receipt_schema` **verbatim** from canonical Q62, in the same invoice-pipeline framing.
- **ai-86** is canonical Q62 re-skinned: two extraction tools, document type unknown in advance, `tool_choice: "auto"`, ~25% (vs Q62's 30%) of responses return text instead of a tool call, same correct answer (`"any"`), and its option D proposes `extract_document_schema` — Q62's own distractor, name included.
- **ai-89** is canonical Q63 re-skinned: tool use with a strict schema, sum of line items ≠ `total_amount` (field name reused verbatim), "well-formed documents with no missing data," same retry-with-specific-feedback answer; 6% vs Q63's 8%. Its option D also reuses Q63's `calculated_total`. (ai-92 leans on the same line-items-vs-total business-rule setup a third time.)
- **ai-94** is canonical Q65 re-skinned: large batch job, "how should partial failures be handled," same `custom_id`-correlate-and-resubmit answer. (`custom_id` itself is legitimate real API terminology; it's the scenario shape that's duplicated.)

These defeat the stated purpose of the rule — a studier sees the same setup twice and re-memorizes rather than re-derives. All four need fresh scenarios (different failure symptom, different domain, ideally a different sub-skill of the same task).

### 3. Predictable distractor archetypes (§7 step 3 violated)

The guide warns: "vary the near-miss shape … so the set doesn't become predictable in its own way." Three archetypes are reused so often that they become elimination heuristics requiring no domain knowledge:

- **"Add a system-prompt instruction / instruct the agent"** appears in **19 wrong options and is never correct**. In this bank, any option starting "Instruct…" or "Add a system prompt rule…" can be auto-eliminated.
- **"Raise `max_tokens` / bigger context window / larger model tier"** — 12 wrong options, correct once (ai-2, and there it's the *rejected* framing).
- **"Self-reported confidence score"** — 10 wrong options, correct once (ai-119, where the point is that raw scores need calibration).

Individually each is a legitimate near-miss; collectively they teach the meta-rule "prompt-based and capacity-based options are always wrong," which lets a candidate solve much of Domains 4–5 by pattern. The fix is not to remove them but to add a handful of questions where the prompt-level or capacity answer **is** correct (there are real cases: a genuine truncation bug where raising `max_tokens` is right; a task where prompt clarification genuinely is the right layer), so the archetype stops being a reliable eliminator. Note the bank already does this well for few-shot examples (wrong 7 times, correct 5 times — ai-81, ai-82, ai-83, ai-105, ai-107); that's the calibration target.

### 4. The "argues its own correctness" tone tell

In **20 questions** the correct option is the only one that carries a justification clause ("since…", "because…", "rather than…", "which is…"), while the distractors just state an action. The correct answer reads like a mini-explanation; the wrong ones read like proposals. Affected: ai-30, ai-42, ai-43, ai-48, ai-54, ai-63, ai-66, ai-75, ai-82, ai-83, ai-87, ai-88, ai-100, ai-103, ai-112, ai-113, ai-115, ai-117, ai-120, ai-122.

Fix in either direction: strip the "since…" clause from the correct option (the explanation field already carries it), or give distractors equally confident (wrong) rationales.

### 5. Mechanically rotating answer key

The per-domain key sequences (file order):

```
Domain 1: AAAAABCDACBDACBDACBDCABDC
Domain 2: BCDABCDABCDABCDABCDABCDAB
Domain 3: BCDABCDABCDABCDABCDABCDAB
Domain 4: ABCDABCDABCDABCDABCDABCDA
Domain 5: DABCDABCDABCDABCDABCDABCD
```

Domains 2–5 are a perfect A→B→C→D rotation; Domain 1 opens with five consecutive A's. The app shuffles question order at runtime (options stay fixed A–D), so this isn't directly exploitable in the UI — but it's a visible authoring artifact for anyone reading the JSON, and it means the correct letter was assigned by position rather than randomly. Worth scrambling when the questions are next touched.

### 6. Load-bearing numbers (§3.3 stress test)

- **56 stems contain no digits at all** (list in Appendix B). Not automatically a violation — several are definitional questions (e.g. the `tool_choice` set) where a metric would be artificial — but the §3.3 checklist wants a concrete detail that's *necessary* to eliminate at least one distractor, and many of these could take one.
- Conversely, many stems in Domains 2–5 carry **flavor-only numbers** that fail the guide's stress test ("if you can delete a number and the question still works, it wasn't load-bearing"): ai-5's "15% latency," ai-12's "1 in 10," ai-16's "7 cases," ai-26's "18%," ai-30's "9%" — deleting any of these changes nothing about which option wins. Compare with the genuinely load-bearing numbers in ai-6 (the 4-page defined-terms section), ai-10 ("~5 sustainable concurrent subagents"), ai-21 (schemas ranging 3–45 tables), which each rule out a specific distractor.

---

## Per-question findings

### Fix required

- **ai-86, ai-87, ai-89, ai-94 — scenario reuse.** See bank-wide finding 2. Rewrite with fresh scenarios and tool names. (ai-86 has a secondary issue: option D — merge into one schema-with-type-field tool — is a defensible engineering answer rejected only on "more effort" grounds; a fresh scenario should make the discriminator sharper.)
- **ai-110 — options don't answer the question asked (§3.1.5).** The stem asks "What is the problem with this approach?" Option A (correct) is the only option that states a problem; B, C, D propose fixes. The grammatical mismatch alone gives away the answer. Either reword the stem to "what should change?" and make A a change, or make all four options candidate diagnoses.
- **ai-119 — self-eliminating distractors.** Option A ends "…but not the central issue here" and option D ends "…rather than a flaw in the approach itself." Two of three distractors explicitly concede, in their own text, that they are not the answer to the question ("what is the critical flaw"). Rewrite both to assert themselves as the critical flaw.
- **ai-100 — correct option contains its own explanation.** At 49 words (vs 19–22), option A embeds the full contrast with open-ended bug-finding — material that belongs in the explanation field. It is simultaneously the longest, the most hedged, and the only self-justifying option. Cut it to the action ("Run 3 independent parallel instances and take the majority verdict") and move the reasoning to the explanation.
- **ai-113 — answerable from the stem alone (§3.3 last checkbox).** The stem states the specific error detail "was captured correctly at the source" and then "flattened… losing the specific, actionable detail." Option D restates "preserve the detail as it propagates"; option C directly contradicts the stem's stated facts; option B (suppress all errors from users) is near-absurd. No domain knowledge needed. Needs a real competitor — e.g. a plausible-but-wrong layer for the fix (have the user-facing agent re-query the subagent; have the coordinator re-classify errors itself).
- **ai-72 — fabricated terminology as the only trick (§3.1.4), plus shortest options in the bank.** Two of three distractors are invented flags (`CLAUDE_HEADLESS`, `--batch`), and the option word counts (9/7/16/4) are far outside the 15–25% band. Keep one fabrication at most; make the others real mechanisms misapplied (e.g. `--output-format json` — real, but doesn't make the run non-interactive; piping the prompt via stdin without `-p`).

### Should improve

- **Length-flagged questions (70 ids, Appendix A)** — rebalance option lengths per §3.1.1. Domain 1 shows this is fixable without weakening content.
- **ai-46, ai-48, ai-49 — recycled and absurdity-adjacent distractors (§3.1.2).** "Use `Read` on the project root / directory and recursively enumerate" appears as a distractor in both ai-46 and ai-49; "`Read` every file in the project" in ai-48. No competent engineer proposes `Read` for directory traversal, and Task 2.5's five questions are generally the easiest in the bank — every correct answer is "use the purpose-built tool." At least one of the five should have a scenario where `Bash` genuinely *is* the right choice (e.g. a pipeline or command chaining need) so the "never pick Bash" heuristic breaks.
- **ai-51 — two fabricated mechanisms out of three distractors** (a `.claude/` placement requirement that doesn't exist, an `@import`-from-user-level requirement that doesn't exist) plus one absurdity-adjacent option (outdated version). Same §3.1.4 concern as ai-72, softer.
- **ai-38 / ai-39 / ai-86 / ai-87 — one scaffold used four times.** The same option quartet (auto / force-specific / any / remove-or-merge-tools) appears near-verbatim in all four `tool_choice` questions. As a discrimination set this is partially intentional, but four repeats means answering one teaches the rest. Two is enough; convert the others to different `tool_choice` failure modes (e.g. forcing a tool during a conversational turn that needs text output; `disable_parallel_tool_use` interactions).
- **ai-121–ai-125 — the Domain 5 tail is markedly easier than the rest.** In each, the correct option restates the stem's implied fix while distractors are transparently poor ("average the two conflicting figures," "prefer whichever subagent returned first," "discard both figures," "reduce how many claims get attribution"). ai-123's option A (prefer the first responder) fails the "would a competent engineer propose this?" test outright. These need real near-misses — e.g. for ai-123, a distractor like "have a third subagent adjudicate and report the winner as settled" (right mechanism, still hides the disagreement).
- **ai-73 / ai-75 — same opener** ("A CI pipeline runs Claude Code to review pull requests…"). Different topics, but §1 wants scenario variety; trivially fixed by re-skinning one.
- **ai-74 — verify the `--json-schema` flag.** The correct answer hinges on `--output-format json` combined with `--json-schema`. `--output-format json` is real; confirm `--json-schema` against current Claude Code docs before shipping this as ground truth (ai-75's correct option references the same pairing more loosely). If it's not a real flag, the correct answer itself contains fabricated terminology — the worst place for it.

### Minor

- **Absolutes asymmetry (§3.1.3):** ai-43, ai-80, ai-95, ai-104 each have two distractors carrying "always/never/only/guarantee" language while the correct option is comfortably hedged. None is decisive alone; rebalance wording when editing those questions anyway.
- **Domain 1 key run:** ai-1 through ai-5 are all A (see bank-wide finding 5).
- **Stems without any concrete metric:** 56 ids (Appendix B) — apply judgment; add a load-bearing detail where one would let a distractor be eliminated on the numbers.

---

## What's already good

Worth preserving in any rewrite:

- **Domain 1 (ai-1–ai-25) is at or near the guide's calibration target** post-`811a3f8`: balanced option lengths, genuine near-misses of varied shape, load-bearing details (ai-6, ai-10, ai-21, ai-23), and paired discriminations done right (ai-14 vs ai-40 teach when an idempotency key is and isn't the fix — the exam.md Q24-style distinction §3.2 asks for).
- **Every explanation covers all three wrong options by letter** — 125/125, the §5 hard requirement.
- **"When NOT to use the technique" questions** (ai-65, ai-71, ai-87, ai-95, ai-99, ai-116) are a genuinely good pattern that keeps the bank from rewarding "always pick the fancier architecture."
- **Few-shot options are properly two-sided** (sometimes correct, sometimes a near-miss) — the model for fixing the one-sided archetypes in finding 3.

## Suggested fix order

1. Rewrite the 4 scenario-reuse questions (ai-86, ai-87, ai-89, ai-94) — hard rule violations.
2. Fix the 6 structural giveaways (ai-110, ai-119, ai-100, ai-113, ai-72, ai-51) and verify ai-74's flag.
3. Run a Domain-2–5 length-rebalancing pass over the Appendix A list (same treatment as commit `811a3f8` gave Domain 1), stripping "since…" self-justifications from correct options as part of it.
4. Break the three one-sided distractor archetypes by adding/adjusting a few questions where prompt-level, `max_tokens`, or a (calibrated) confidence mechanism is the right answer.
5. Scramble the rotating answer key while editing.

---

## Appendix A — length-flagged questions (correct option longest **and** >1.5× the shortest option)

ai-26, ai-27, ai-28, ai-29, ai-30, ai-33, ai-34, ai-35, ai-36, ai-39, ai-40, ai-41, ai-42, ai-43, ai-44, ai-45, ai-47, ai-48, ai-49, ai-50, ai-51, ai-53, ai-63, ai-66, ai-67, ai-68, ai-69, ai-70, ai-71, ai-72, ai-73, ai-75, ai-76, ai-77, ai-78, ai-79, ai-82, ai-83, ai-85, ai-86, ai-89, ai-90, ai-92, ai-93, ai-94, ai-95, ai-96, ai-98, ai-99, ai-100, ai-101, ai-102, ai-104, ai-108, ai-109, ai-110, ai-111, ai-112, ai-113, ai-114, ai-115, ai-116, ai-117, ai-118, ai-119, ai-120, ai-121, ai-122, ai-123, ai-124

(70 flagged by the automated check; every one is in Domains 2–5.)

## Appendix B — stems containing no digits

ai-15, ai-17, ai-19, ai-25, ai-28, ai-31, ai-32, ai-33, ai-34, ai-38, ai-39, ai-41, ai-42, ai-43, ai-44, ai-46, ai-49, ai-51, ai-53, ai-54, ai-55, ai-56, ai-57, ai-58, ai-59, ai-60, ai-61, ai-62, ai-63, ai-65, ai-66, ai-67, ai-69, ai-70, ai-71, ai-72, ai-73, ai-74, ai-78, ai-81, ai-82, ai-87, ai-91, ai-92, ai-96, ai-98, ai-100, ai-103, ai-106, ai-108, ai-109, ai-110, ai-111, ai-113, ai-119, ai-121 (56 total)

## Addendum — fixes applied (2026-07-14)

All "fix required" and "should improve" findings above have been addressed in `public/ai-questions.json`; the figures in the findings sections describe the pre-fix state.

1. **Scenario reuse:** ai-86, ai-87, ai-89, ai-94 fully rewritten with fresh scenarios and tool names (feedback-pipeline style guidance, veterinary-records classification, property-appraisal truncation, podcast back-catalog batch).
2. **Structural giveaways:** ai-110's options are now all diagnoses; ai-119's self-eliminating distractors now assert themselves; ai-100's correct option cut to the action; ai-113 got real competitor distractors; ai-72 and ai-51 replaced fabricated mechanisms with real-mechanism near-misses. ai-74's `--json-schema` verified as a real CLI flag (`claude --help`) — no change needed.
3. **Length rebalance:** all 70 flagged questions edited (correct options trimmed, short distractors expanded). Post-fix: zero questions where the correct option is longest *and* >1.35× the shortest; correct-is-longest fell from 93/125 to 63/125.
4. **Tone tell:** zero questions remain where the correct option alone carries a justification connective (was 20).
5. **Archetype breaking:** `max_tokens` is now the correct answer in ai-89, and prompt-level guidance (schema field `description`) is correct in ai-86, so "capacity/prompt options are always wrong" no longer holds; the tool_choice scaffold quartet reduced to two (ai-38/ai-39) plus one differently-shaped forced-tool question (ai-87).
6. **Answer key:** scrambled with per-question random permutation (letters remapped inside explanations); post-fix distribution A 31 / B 29 / C 36 / D 29, no rotation.
7. **Minor:** absolutes asymmetry fixed (ai-43, ai-80, ai-95, ai-104, plus ai-32 which surfaced during editing); ai-46/48/49 weak "`Read` for directory traversal" distractors replaced; ai-123's first-responder distractor replaced with a weighting near-miss; ai-75's opener de-duplicated from ai-73.

Validation after fixes: schema/distribution checks clean, 125/125 explanations reference all three wrong options by letter post-scramble, no identifier overlap with `questions.json` beyond generic API terms, and the full test suite passes (64/64).

## Appendix C — raw check figures

- Wrapper: `version: 1`, `total: 125`, 125 questions; ids `ai-1`…`ai-125` sequential; all schema fields valid; per-task distribution matches §2 exactly (25/domain).
- Answer-key distribution: A 34, B 31, C 30, D 30 (per-domain max skew: Domain 1, A×9).
- Explanations referencing all three wrong letters: 125/125.
- Correct option strictly longest: 93/125; strictly shortest: 16/125.
- Distractor archetypes (wrong-option count / correct-option count): prompt-instruction 19/0, max_tokens-or-bigger-model 12/1, confidence-score 10/1, few-shot 7/5.
- Identifier overlap with `questions.json` (excluding generic API terms): ai-86/ai-87 (`extract_*_schema`, `document_type` — canonical Q62), ai-89 (`total_amount`, `calculated_total` — Q63), ai-94/95/96 (`custom_id` — Q65; term itself is legitimate).
