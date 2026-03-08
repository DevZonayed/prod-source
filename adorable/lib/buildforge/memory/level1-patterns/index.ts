// =============================================================================
// Level 1: Global Pattern Memory — Pattern Registry
// Hardcoded application patterns that serve as the AI's "experience."
// =============================================================================

import type { PatternDefinition, PatternId } from "../../types";
import { PATTERN_KEYWORDS } from "../../constants";
import { ecommercePattern } from "./ecommerce";
import { saasPattern } from "./saas";
import { marketplacePattern } from "./marketplace";
import { crmPattern } from "./crm";
import { cmsPattern } from "./cms";
import { bookingPattern } from "./booking";
import { socialPattern } from "./social";
import { lmsPattern } from "./lms";

const PATTERN_REGISTRY: Record<PatternId, PatternDefinition> = {
  ecommerce: ecommercePattern,
  saas: saasPattern,
  marketplace: marketplacePattern,
  crm: crmPattern,
  cms: cmsPattern,
  booking: bookingPattern,
  social: socialPattern,
  lms: lmsPattern,
};

/**
 * Get a pattern definition by ID.
 */
export const getPattern = (id: PatternId): PatternDefinition => {
  return PATTERN_REGISTRY[id];
};

/**
 * Get all available patterns.
 */
export const getAllPatterns = (): PatternDefinition[] => {
  return Object.values(PATTERN_REGISTRY);
};

/**
 * Match a natural language description against known patterns.
 * Returns patterns ranked by relevance score (0-1).
 */
export const matchPatterns = (
  description: string,
): Array<{ pattern: PatternDefinition; score: number }> => {
  const descLower = description.toLowerCase();
  const descWords = new Set(descLower.split(/\s+/));

  const results: Array<{ pattern: PatternDefinition; score: number }> = [];

  for (const [patternId, keywords] of Object.entries(PATTERN_KEYWORDS)) {
    const matchedKeywords = keywords.filter(
      (kw) => descLower.includes(kw) || descWords.has(kw),
    );

    if (matchedKeywords.length > 0) {
      const score = matchedKeywords.length / keywords.length;
      const pattern = PATTERN_REGISTRY[patternId as PatternId];
      if (pattern) {
        results.push({ pattern, score });
      }
    }
  }

  // Also check pattern descriptions and keywords in the pattern itself
  for (const pattern of Object.values(PATTERN_REGISTRY)) {
    const existing = results.find((r) => r.pattern.id === pattern.id);
    if (!existing) {
      const patternKeywords = pattern.keywords;
      const matched = patternKeywords.filter((kw) => descLower.includes(kw));
      if (matched.length > 0) {
        results.push({
          pattern,
          score: matched.length / patternKeywords.length,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
};

/**
 * Get the best matching pattern for a description, or null if no match.
 */
export const getBestPattern = (
  description: string,
  minScore = 0.1,
): PatternDefinition | null => {
  const matches = matchPatterns(description);
  if (matches.length === 0 || matches[0].score < minScore) return null;
  return matches[0].pattern;
};

/**
 * Get compressed pattern summary for context assembly.
 * Returns only the essential info within a token budget.
 */
export const getPatternSummary = (id: PatternId): string => {
  const pattern = PATTERN_REGISTRY[id];
  if (!pattern) return "";

  const entityNames = pattern.standardEntities.map((e) => e.name).join(", ");
  const screenNames = pattern.standardScreens.map((s) => s.name).join(", ");
  const roleNames = pattern.standardRoles.map((r) => r.name).join(", ");

  return [
    `PATTERN: ${pattern.name}`,
    `ENTITIES: ${entityNames}`,
    `SCREENS: ${screenNames}`,
    `ROLES: ${roleNames}`,
    `RULES:`,
    ...pattern.deduplicationRules.map((r) => `  - ${r}`),
    `ANTI-PATTERNS:`,
    ...pattern.antiPatterns.map((a) => `  - ${a}`),
  ].join("\n");
};
