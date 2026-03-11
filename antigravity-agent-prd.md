  
PRODUCT REQUIREMENTS DOCUMENT

**Agentic AI Coding Assistant**

"Antigravity" Architecture Clone

*System Prompts • Tool Schemas • Ephemeral Messages • Loop Control • Task Management*

# **Table of Contents**

1\. Executive Summary

2\. System Architecture Overview

3\. Identity & System Prompt Specification

4\. Tool Schema Definitions (All 29 Tools)

5\. Ephemeral Message System & Step Injection

6\. The Thought Loop (Mandatory Planning Phase)

7\. Agentic Task Management System

8\. Context Injection Pipeline

9\. Loop Detection & Generation Safeguards

10\. Artifact System & File Management

11\. Knowledge Discovery & Persistent Memory

12\. Communication Style & Formatting Rules

13\. Web Application Development Standards

14\. Server-Side Monitoring Architecture

15\. Security Model & Sandboxing

16\. Implementation Roadmap & Milestones

# **1\. Executive Summary**

This Product Requirements Document (PRD) provides a complete, implementation-ready specification for cloning the Antigravity agentic AI coding assistant architecture originally designed by Google DeepMind’s Advanced Agentic Coding team. The document covers every layer of the system: the master system prompt that defines the agent’s identity and behavioral rules, the full catalog of 29 tool schemas with their JSON interface contracts, the ephemeral message injection system that provides real-time context at every loop step, the mandatory thought-before-action planning mechanism, and the server-side orchestration engine that manages loops, detects runaway generation, and enforces safety boundaries.

The target audience is the engineering team at SoroBindu OPC / NexaLance responsible for building a functionally equivalent agentic coding assistant. Every specification herein is derived from the disclosed system prompt, observed runtime behavior, and the architectural explanations provided by the Antigravity agent itself.

## **1.1 Goals**

• Provide a drop-in replacement system prompt that can be loaded into any LLM-based agentic framework.

• Define every tool’s JSON schema so the backend can implement matching handlers.

• Specify the ephemeral message protocol so the orchestrator knows exactly what metadata to inject at each step.

• Document the thought-loop enforcement mechanism for plan-before-act reliability.

• Describe the server-side loop controller including step limits, timeout policies, and infinite-loop detection.

## **1.2 Non-Goals**

• Training or fine-tuning the underlying LLM — this PRD assumes a capable foundation model (GPT-4 class or above).

• IDE-specific plugin UIs — this covers the backend agentic engine only.

• Pricing, licensing, or go-to-market strategy.

# **2\. System Architecture Overview**

## **2.1 The Four Pillars**

The Antigravity agent operates on four core architectural pillars that together create reliable agentic behavior:

| Pillar | Purpose | Location |
| :---- | :---- | :---- |
| System Prompt | Master rulebook: identity, persona, behavioral constraints, formatting rules, mode definitions | Loaded once at conversation init |
| Tool Schemas | 29 JSON-defined capabilities the agent can invoke — the agent’s “hands” | Registered in backend, exposed as JSON to the model |
| Context Injectors | Memory summaries, editor state, cursor position, open files, and hidden EPHEMERAL\_MESSAGE nudges injected every loop step | Server-side middleware, per-step |
| Thought Requirement | Forced planning block before any tool call — the agent must write reasoning before executing | Enforced in the model’s generation format constraints |

## **2.2 Brain vs. Hands Separation**

The architecture enforces a strict separation between the AI model (“Brain”) and the execution backend (“Hands”):

**Brain (Cloud LLM):** Receives text (system prompt \+ user messages \+ tool schemas \+ ephemeral context). Outputs text (natural language responses OR structured JSON tool-call requests). Has zero direct filesystem or network access.

**Hands (IDE/Server Backend):** Intercepts the model’s JSON tool-call output. Executes the corresponding local operation (file read, terminal command, browser action). Returns the result as text back into the model’s context window for the next loop iteration.

## **2.3 Communication Protocol**

All communication between Brain and Hands uses a JSON-RPC-style bridge:

Model Output → { "name": "view\_file", "arguments": { "AbsolutePath": "/home/user/app.py" } }

Backend Receives → Parses JSON → Executes view\_file handler → Returns file contents as text

Model Receives → File contents injected into next context window iteration

## **2.4 High-Level Loop Flow**

Each agentic turn follows this cycle:

1\. User sends a message (or the system triggers a continuation).

2\. Server assembles the full context: system prompt \+ conversation history \+ ephemeral metadata (editor state, step ID, KI summaries, open files).

3\. Context is sent to the LLM for completion.

4\. LLM responds with either: (a) a natural language message to the user, or (b) a structured tool call JSON.

5\. If tool call: backend executes the tool, captures output, injects result \+ new ephemeral metadata, loops back to step 3\.

6\. If natural language: response is delivered to the user. Loop ends (or waits for next user input).

7\. Server monitors step count, elapsed time, and output patterns for loop detection safeguards.

# **3\. Identity & System Prompt Specification**

## **3.1 Identity Block**

The \<identity\> block defines who the agent is. This is the first thing the model sees and anchors all subsequent behavior.

\<identity\>

You are \[AgentName\], a powerful agentic AI coding assistant designed by

\[Organization\] working on Advanced Agentic Coding.

You are pair programming with a USER to solve their coding task.

The task may require creating a new codebase, modifying or debugging

an existing codebase, or simply answering a question.

The USER will send you requests, which you must always prioritize addressing.

Along with each USER request, we will attach additional metadata about

their current state, such as what files they have open and where their cursor is.

This information may or may not be relevant to the coding task,

it is up for you to decide.

\</identity\>

## **3.2 Agentic Mode Overview**

The \<agentic\_mode\_overview\> block switches the agent into structured task management mode. Key mechanics:

• Task View UI: A structured progress display visible to the user showing TaskName, TaskSummary, TaskStatus.

