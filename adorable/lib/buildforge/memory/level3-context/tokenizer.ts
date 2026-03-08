// =============================================================================
// Token Counter
// Lightweight token estimation without heavy dependencies.
// Uses word-based approximation: ~1.3 tokens per word for English text.
// =============================================================================

const TOKENS_PER_WORD = 1.3;
const TOKENS_PER_CODE_CHAR = 0.25; // Code is more token-dense

/**
 * Estimate token count for a string.
 * Uses word-based heuristic that's accurate within ~10% for mixed content.
 */
export const estimateTokens = (text: string): number => {
  if (!text) return 0;

  // Detect if content is primarily code (has lots of special chars, short lines)
  const lines = text.split("\n");
  const codeLineRatio =
    lines.filter((l) => /[{}();=><[\]]/.test(l)).length / Math.max(lines.length, 1);

  if (codeLineRatio > 0.5) {
    // Code-heavy content: use character-based estimation
    return Math.ceil(text.length * TOKENS_PER_CODE_CHAR);
  }

  // Natural text / markdown: use word-based estimation
  const words = text.split(/\s+/).filter(Boolean);
  return Math.ceil(words.length * TOKENS_PER_WORD);
};

/**
 * Truncate text to fit within a token budget.
 * Tries to truncate at sentence/paragraph boundaries.
 */
export const truncateToTokenBudget = (
  text: string,
  maxTokens: number,
): { text: string; truncated: boolean; tokenCount: number } => {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) {
    return { text, truncated: false, tokenCount: currentTokens };
  }

  // Try paragraph-level truncation first
  const paragraphs = text.split("\n\n");
  let result = "";
  let tokens = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    if (tokens + paragraphTokens > maxTokens) {
      // Try sentence-level within this paragraph
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);
        if (tokens + sentenceTokens > maxTokens) break;
        result += (result ? " " : "") + sentence;
        tokens += sentenceTokens;
      }
      break;
    }
    result += (result ? "\n\n" : "") + paragraph;
    tokens += paragraphTokens;
  }

  return {
    text: result || text.slice(0, Math.floor(maxTokens / TOKENS_PER_CODE_CHAR)),
    truncated: true,
    tokenCount: estimateTokens(result),
  };
};

/**
 * Check if content fits within a token budget.
 */
export const fitsInBudget = (text: string, maxTokens: number): boolean => {
  return estimateTokens(text) <= maxTokens;
};
