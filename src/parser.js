/**
 * parser.js — BUILD UTILITY (BUG-10)
 *
 * This file is NOT used at runtime by the quiz app.
 * It is a standalone build/migration tool that parses the raw exam markdown
 * (public/exam.md) into the structured questions.json format consumed by the app.
 *
 * Usage (Node.js):
 *   node src/parser.js > public/questions.json
 *
 * The app fetches public/questions.json directly at runtime.
 * Do not import this file from main.js or any app module.
 */

/**
 * Parses the Claude certification exam markdown into question objects.
 *
 * Expected question block format:
 *   **Q{n}.** <question text>
 *
 *   A) <option>
 *   B) <option>
 *   C) <option>
 *   D) <option>
 *
 *   **Correct Answer: X**
 *   <explanation text>
 *
 *   ---
 */
export function parseExam(markdown) {
  const questions = [];

  // Split on horizontal rules to get candidate blocks
  const blocks = markdown.split(/\n---\n/);

  for (const block of blocks) {
    const qMatch = block.match(/\*\*Q(\d+)\.\*\*\s+([\s\S]*?)(?=\n[A-D]\))/);
    if (!qMatch) continue;

    const id           = parseInt(qMatch[1], 10);
    const questionText = qMatch[2].trim();

    // BUG-09 fixed: use a split-based approach instead of a regex with a
    // lookahead that breaks on multi-line option text.
    // Strategy: find positions of A) B) C) D) and **Correct Answer, then slice.
    const optionStarts = [];
    const optionPattern = /^([A-D])\)\s+/gm;
    let om;
    while ((om = optionPattern.exec(block)) !== null) {
      optionStarts.push({ letter: om[1], index: om.index, contentStart: om.index + om[0].length });
    }

    if (optionStarts.length !== 4) continue;

    const answerMarkerMatch = block.match(/\*\*Correct Answer:\s*([A-D])\*\*/);
    if (!answerMarkerMatch) continue;
    const answerMarkerIndex = block.indexOf(answerMarkerMatch[0]);

    const options = {};
    for (let i = 0; i < optionStarts.length; i++) {
      const start = optionStarts[i].contentStart;
      // End is either the start of the next option or the answer marker
      const end = i + 1 < optionStarts.length
        ? optionStarts[i + 1].index
        : answerMarkerIndex;
      options[optionStarts[i].letter] = block.slice(start, end).trim();
    }

    if (Object.keys(options).length !== 4) continue;

    const correct = answerMarkerMatch[1];

    // Extract explanation (text after **Correct Answer: X** line)
    const explanationMatch = block.match(/\*\*Correct Answer:\s*[A-D]\*\*\s*\n([\s\S]+)/);
    const explanation = explanationMatch ? explanationMatch[1].trim() : '';

    questions.push({ id, questionText, options, correct, explanation });
  }

  return questions;
}