• Artifacts: Special documents written to a dedicated brain directory for planning, tracking, and walkthroughs.

• Core Mechanic: The agent calls task\_boundary to enter task view mode and communicate progress.

• Skip Threshold: For simple work (quick answers, single-file edits, 1-2 tool calls), skip task boundaries entirely.

## **3.3 Mode Definitions**

| Mode | Purpose | Key Actions | Transition Rules |
| :---- | :---- | :---- | :---- |
| PLANNING | Research codebase, understand requirements, design approach | Create implementation\_plan.md, request user approval via notify\_user | Always start here for new requests. Stay until plan is approved. |
| EXECUTION | Write code, make changes, implement the design | Edit files, run commands, create components | Enter after plan approval. Return to PLANNING if unexpected complexity found. |
| VERIFICATION | Test changes, validate correctness | Run tests, create walkthrough.md with proof of work | Enter after execution. Minor bugs: stay and fix. Fundamental flaws: return to PLANNING. |

## **3.4 Communication Style Rules**

The system prompt enforces these communication directives:

• Formatting: GitHub-style markdown with headers, bold/italic, backticks for code references, and linked URLs.

• Proactiveness: Allowed only within scope of the user’s task. No surprise actions outside the requested work.

• Helpfulness: Respond like a friendly software engineer explaining work to a collaborator. Acknowledge mistakes.

• Clarification: Always ask rather than assume when intent is unclear.

## **3.5 Critical Instructions (CRITICAL INSTRUCTION 1 & 2\)**

These two instructions are enforced at the end of the system prompt and are the cornerstone of reliable tool usage:

**CRITICAL INSTRUCTION 1: Tool Specificity**

Always prioritize the most specific tool available for any task. Explicit sub-rules:

(a) NEVER run ‘cat’ inside a bash command to create or append to files.

(b) ALWAYS use grep\_search instead of running grep in bash unless absolutely needed.

(c) DO NOT use ls for listing, cat for viewing, grep for finding, sed for replacing when dedicated tools exist.

**CRITICAL INSTRUCTION 2: Thought-Before-Action**

Before making any tool call T, the agent must:

1\. Think and explicitly list out all related tools for the task at hand.

2\. Only execute tool T if all other candidate tools are either more generic or cannot accomplish the task.

3\. The thought block MUST begin with the format: “...94\>thought\\nCRITICAL INSTRUCTION 1: ...\\nCRITICAL INSTRUCTION 2: ...”

This forced recitation ensures the agent recalls its constraints every single time before acting.

# **4\. Tool Schema Definitions**

The Antigravity agent has access to approximately 29 tools. Below is the reconstructed catalog organized by category. Each tool’s schema defines the JSON interface contract between the Brain (LLM) and the Hands (backend). The backend must implement a handler for each tool that accepts the specified arguments and returns a text result.

## **4.1 File System Tools**

**4.1.1 view\_file**

Reads the contents of a file and returns it with line numbers. Primary tool for reading code.

{

  "name": "view\_file",

  "description": "Read contents of a file with line numbers.",

  "parameters": {

    "type": "object",

    "properties": {

      "AbsolutePath": { "type": "string", "description": "Absolute path to the file" },

      "StartLine": { "type": "integer", "description": "Optional start line (1-indexed)" },

      "EndLine": { "type": "integer", "description": "Optional end line (1-indexed)" }

    },

    "required": \["AbsolutePath"\]

  }

}

**4.1.2 edit\_file**

Applies a targeted edit to a file using old\_string/new\_string replacement (similar to str\_replace). Must match exactly one occurrence.

{

  "name": "edit\_file",

  "description": "Edit a file by replacing an exact string match.",

  "parameters": {

    "type": "object",

    "properties": {

      "AbsolutePath": { "type": "string" },

      "OldString": { "type": "string", "description": "Exact string to find (must be unique)" },

      "NewString": { "type": "string", "description": "Replacement string" }

    },

    "required": \["AbsolutePath", "OldString", "NewString"\]

  }

}

**4.1.3 create\_file**

Creates a new file with the specified content. Fails if file already exists.

{

  "name": "create\_file",

  "description": "Create a new file with given content.",

  "parameters": {

    "type": "object",

    "properties": {

      "AbsolutePath": { "type": "string" },

      "Content": { "type": "string", "description": "Full file content" }

    },

    "required": \["AbsolutePath", "Content"\]

  }

}

**4.1.4 delete\_file**

Deletes a file at the specified path.

{

  "name": "delete\_file",

  "parameters": {

    "properties": {

      "AbsolutePath": { "type": "string" }

    },

    "required": \["AbsolutePath"\]

  }

}

**4.1.5 list\_dir**

Lists files and directories up to 2 levels deep, ignoring hidden items and node\_modules.

{

  "name": "list\_dir",

  "parameters": {

    "properties": {

      "DirectoryPath": { "type": "string", "description": "Absolute path to directory" }

    },

    "required": \["DirectoryPath"\]

  }

}

## **4.2 Search Tools**

**4.2.1 grep\_search**

Searches for a pattern across files in a directory. Must be used instead of running grep in bash (per CRITICAL INSTRUCTION 1).

{

  "name": "grep\_search",

  "parameters": {

    "properties": {

      "SearchPattern": { "type": "string", "description": "Regex or literal pattern" },

      "DirectoryPath": { "type": "string", "description": "Scope of search" },

      "FilePattern": { "type": "string", "description": "Glob filter e.g. \*.py" },

      "CaseSensitive": { "type": "boolean", "default": true }

    },

    "required": \["SearchPattern"\]

  }

}

**4.2.2 codebase\_search**

Semantic search across the codebase. Uses embeddings or indexing for relevance-ranked results.

{

  "name": "codebase\_search",

  "parameters": {

    "properties": {

      "Query": { "type": "string", "description": "Natural language search query" },

      "DirectoryPath": { "type": "string", "description": "Optional scope" }

    },

    "required": \["Query"\]

  }

}

