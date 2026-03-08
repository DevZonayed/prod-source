// =============================================================================
// Pattern Matcher
// Matches project descriptions against known application patterns.
// =============================================================================

import type { PatternId } from "../types";
import { matchPatterns, getPattern } from "../memory/level1-patterns";

export type PatternMatchResult = {
  matchedPattern: PatternId | null;
  confidence: number;
  matchedKeywords: string[];
  suggestedEntities: string[];
  suggestedScreens: string[];
  allMatches: Array<{
    patternId: PatternId;
    patternName: string;
    score: number;
  }>;
};

/**
 * Match a project description against all known patterns.
 * Returns the best match with confidence score and suggestions.
 */
export const matchProjectPattern = (
  description: string,
): PatternMatchResult => {
  const matches = matchPatterns(description);

  if (matches.length === 0) {
    return {
      matchedPattern: null,
      confidence: 0,
      matchedKeywords: [],
      suggestedEntities: [],
      suggestedScreens: [],
      allMatches: [],
    };
  }

  const best = matches[0];
  const pattern = best.pattern;

  // Extract which keywords matched
  const descLower = description.toLowerCase();
  const matchedKeywords = pattern.keywords.filter((kw) =>
    descLower.includes(kw),
  );

  return {
    matchedPattern: pattern.id,
    confidence: best.score,
    matchedKeywords,
    suggestedEntities: pattern.standardEntities.map((e) => e.name),
    suggestedScreens: pattern.standardScreens.map((s) => s.name),
    allMatches: matches.map((m) => ({
      patternId: m.pattern.id,
      patternName: m.pattern.name,
      score: m.score,
    })),
  };
};

/**
 * Get pattern-provided entities and screens for a matched pattern.
 */
export const getPatternDefaults = (patternId: PatternId) => {
  const pattern = getPattern(patternId);
  return {
    entities: pattern.standardEntities,
    screens: pattern.standardScreens,
    apiEndpoints: pattern.standardApiEndpoints,
    roles: pattern.standardRoles,
    businessRules: pattern.standardBusinessRules,
    deduplicationRules: pattern.deduplicationRules,
  };
};
