// =============================================================================
// Memory File Templates
// Initial content for each project memory file.
// =============================================================================

import type { MemoryFileType } from "../../types";

export const MEMORY_TEMPLATES: Record<MemoryFileType, string> = {
  architecture: `# Architecture — {{PROJECT_NAME}}
> Last updated: {{DATE}}

## Tech Stack
{{TECH_STACK}}

## Project Structure
<!-- Auto-populated as project is scaffolded -->

## Coding Conventions
- TypeScript strict mode, no 'any' types
- Functional React components with hooks
- File naming: kebab-case for files, PascalCase for components
- API responses: { success: boolean, data: T, message: string }
- Error handling: error boundaries in frontend, custom exceptions in backend

## Design System
<!-- Populated by design system initialization -->
`,

  entities: `# Entities — {{PROJECT_NAME}}
> Last updated: {{DATE}}

<!-- Each entity has: name, fields, relationships, business rules -->
<!-- Format:
## EntityName
**Description**: ...
**Fields**: field(type), field(type), ...
**Relationships**: has_many X, belongs_to Y
**Business Rules**: ...
**Indexes**: ...
-->
`,

  components: `# Components — {{PROJECT_NAME}}
> Last updated: {{DATE}}

<!-- Each component has: name, file path, props, usage context -->
<!-- Format:
## ComponentName
**Path**: src/components/...
**Props**: { prop: Type, ... }
**Used in**: PageA, PageB
**Pattern**: DataTable | Form | Card | Modal | ...
-->
`,

  "api-endpoints": `# API Endpoints — {{PROJECT_NAME}}
> Last updated: {{DATE}}

<!-- Each endpoint has: method, path, description, auth, roles -->
<!-- Format:
## Module Name
- METHOD /api/path — Description [auth: role1, role2]
  Request: { field: type }
  Response: { field: type }
-->
`,

  "business-rules": `# Business Rules — {{PROJECT_NAME}}
> Last updated: {{DATE}}

<!-- Organized by entity/domain -->
<!-- Format:
## EntityName
- VALIDATION: Rule description
- WORKFLOW: State transition rule
- CONSTRAINT: Invariant rule
- COMPUTATION: Derived value rule
-->
`,

  "ui-patterns": `# UI Patterns — {{PROJECT_NAME}}
> Last updated: {{DATE}}

## Layout Patterns
<!-- Dashboard, public, auth, admin layouts -->

## Component Patterns
<!-- DataTable, EntityForm, DetailView, Modal patterns -->

## Design Tokens
<!-- Colors, typography, spacing extracted from design system -->

## Responsive Rules
<!-- Breakpoint behaviors, mobile adaptations -->
`,

  "issues-resolved": `# Issues Resolved — {{PROJECT_NAME}}
> Last updated: {{DATE}}

<!-- Chronological log of issues encountered and their solutions -->
<!-- Format:
## [TIMESTAMP]
**Issue**: Description of the problem
**Root Cause**: What caused it
**Solution**: How it was fixed
**Prevention**: How to prevent it in future
-->
`,

  changelog: `# Changelog — {{PROJECT_NAME}}
> Last updated: {{DATE}}

<!-- Chronological record of all significant changes -->
<!-- Format:
## [TIMESTAMP]
- Added: ...
- Modified: ...
- Removed: ...
-->
`,

  decisions: `# Architectural Decisions — {{PROJECT_NAME}}
> Last updated: {{DATE}}

<!-- Record of key decisions with reasoning -->
<!-- Format:
## Decision Title
**Date**: YYYY-MM-DD
**Status**: Accepted | Superseded | Deprecated
**Context**: Why this decision was needed
**Options Considered**: Option A, Option B, ...
**Decision**: What was chosen
**Reasoning**: Why this option was selected
**Consequences**: Trade-offs and implications
-->
`,
};