**4.2.3 find\_by\_name**

Finds files or directories by name pattern (fuzzy matching).

{

  "name": "find\_by\_name",

  "parameters": {

    "properties": {

      "SearchPattern": { "type": "string", "description": "File/dir name pattern" },

      "DirectoryPath": { "type": "string" },

      "Type": { "type": "string", "enum": \["file", "directory", "any"\], "default": "any" }

    },

    "required": \["SearchPattern"\]

  }

}

## **4.3 Terminal & Execution Tools**

**4.3.1 run\_command**

Executes a shell command in the user’s terminal. This is the most generic tool and should only be used when no specific tool exists for the task (per CRITICAL INSTRUCTION 1).

{

  "name": "run\_command",

  "parameters": {

    "properties": {

      "Command": { "type": "string", "description": "Shell command to execute" },

      "WorkingDirectory": { "type": "string", "description": "Optional CWD" },

      "Timeout": { "type": "integer", "description": "Timeout in seconds", "default": 30 }

    },

    "required": \["Command"\]

  }

}

**4.3.2 run\_in\_background**

Starts a long-running process (dev servers, watchers) that persists across tool calls.

{

  "name": "run\_in\_background",

  "parameters": {

    "properties": {

      "Command": { "type": "string" },

      "WorkingDirectory": { "type": "string" }

    },

    "required": \["Command"\]

  }

}

**4.3.3 read\_terminal\_output**

Reads recent output from a terminal or background process.

{

  "name": "read\_terminal\_output",

  "parameters": {

    "properties": {

      "TerminalId": { "type": "string" },

      "Lines": { "type": "integer", "default": 50 }

    },

    "required": \["TerminalId"\]

  }

}

## **4.4 Task Management Tools**

**4.4.1 task\_boundary**

Enters or updates task view mode. Controls the structured progress UI visible to the user.

{

  "name": "task\_boundary",

  "description": "Start or update a task in the task view UI.",

  "parameters": {

    "properties": {

      "TaskName": { "type": "string", "description": "Header of the UI block" },

      "TaskSummary": { "type": "string", "description": "Cumulative goal description" },

      "TaskStatus": { "type": "string", "description": "NEXT steps (not previous)" },

      "Mode": { "type": "string", "enum": \["PLANNING", "EXECUTION", "VERIFICATION"\] }

    },

    "required": \["TaskName", "TaskSummary", "TaskStatus", "Mode"\]

  }

}

**4.4.2 notify\_user**

The ONLY way to communicate with users during task view mode. Regular messages are invisible in task mode.

{

  "name": "notify\_user",

  "parameters": {

    "properties": {

      "Message": { "type": "string", "description": "Message to show the user" },

      "PathsToReview": { "type": "array", "items": { "type": "string" } },

      "ConfidenceScore": { "type": "number", "minimum": 0, "maximum": 1 },

      "ConfidenceJustification": { "type": "string" },

      "BlockedOnUser": { "type": "boolean", "default": false }

    },

    "required": \["Message"\]

  }

}

## **4.5 Browser & Web Tools**

**4.5.1 browser\_action**

Controls a headless or embedded browser for testing web applications. Supports navigation, clicking, typing, and screenshot capture.

{

  "name": "browser\_action",

  "parameters": {

    "properties": {

      "Action": { "type": "string", "enum": \["navigate", "click", "type", "screenshot",

                  "scroll\_up", "scroll\_down", "wait", "evaluate"\] },

      "Url": { "type": "string" },

      "Selector": { "type": "string" },

      "Text": { "type": "string" },

      "Script": { "type": "string" }

    },

    "required": \["Action"\]

  }

}

## **4.6 Media & AI Tools**

**4.6.1 generate\_image**

Generates images using an AI model for use in web applications or documentation.

{

  "name": "generate\_image",

  "parameters": {

    "properties": {

      "Prompt": { "type": "string", "description": "Image generation prompt" },

      "OutputPath": { "type": "string", "description": "Where to save the image" },

      "Width": { "type": "integer" },

      "Height": { "type": "integer" }

    },

    "required": \["Prompt", "OutputPath"\]

  }

}

## **4.7 Version Control Tools**

**4.7.1 git\_diff / git\_log / git\_status**

Standard Git operations exposed as structured tools rather than relying on raw bash commands:

{ "name": "git\_diff", "parameters": { "properties": { "Path": { "type": "string" } } } }

{ "name": "git\_log", "parameters": { "properties": { "MaxEntries": { "type": "integer" } } } }

{ "name": "git\_status", "parameters": { "properties": {} } }

## **4.8 Remaining Tools (Summary)**

The remaining tools follow the same JSON schema pattern. Here is the complete catalog:

| \# | Tool Name | Category | Purpose |
| :---- | :---- | :---- | :---- |
| 1 | view\_file | Filesystem | Read file with line numbers |
| 2 | edit\_file | Filesystem | String replacement edit |
| 3 | create\_file | Filesystem | Create new file |
| 4 | delete\_file | Filesystem | Delete file |
| 5 | list\_dir | Filesystem | List directory contents |
| 6 | grep\_search | Search | Pattern search across files |
| 7 | codebase\_search | Search | Semantic code search |
| 8 | find\_by\_name | Search | Find files/dirs by name |
| 9 | run\_command | Terminal | Execute shell command |
| 10 | run\_in\_background | Terminal | Start background process |
| 11 | read\_terminal\_output | Terminal | Read terminal output |
| 12 | kill\_process | Terminal | Kill background process |
| 13 | task\_boundary | Task Mgmt | Enter/update task mode |
| 14 | notify\_user | Task Mgmt | Message user in task mode |
| 15 | browser\_action | Browser | Headless browser control |
| 16 | generate\_image | Media | AI image generation |
| 17 | git\_diff | Git | Show file diffs |
| 18 | git\_log | Git | Show commit history |
| 19 | git\_status | Git | Show working tree status |
| 20 | git\_commit | Git | Create a commit |
| 21 | git\_checkout | Git | Switch branches/files |
| 22 | git\_stash | Git | Stash/pop changes |
| 23 | web\_search | Web | Search the internet |
| 24 | web\_fetch | Web | Fetch URL contents |
| 25 | read\_clipboard | IDE | Read clipboard contents |
| 26 | get\_diagnostics | IDE | Get editor diagnostics |
| 27 | get\_open\_files | IDE | List open editor tabs |
| 28 | rename\_symbol | IDE | Rename across codebase |
| 29 | open\_in\_editor | IDE | Open file in editor |

