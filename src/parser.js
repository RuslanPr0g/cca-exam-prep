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

    const id = parseInt(qMatch[1], 10);
    const questionText = qMatch[2].trim();

    // Extract options A) B) C) D)
    const optionRegex = /^([A-D])\)\s+(.+?)(?=\n[A-D]\)|\n\n\*\*Correct Answer|$)/gms;
    const options = {};
    let match;
    while ((match = optionRegex.exec(block)) !== null) {
      options[match[1]] = match[2].trim();
    }

    if (Object.keys(options).length !== 4) continue;

    // Extract correct answer letter
    const answerMatch = block.match(/\*\*Correct Answer:\s*([A-D])\*\*/);
    if (!answerMatch) continue;
    const correct = answerMatch[1];

    // Extract explanation (text after **Correct Answer: X** line)
    const explanationMatch = block.match(/\*\*Correct Answer:\s*[A-D]\*\*\s*\n([\s\S]+)/);
    const explanation = explanationMatch ? explanationMatch[1].trim() : '';

    questions.push({ id, questionText, options, correct, explanation });
  }

  return questions;
}
