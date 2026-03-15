// =============================================================================
// BuildForge Core Types
// The shared type system that flows through every BuildForge module.
// =============================================================================

import { type Vm } from "freestyle-sandboxes";

// -----------------------------------------------------------------------------
// Specification Types
// -----------------------------------------------------------------------------

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "enum"
  | "array"
  | "object"
  | "ref"
  | "file";

export type Field = {
  name: string;
  type: FieldType;
  required: boolean;
  unique?: boolean;
  indexed?: boolean;
  defaultValue?: string;
  enumValues?: string[];
  refEntity?: string;
  description?: string;
};

export type RelationshipType =
  | "has_one"
  | "has_many"
  | "belongs_to"
  | "many_to_many";

export type Relationship = {
  type: RelationshipType;
  targetEntity: string;
  foreignKey?: string;
  through?: string;
  description?: string;
};

export type Entity = {
  name: string;
  description: string;
  fields: Field[];
  relationships: Relationship[];
  businessRules: string[];
  indexes?: string[];
};

export type DataRequirement = {
  entity: string;
  fields: string[];
  filters?: string[];
  sort?: string;
  pagination?: boolean;
};

export type Interaction = {
  trigger: string;
  action: string;
  description: string;
};

export type ScreenState = {
  name: string;
  description: string;
};

export type Screen = {
  name: string;
  route: string;
  description: string;
  layout: string;
  accessRoles: string[];
  entities: string[];
  dataRequirements: DataRequirement[];
  interactions: Interaction[];
  states: ScreenState[];
  acceptanceCriteria: string[];
};

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiEndpoint = {
  method: HttpMethod;
  path: string;
  description: string;
  entity: string;
  authRequired: boolean;
  roles?: string[];
  requestBody?: string;
  responseShape?: string;
  rateLimit?: string;
};

export type Role = {
  name: string;
  description: string;
  permissions: string[];
  inheritsFrom?: string;
};

export type BusinessRule = {
  entity: string;
  rule: string;
  type: "validation" | "workflow" | "constraint" | "computation";
};

export type AppSpec = {
  name: string;
  description: string;
  patternId: PatternId | null;
  techStack: TechStack;
  entities: Entity[];
  screens: Screen[];
  apiEndpoints: ApiEndpoint[];
  roles: Role[];
  businessRules: BusinessRule[];
  createdAt: string;
  updatedAt: string;
};

// -----------------------------------------------------------------------------
// Pattern Types (Level 1 Memory)
// -----------------------------------------------------------------------------

export type PatternId =
  | "ecommerce"
  | "saas"
  | "marketplace"
  | "crm"
  | "cms"
  | "booking"
  | "social"
  | "lms";

export type PatternDefinition = {
  id: PatternId;
  name: string;
  description: string;
  keywords: string[];
  standardEntities: Entity[];
  standardScreens: Omit<Screen, "dataRequirements" | "interactions" | "states" | "acceptanceCriteria">[];
  standardApiEndpoints: ApiEndpoint[];
  standardRoles: Role[];
  standardBusinessRules: BusinessRule[];
  deduplicationRules: string[];
  antiPatterns: string[];
};

// -----------------------------------------------------------------------------
// Tech Stack Configuration
// -----------------------------------------------------------------------------

export type DatabaseType = "mongodb" | "mysql" | "postgresql";
export type AuthMethod = "jwt" | "session" | "oauth" | "nextauth";
export type ApiStyle = "rest" | "graphql" | "trpc";

export type TechStack = {
  frontend: "nextjs";
  backend: "nestjs" | "nextjs-api";
  database: DatabaseType;
  orm: string;
  cache: "redis" | "none";
  auth: AuthMethod;
  apiStyle: ApiStyle;
  stateManagement: "zustand";
  styling: "tailwind";
  uiLibrary: "shadcn";
  testing: {
    unit: "vitest" | "jest";
    e2e: "playwright" | "cypress";
  };
};

// -----------------------------------------------------------------------------
// Memory Types (Level 2 - Project Memory)
// -----------------------------------------------------------------------------