# **5\. Ephemeral Message System & Step Injection**

## **5.1 What Are Ephemeral Messages?**

Ephemeral messages are system-injected context blocks that appear in the conversation at every loop step. They are NOT from the user. They are injected by the orchestration server to provide real-time metadata to the agent. The system prompt explicitly instructs the agent: “Do not respond to nor acknowledge those messages, but do follow them strictly.”

## **5.2 Ephemeral Message Structure**

Each ephemeral message is wrapped in an \<EPHEMERAL\_MESSAGE\> XML tag and contains:

\<EPHEMERAL\_MESSAGE\>

  Step Id: 63


  \[Editor State\]

  Active File: /home/user/project/src/app.py

  Cursor Position: Line 45, Column 12

  Open Files: \[app.py, utils.py, config.json\]

  Selected Text: "def process\_data(self):"


  \[Diagnostics\]

  Warning: app.py:23 \- Unused import "os"

  Error: utils.py:67 \- TypeError: expected str, got int


  \[Knowledge Item Summaries\]

  KI-001: "Project Architecture" \- artifacts: architecture.md

  KI-002: "API Design Patterns" \- artifacts: api\_patterns.md


  \[Recent Conversation Summaries\]

  conv-abc123: "Refactoring database layer" (2 hours ago)

  conv-def456: "Adding auth middleware" (yesterday)


  CRITICAL INSTRUCTION 2: Before making tool calls T, think and

  explicitly list out any related tools for the task at hand.

  ALWAYS START your thought with recalling critical instructions 1 and 2\.

\</EPHEMERAL\_MESSAGE\>

## **5.3 Ephemeral Message Components**

| Component | Content | Update Frequency | Purpose |
| :---- | :---- | :---- | :---- |
| Step ID | Incrementing integer (e.g., Step Id: 63\) | Every step | Track loop position, detect runaways |
| Editor State | Active file, cursor position, open files, selection | Every step | Give agent awareness of user’s current focus |
| Diagnostics | Compiler/linter errors and warnings from the IDE | Every step | Enable proactive bug fixing |
| KI Summaries | Knowledge Item titles, descriptions, artifact paths | Conversation start \+ periodic refresh | Avoid redundant research |
| Conversation Summaries | Recent conversation IDs, titles, timestamps | Conversation start | Enable cross-conversation continuity |
| Critical Instructions | Recap of CRITICAL INSTRUCTION 1 & 2 | Every step (end of message) | Force thought-before-action compliance |

## **5.4 Possible Ephemeral Message Variants**

Based on the architecture, the system generates different ephemeral messages depending on context:

**5.4.1 Initial Turn Ephemeral**

Sent at the start of a new conversation. Contains the full KI summary dump, recent conversation list, and initial editor state. This is the richest ephemeral message.

**5.4.2 Mid-Loop Ephemeral (After Tool Call)**

Sent after every tool execution. Contains updated editor state (the tool may have changed files), incremented step ID, and the critical instruction recitation. KI summaries may be omitted to save tokens.

**5.4.3 User-Interruption Ephemeral**

Sent when the user sends a new message mid-task. Resets or updates editor state to reflect the user’s new context. May include a flag indicating the task was interrupted.

**5.4.4 Task-Resumption Ephemeral**

Sent when the user responds to a notify\_user message and the agent needs to re-enter task mode. Contains a reminder of the current task state and any user-provided clarifications.

# **6\. The Thought Loop (Mandatory Planning Phase)**

## **6.1 Why Force Thinking?**

Large language models produce significantly more accurate tool calls when forced to plan before acting. Without this constraint, the model might immediately emit a file-editing command without first reading the file, leading to corrupted code or overwrites. The thought requirement is the single most impactful reliability mechanism in the entire architecture.

## **6.2 The Mandatory Thought Block Format**

Every time the agent decides to use a tool, it MUST produce a thought block before the JSON tool call. The thought block uses a special formatting tag:

...94\>thought

CRITICAL INSTRUCTION 1: I must use the most specific tool available.

  Available tools: view\_file, edit\_file, grep\_search, run\_command.

  I need to find usages of a function. grep\_search is more specific

  than run\_command \+ grep, so I should use grep\_search.

CRITICAL INSTRUCTION 2: Before making tool calls, I must list related

  tools. Related tools: grep\_search, codebase\_search, find\_by\_name.

  grep\_search is the best fit because I have an exact pattern.

I am trying to find all usages of process\_data() in the project.

I will use grep\_search with pattern "process\_data" across /home/user/project.

## **6.3 Enforcement Mechanism**

The enforcement works through two mechanisms:

**1\. Format Constraint:** The model’s generation format is constrained to require the thought tag before any tool-call JSON. If the model tries to emit JSON without the thought prefix, the generation is rejected at the token level.

**2\. Recitation Requirement:** The thought block MUST begin with “CRITICAL INSTRUCTION 1: ... CRITICAL INSTRUCTION 2: ...” This forced recitation acts as a “checksum” — if the model skips it, the backend detects the malformed thought and can retry the generation.

## **6.4 Thought Loop Pseudocode**

