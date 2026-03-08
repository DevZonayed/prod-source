// =============================================================================
// Spec Engine — Facade
// Parses natural language into structured application specifications.
// =============================================================================

export { parseSpecFromEntities } from "./parser";
export { matchProjectPattern } from "./pattern-matcher";
export { validateSpec } from "./validator";
export type { SpecParseInput } from "./types";
export {
  specParseInputSchema,
  entityExtractionSchema,
  screenExtractionSchema,
  apiExtractionSchema,
  roleExtractionSchema,
  businessRuleExtractionSchema,
  patternMatchSchema,
  specValidationSchema,
} from "./types";