export type MemoryFileType =
  | "architecture"
  | "entities"
  | "components"
  | "api-endpoints"
  | "business-rules"
  | "ui-patterns"
  | "issues-resolved"
  | "changelog"
  | "decisions";

export type MemoryEntry = {
  content: string;
  updatedAt: string;
};

export type ProjectMemoryState = {
  initialized: boolean;
  files: Record<MemoryFileType, MemoryEntry | null>;
  spec: AppSpec | null;
};

// -----------------------------------------------------------------------------
// Context Assembly Types (Level 3)
// -----------------------------------------------------------------------------

export type ContextLayerId = "layer0" | "layer1" | "layer2" | "layer3";

export type ContextLayer = {
  id: ContextLayerId;
  name: string;
  content: string;
  tokenCount: number;
  maxTokens: number;
};

export type AssembledContext = {
  layers: ContextLayer[];
  totalTokens: number;
  budgetUsed: number;
  systemPrompt: string;
};

export type ContextAssemblyRequest = {
  taskDescription: string;
  taskType: TaskType;
  primaryEntity?: string;
  relatedEntities?: string[];
  screenName?: string;
  filePath?: string;
  pattern?: string;
};

// -----------------------------------------------------------------------------
// Thinker / Orchestrator Types
// -----------------------------------------------------------------------------

export type TaskType =
  | "spec_parse"
  | "frontend_page"
  | "frontend_component"
  | "frontend_form"
  | "frontend_layout"
  | "frontend_store"
  | "frontend_hook"
  | "backend_module"
  | "backend_api"
  | "backend_service"
  | "backend_auth"
  | "backend_model"
  | "design_system"
  | "design_component"
  | "test_unit"
  | "test_e2e"
  | "devops_docker"
  | "devops_ci"
  | "repo_analysis"
  | "general";

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type Task = {
  id: string;
  type: TaskType;
  description: string;
  dependencies: string[];
  status: TaskStatus;
  toolName: string;
  contextRequirements: {
    entities: string[];
    screens: string[];
    patterns: string[];
  };
  retryCount: number;
  maxRetries: number;
  result?: TaskResult;
  error?: string;
};

export type TaskResult = {
  filesCreated: string[];
  filesModified: string[];
  memoryUpdates: MemoryFileType[];
  validationPassed: boolean;
  summary: string;
};

export type ExecutionPlan = {
  id: string;
  featureDescription: string;
  tasks: Task[];
  executionOrder: string[][];
  estimatedSteps: number;
  status: "planning" | "executing" | "completed" | "failed";
  checkpoints: Checkpoint[];
  createdAt: string;
};

export type Checkpoint = {
  id: string;
  taskId: string;
  commitSha: string;
  description: string;
  createdAt: string;
};

// -----------------------------------------------------------------------------
// Tool System Types
// -----------------------------------------------------------------------------

export type ToolCategory = "base" | "memory";

export type BuildForgeContext = {
  vm: Vm;
  sourceRepoId?: string;
  metadataRepoId?: string;
  projectMemory: ProjectMemoryState;
  currentSpec: AppSpec | null;
  activePlan: ExecutionPlan | null;
};

// -----------------------------------------------------------------------------
// Design System Types
// -----------------------------------------------------------------------------

export type ColorScale = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
};

export type DesignTokens = {
  colors: {
    primary: ColorScale;
    secondary: ColorScale;
    accent: ColorScale;
    neutral: ColorScale;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  typography: {
    fontFamily: string;
    fontFamilyMono: string;
    scale: number[];
  };
  spacing: {
    base: number;
    scale: number[];
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  breakpoints: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    "2xl": number;
  };
};

// -----------------------------------------------------------------------------
// Validation Types
// -----------------------------------------------------------------------------

export type ValidationSeverity = "error" | "warning" | "info";

export type ValidationIssue = {
  severity: ValidationSeverity;
  category: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
};

export type ValidationResult = {
  passed: boolean;
  issues: ValidationIssue[];
  summary: string;
};