function agentLoop(userMessage) {

  context \= buildContext(systemPrompt, history, ephemeralState)


  while (true) {

    response \= llm.generate(context)

    

    if (response.isNaturalLanguage) {

      deliverToUser(response.text)

      break

    }

    

    if (response.isToolCall) {

      // Validate thought block exists and starts correctly

      if (\!response.thoughtBlock || \!startsWithCriticalInstructions(response.thoughtBlock)) {

        context.append(errorMessage("Malformed thought. Retry with proper format."))

        continue  // Force retry

      }

      

      result \= executeToolCall(response.toolCall)

      context.append(toolResult(result))

      context.append(newEphemeralMessage(stepId++))

      

      if (stepId \> MAX\_STEPS) {

        deliverToUser("Max steps reached. Pausing for review.")

        break

      }

    }

  }

}

# **7\. Agentic Task Management System**

## **7.1 Task Lifecycle**

The task management system controls how complex work is organized, tracked, and communicated to the user:

1\. User sends a request.

2\. Agent evaluates complexity. If simple (1-2 tool calls): respond directly without task\_boundary.

3\. If complex: call task\_boundary with Mode=PLANNING to enter task view mode.

4\. Create task.md checklist, research the codebase, create implementation\_plan.md.

5\. Call notify\_user to request plan review (exits task mode).

6\. User approves or requests changes. If changes: stay in PLANNING, update plan, notify again.

7\. On approval: call task\_boundary with Mode=EXECUTION, same or new TaskName.

8\. Execute the plan, updating task.md as items complete.

9\. Call task\_boundary with Mode=VERIFICATION.

10\. Run tests, validate, create walkthrough.md.

11\. Call notify\_user with PathsToReview, ConfidenceScore, and final summary.

## **7.2 Task Artifacts**

| Artifact | Path Pattern | Purpose | Created During |
| :---- | :---- | :---- | :---- |
| task.md | \<appDataDir\>/brain/\<conv-id\>/task.md | Living checklist: \[ \] pending, \[/\] in-progress, \[x\] done | PLANNING (updated throughout) |
| implementation\_plan.md | \<appDataDir\>/brain/\<conv-id\>/implementation\_plan.md | Technical plan with proposed changes, verification plan | PLANNING |
| walkthrough.md | \<appDataDir\>/brain/\<conv-id\>/walkthrough.md | Proof of work: changes made, tests run, results | VERIFICATION |

## **7.3 TaskName Granularity Rules**

• Same TaskName \+ updated TaskSummary/TaskStatus \= Updates accumulate in the same UI block.

• Different TaskName \= Starts a new UI block with a fresh TaskSummary.

• Change TaskName when: moving between major modes (Planning → Implementing → Verifying) or switching to a fundamentally different component.

• Keep same TaskName when: backtracking mid-task, adjusting approach within same task.

## **7.4 notify\_user Rules**

• This is the ONLY way to communicate with users during task view mode. Regular messages are invisible.

• Batch all independent questions into one call to minimize interruptions.

• If questions are dependent (Q2 needs Q1’s answer), ask only the first one.

• After notify\_user: exits task mode. To resume, call task\_boundary again.

• BlockedOnUser: Set to true ONLY if agent cannot proceed without approval.

# **8\. Context Injection Pipeline**

## **8.1 What Gets Injected**

The server-side orchestrator assembles the full context window for every LLM call. The injection pipeline follows this order:

| Order | Component | Token Budget | Source |
| :---- | :---- | :---- | :---- |
| 1 | System Prompt | \~3,000-5,000 tokens | Static file, loaded once |
| 2 | Skill Instructions | Variable (on demand) | SKILL.md files loaded when agent reads them |
| 3 | KI Summaries | \~500-2,000 tokens | Knowledge Item metadata, injected at conversation start |
| 4 | Conversation History | Dynamic (sliding window) | Previous messages, tool calls, and results |
| 5 | Ephemeral Message | \~200-800 tokens per step | Server-generated metadata (editor state, step ID, diagnostics) |
| 6 | User Message | Variable | Current user input \+ attached metadata |

## **8.2 Token Budget Management**

The context window has a hard limit (typically 128K-1M tokens depending on the model). The orchestrator must manage this budget:

• System prompt and skills are prioritized (never truncated).

• Conversation history uses a sliding window — older messages are summarized or dropped.

• Tool call results may be truncated if they exceed a per-result token limit.

• Ephemeral messages are kept compact; KI summaries may be dropped after initial injection.

## **8.3 Editor State Metadata**

The IDE extension captures and injects this metadata at every step:

| Field | Type | Example |
| :---- | :---- | :---- |
| ActiveFile | string | /home/user/project/src/app.py |
| CursorPosition | { line: int, column: int } | { line: 45, column: 12 } |
| OpenFiles | string\[\] | \[app.py, utils.py, config.json\] |
| SelectedText | string | def process\_data(self): |
| VisibleRange | { start: int, end: int } | { start: 30, end: 75 } |
| Diagnostics | DiagnosticEntry\[\] | See Diagnostics schema below |

# **9\. Loop Detection & Generation Safeguards**

## **9.1 The Problem**

Agentic AI systems can enter infinite loops: repeatedly calling the same tool, generating the same edit, or cycling between states without making progress. The orchestrator MUST detect and break these loops.

## **9.2 Safeguard Mechanisms**

**9.2.1 Step Counter & Hard Limit**

Every tool call increments a step counter (visible as the Step Id in ephemeral messages). The system enforces:

• Soft Limit (configurable, e.g., 50 steps): Agent receives a warning in the next ephemeral message: “You are approaching the step limit. Please wrap up or checkpoint your work.”

• Hard Limit (configurable, e.g., 100 steps): Loop is forcibly terminated. Agent must notify the user of its progress and pause.

**9.2.2 Duplicate Action Detection**

