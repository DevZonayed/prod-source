/**
 * Browser Bridge — Server-side command queue singleton.
 *
 * The AI's browser_action tool pushes commands here. The client-side
 * PreviewBridge component polls for them, forwards to the iframe via
 * postMessage, and POSTs results back. The original Promise resolves
 * so the tool gets its answer.
 */

export type BridgeCommand = {
  id: string;
  projectId: string;
  action: string;
  url?: string;
  selector?: string;
  text?: string;
  script?: string;
  scrollDirection?: "up" | "down";
  createdAt: number;
};

export type BridgeResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  screenshot?: string;
};

type PendingEntry = {
  command: BridgeCommand;
  resolve: (result: BridgeResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

// Use globalThis to survive HMR in dev
const g = globalThis as unknown as {
  __browserBridgePending?: Map<string, PendingEntry>;
  __browserBridgeQueues?: Map<string, BridgeCommand[]>;
};

if (!g.__browserBridgePending) g.__browserBridgePending = new Map();
if (!g.__browserBridgeQueues) g.__browserBridgeQueues = new Map();

const pending = g.__browserBridgePending;
const queues = g.__browserBridgeQueues;

const DEFAULT_TIMEOUT = 15_000;
const SCREENSHOT_TIMEOUT = 30_000;

/**
 * Dispatch a command to the bridge. Returns a Promise that resolves
 * when the client executes the command and reports back.
 */
export function dispatch(
  projectId: string,
  cmd: Omit<BridgeCommand, "id" | "projectId" | "createdAt">,
): Promise<BridgeResult> {
  const id = crypto.randomUUID();
  const command: BridgeCommand = {
    ...cmd,
    id,
    projectId,
    createdAt: Date.now(),
  };

  const timeout = cmd.action === "screenshot" ? SCREENSHOT_TIMEOUT : DEFAULT_TIMEOUT;

  return new Promise<BridgeResult>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({
        success: false,
        error: `Bridge command timed out after ${timeout / 1000}s. The preview may not be loaded or the bridge script failed to inject.`,
      });
    }, timeout);

    pending.set(id, { command, resolve, timer });

    // Add to per-project queue for polling
    const q = queues.get(projectId) ?? [];
    q.push(command);
    queues.set(projectId, q);
  });
}

/**
 * Dequeue all pending commands for a project (called by the polling endpoint).
 */
export function getPendingCommands(projectId: string): BridgeCommand[] {
  const q = queues.get(projectId) ?? [];
  queues.set(projectId, []);
  return q;
}

/**
 * Resolve a pending command with its result (called when the client reports back).
 */
export function resolveCommand(commandId: string, result: BridgeResult): boolean {
  const entry = pending.get(commandId);
  if (!entry) return false;

  clearTimeout(entry.timer);
  pending.delete(commandId);
  entry.resolve(result);
  return true;
}