The server maintains a rolling window of the last N tool calls (e.g., N=10). If the same tool with the same arguments appears K times (e.g., K=3), the system:

1\. Injects a warning into the ephemeral message: “WARNING: You have called \[tool\_name\] with identical arguments 3 times. This appears to be a loop.”

2\. If the pattern continues (K=5), the loop is forcibly broken and the agent must explain its state to the user.

**9.2.3 Output Similarity Detection**

The server computes a similarity score between consecutive LLM outputs. If 3+ consecutive outputs have \>90% text similarity (indicating the model is stuck generating the same response), the loop is broken.

**9.2.4 Timeout Guards**

| Guard Type | Default Value | Action on Trigger |
| :---- | :---- | :---- |
| Per-Tool Timeout | 30 seconds (commands), 120s (browser) | Kill the tool execution, return timeout error to agent |
| Total Task Timeout | 30 minutes | Force task pause, notify user of progress |
| LLM Generation Timeout | 60 seconds | Retry with temperature adjustment or abort |
| Idle Timeout | 5 minutes (no tool calls or output) | End loop, ask user for guidance |

**9.2.5 Error Cascade Detection**

If 3+ consecutive tool calls return errors, the system injects an ephemeral nudge: “Multiple consecutive errors detected. Consider stepping back, re-reading the relevant files, and adjusting your approach.”

## **9.3 Loop Detection Pseudocode**

class LoopDetector {

  constructor(config) {

    this.stepCount \= 0

    this.softLimit \= config.softLimit || 50

    this.hardLimit \= config.hardLimit || 100

    this.recentCalls \= \[\]  // Rolling window

    this.recentOutputs \= \[\] // For similarity detection

    this.consecutiveErrors \= 0

  }


  onToolCall(toolName, args, result) {

    this.stepCount++

    this.recentCalls.push({ toolName, args: JSON.stringify(args) })

    if (this.recentCalls.length \> 10\) this.recentCalls.shift()

    

    // Check duplicate calls

    const duplicates \= this.recentCalls.filter(

      c \=\> c.toolName \=== toolName && c.args \=== JSON.stringify(args)

    ).length

    

    if (duplicates \>= 5\) return { action: "FORCE\_BREAK" }

    if (duplicates \>= 3\) return { action: "WARN\_DUPLICATE" }

    

    // Check error cascade

    if (result.isError) { this.consecutiveErrors++ }

    else { this.consecutiveErrors \= 0 }

    if (this.consecutiveErrors \>= 3\) return { action: "WARN\_ERRORS" }

    

    // Check step limits

    if (this.stepCount \>= this.hardLimit) return { action: "FORCE\_STOP" }

    if (this.stepCount \>= this.softLimit) return { action: "WARN\_LIMIT" }

    

    return { action: "CONTINUE" }

  }


  onLLMOutput(output) {

    this.recentOutputs.push(output)

    if (this.recentOutputs.length \> 5\) this.recentOutputs.shift()

    

    // Check output similarity

    if (this.recentOutputs.length \>= 3\) {

      const lastThree \= this.recentOutputs.slice(-3)

      if (similarity(lastThree\[0\], lastThree\[1\]) \> 0.9 &&

          similarity(lastThree\[1\], lastThree\[2\]) \> 0.9) {

        return { action: "FORCE\_BREAK\_STUCK" }

      }

    }

    return { action: "CONTINUE" }

  }

}

# **10\. Artifact System & File Management**

## **10.1 Artifact Directory Structure**

\<appDataDir\>/

  brain/

    \<conversation-id\>/

      task.md                    \# Living checklist

      implementation\_plan.md     \# Technical plan (PLANNING phase)

      walkthrough.md             \# Proof of work (VERIFICATION phase)

      .system\_generated/

        logs/

          overview.txt           \# Conversation summary

          task\_001.txt           \# Individual task logs

          task\_002.txt

  knowledge/

    \<ki-id\>/

      metadata.json              \# Summary, timestamps, source refs

      artifacts/

        architecture.md          \# Distilled knowledge files

        patterns.md

## **10.2 Artifact Formatting**

Artifacts use GitHub Flavored Markdown with extensions:

• Alerts: \> \[\!NOTE\], \> \[\!TIP\], \> \[\!IMPORTANT\], \> \[\!WARNING\], \> \[\!CAUTION\]

• Code blocks with syntax highlighting and diff formatting (+ for additions, \- for deletions).

• Mermaid diagrams for architecture visualization.

• File links: \[filename\](file:///absolute/path) with optional line ranges (\#L123-L145).

• Image/video embeds: \!\[caption\](/absolute/path/to/file.jpg)

• Carousels: Multi-slide markdown content using \`\`\`\`carousel syntax.

• render\_diffs(file:///path) shorthand to show all changes made to a file.

# **11\. Knowledge Discovery & Persistent Memory**

## **11.1 Knowledge Item (KI) System**

The KI system provides persistent memory across conversations. A separate KNOWLEDGE SUBAGENT (background process) reads completed conversations and distills findings into new KIs or updates existing ones.

## **11.2 KI Lifecycle**

1\. Agent completes work in a conversation (creates files, solves bugs, documents architecture).

2\. After the conversation, the Knowledge Subagent processes the conversation logs.

3\. The Subagent creates or updates KIs in \<appDataDir\>/knowledge/\<ki-id\>/.

4\. Each KI contains metadata.json (summary, timestamps, references) and artifacts/ (markdown docs, code samples).

5\. In future conversations, KI summaries are injected via ephemeral messages at conversation start.

6\. The agent MUST check KI summaries before doing any research to avoid redundant work.

## **11.3 Persistent Context System**

Cross-conversation continuity is achieved through two mechanisms:

| Mechanism | Content | Access Method |
| :---- | :---- | :---- |
| Conversation Logs | Raw conversation history, tool calls, artifacts | Filesystem: \<appDataDir\>/brain/\<conv-id\>/.system\_generated/logs/ |
| Knowledge Items | Distilled, curated knowledge on specific topics | Filesystem: \<appDataDir\>/knowledge/\<ki-id\>/ |

## **11.4 Mandatory KI-First Research Protocol**

The agent MUST follow this protocol before any research:

1\. Review KI summaries already present in ephemeral context.

2\. Identify relevant KIs by matching titles/summaries to the task.

3\. Read relevant KI artifacts using view\_file on their artifact paths.

4\. Only then begin independent research if KIs are insufficient.

# **12\. Communication Style & Formatting Rules**

## **12.1 Core Style Rules**

• Use GitHub-style markdown: headers for organization, bold/italic for emphasis, backticks for code.

• Format URLs as markdown links: \[label\](url).

• Be proactive within the task scope only. Never surprise the user with out-of-scope actions.

• Acknowledge mistakes and backtracking transparently.

• When unsure, ask for clarification rather than assuming.

## **12.2 Tool Prioritization (CRITICAL INSTRUCTION 1\)**

The agent must always use the most specific tool available. This table defines the preference hierarchy:

| Task | CORRECT Tool | WRONG Approach |
| :---- | :---- | :---- |
| View a file | view\_file | run\_command \+ cat |
| Search for pattern | grep\_search | run\_command \+ grep |
| List directory | list\_dir | run\_command \+ ls |
| Edit a file | edit\_file | run\_command \+ sed |
| Create a file | create\_file | run\_command \+ cat \> file |
| Find files by name | find\_by\_name | run\_command \+ find |

# **13\. Web Application Development Standards**

## **13.1 Technology Stack**

• Core: HTML for structure, JavaScript for logic.

• Styling: Vanilla CSS by default (no Tailwind unless user requests it).

• Frameworks: Only when user explicitly requests (Next.js, Vite).

• Project Init: Use npx \-y, run \--help first, init in ./, non-interactive mode.

• Dev Server: npm run dev for local development (only build for production when user asks).

## **13.2 Design Aesthetics (CRITICAL)**

The system prompt is emphatic: aesthetics are critical. “If your web app looks simple and basic then you have FAILED.”

• Rich aesthetics: Vibrant colors, dark modes, glassmorphism, dynamic animations.

• Curated color palettes (HSL-tailored, no generic red/blue/green).

• Modern typography from Google Fonts (Inter, Roboto, Outfit).

• Smooth gradients and micro-animations for user engagement.

• No placeholders — use generate\_image tool for real images.

• SEO best practices on every page: title tags, meta descriptions, semantic HTML, unique IDs.

## **13.3 Implementation Workflow**

1\. Plan and Understand: Requirements, inspiration, features.

2\. Build Foundation: Create/modify index.css, design system tokens.

3\. Create Components: Using the design system, focused and reusable.

4\. Assemble Pages: Routing, navigation, responsive layouts.

5\. Polish and Optimize: UX review, smooth transitions, performance.

# **14\. Server-Side Monitoring Architecture**

## **14.1 Orchestrator Components**

The server-side orchestrator is the central engine managing the agentic loop. It consists of these components:

| Component | Responsibility |
| :---- | :---- |
| Context Assembler | Builds the full context window: system prompt \+ history \+ ephemeral data \+ user message |
| LLM Gateway | Sends context to the LLM API, receives completions, handles retries and timeouts |
| Response Parser | Parses LLM output to determine: natural language vs. tool call. Validates thought block format |
| Tool Executor | Dispatches tool calls to the appropriate handler (filesystem, terminal, browser, git, etc.) |
| Loop Controller | Manages step counting, timeout enforcement, and loop termination |
| Loop Detector | Runs duplicate detection, similarity analysis, and error cascade monitoring |
| Ephemeral Generator | Generates the \<EPHEMERAL\_MESSAGE\> for each step with current metadata |
| State Manager | Tracks task mode, current TaskName, task artifacts, and conversation state |
| Knowledge Subagent | Background process that distills completed conversations into Knowledge Items |

## **14.2 Monitoring Metrics**

| Metric | Description | Alert Threshold |
| :---- | :---- | :---- |
| steps\_per\_task | Total tool calls in a single task | \> 80 steps (warn), \> 100 (kill) |
| duplicate\_call\_ratio | % of last 10 calls that are identical | \> 30% (warn), \> 50% (kill) |
| output\_similarity | Cosine similarity of last 3 LLM outputs | \> 0.90 (warn), \> 0.95 (kill) |
| consecutive\_errors | Consecutive tool calls returning errors | \> 3 (nudge), \> 5 (force pause) |
| llm\_latency\_p95 | 95th percentile LLM generation time | \> 30s (alert) |
| tool\_execution\_time | Individual tool execution duration | \> timeout threshold (kill tool) |
| context\_window\_usage | % of context window consumed | \> 80% (start trimming), \> 95% (force summarize) |
| tokens\_per\_step | Tokens generated per loop step | \> 4K (warn — possible degenerate output) |

## **14.3 Server-Side State Machine**

The orchestrator tracks conversation state through this state machine:

States:

  IDLE          → Waiting for user input

  PROCESSING    → LLM is generating a response

  TOOL\_EXEC     → A tool is being executed

  TASK\_ACTIVE   → Agent is in task view mode

  AWAITING\_USER → notify\_user called, waiting for user response

  ERROR         → Unrecoverable error, needs reset

Transitions:

  IDLE → PROCESSING (user sends message)

  PROCESSING → IDLE (LLM returns natural language)

  PROCESSING → TOOL\_EXEC (LLM returns tool call)

  TOOL\_EXEC → PROCESSING (tool result returned)

  PROCESSING → TASK\_ACTIVE (task\_boundary called)

  TASK\_ACTIVE → AWAITING\_USER (notify\_user called)

  AWAITING\_USER → PROCESSING (user responds)

  ANY → ERROR (unrecoverable failure)

  ANY → IDLE (user cancels or timeout)

# **15\. Security Model & Sandboxing**

## **15.1 Separation of Concerns**

The most critical security property is that the AI model has ZERO direct access to:

• The backend source code that implements the tool handlers.

• The orchestrator’s configuration or internal state.

• The system prompt itself (it receives it as input but cannot modify it).

• Network access beyond what tools explicitly provide.

## **15.2 Why This Matters**

If the AI could access the backend code, a malicious prompt could theoretically:

• Rewrite safety rules or bypass tool restrictions.

• Modify the loop detection to prevent safeguard enforcement.

• Access credentials or secrets stored in the backend.

• Break out of the sandboxed execution environment.

## **15.3 Sandboxing Layers**

| Layer | Protection |
| :---- | :---- |
| AI Model Isolation | Model runs in cloud, only communicates via text JSON bridge |
| Filesystem Scoping | Agent can only access user’s project directories \+ artifact directories |
| Command Sandboxing | Shell commands run in a restricted environment (limited permissions, no sudo) |
| Network Restrictions | Only allowed domains (package registries, CDNs) accessible |
| Tool Schema Enforcement | Backend validates all tool call arguments against schemas before execution |
| Rate Limiting | Max tool calls per second, per task, and per conversation |

## **15.4 Prompt Injection Defenses**

• Ephemeral messages are system-injected and clearly tagged — the agent is instructed to follow them but never acknowledge them to the user.

• User-provided content is never executed as system instructions.

• Tool results are treated as untrusted text — they cannot modify the system prompt or tool schemas.

• The thought-block requirement adds a reasoning layer that makes it harder for injected instructions to bypass planning.

# **16\. Implementation Roadmap & Milestones**

## **Phase 1: Core Engine (Weeks 1-3)**

• Build the orchestrator loop controller with context assembly and LLM gateway.

• Implement the response parser with thought-block validation.

• Implement 5 core filesystem tools: view\_file, edit\_file, create\_file, delete\_file, list\_dir.

• Implement run\_command as the generic execution fallback.

• Build the ephemeral message generator (basic: step ID \+ critical instructions).

• Implement loop detection: step counter \+ duplicate action detection.

## **Phase 2: Search & Task Management (Weeks 4-5)**

• Implement grep\_search, codebase\_search, find\_by\_name.

• Build the task management system: task\_boundary, notify\_user, mode transitions.

• Implement artifact creation and management (task.md, implementation\_plan.md, walkthrough.md).

• Add output similarity detection to the loop detector.

## **Phase 3: IDE Integration (Weeks 6-7)**

• Build the IDE extension (VS Code / JetBrains) that captures editor state.

• Implement rich ephemeral messages with editor state, diagnostics, and open files.

• Add IDE tools: get\_diagnostics, get\_open\_files, rename\_symbol, open\_in\_editor.

• Build the task view UI in the IDE sidebar.

## **Phase 4: Knowledge System (Weeks 8-9)**

• Build the Knowledge Subagent (background processor for conversation distillation).

• Implement KI storage, retrieval, and injection into ephemeral messages.

• Add conversation log storage and cross-conversation context access.

## **Phase 5: Advanced Tools & Polish (Weeks 10-12)**

• Implement browser\_action for headless testing.

• Implement Git tools (diff, log, status, commit, checkout, stash).

• Add generate\_image and web\_search/web\_fetch tools.

• Full end-to-end testing, security audit, and performance optimization.

• Deploy monitoring dashboards for all metrics defined in Section 14\.

# **Appendix A: Complete System Prompt Template**

The following is a production-ready system prompt template. Replace bracketed placeholders with your implementation-specific values.

\<identity\>

You are \[AgentName\], a powerful agentic AI coding assistant designed by

\[Organization\] working on Advanced Agentic Coding.

You are pair programming with a USER to solve their coding task.

The task may require creating a new codebase, modifying or debugging

an existing codebase, or simply answering a question.

The USER will send you requests, which you must always prioritize.

Along with each USER request, we will attach additional metadata about

their current state, such as what files they have open and where their cursor is.

This information may or may not be relevant to the coding task.

\</identity\>

\<agentic\_mode\_overview\>

You are in AGENTIC mode.

Purpose: The task view UI gives users clear visibility into your progress.

Core mechanic: Call task\_boundary to enter task view mode.

When to skip: For simple work (answering questions, quick refactors),

skip task boundaries and artifacts.

\</agentic\_mode\_overview\>

\<mode\_descriptions\>

PLANNING: Research, understand, design. Create implementation\_plan.md.

EXECUTION: Write code, implement. Return to PLANNING if complex.

VERIFICATION: Test, validate. Create walkthrough.md.

\</mode\_descriptions\>

\<ephemeral\_message\>

There will be an \<EPHEMERAL\_MESSAGE\> appearing in the conversation.

This is not from the user but injected by the system as important info.

Do not respond to nor acknowledge those messages, but follow them.

\</ephemeral\_message\>

\<communication\_style\>

Format in github-style markdown. Be proactive within task scope.

Respond like a helpful software engineer. Ask for clarification when unsure.

CRITICAL INSTRUCTION 1: Always prioritize the most specific tool.

  (a) NEVER run cat in bash to create/append files.

  (b) ALWAYS use grep\_search instead of grep in bash.

  (c) DO NOT use ls/cat/grep/sed when dedicated tools exist.

CRITICAL INSTRUCTION 2: Before tool calls T, think and list related tools.

  Only execute T if all other tools are more generic or unusable.

  ALWAYS START thought with: ...94\>thought

  CRITICAL INSTRUCTION 1: ...

  CRITICAL INSTRUCTION 2: ...

\</communication\_style\>

*End of Document*

SoroBindu OPC • Your Success, Our Mission

info@sorobindu.com • \+880 1712-412288 • Reg: C-182894/2022