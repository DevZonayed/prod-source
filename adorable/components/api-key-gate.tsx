"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ExternalLinkIcon,
  KeyIcon,
  Loader2Icon,
  SettingsIcon,
  CheckCircle2Icon,
  TerminalIcon,
  LogOutIcon,
  ShieldCheckIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Provider = "openai" | "anthropic";

type ApiKeyStatus = {
  hasGlobalKey: boolean;
  hasUserKey: boolean;
  hasClaudeCode: boolean;
  claudeEmail: string | null;
  claudeSubscription: string | null;
  provider: Provider;
};

/* ------------------------------------------------------------------ */
/*  Gate – shown when no auth is configured anywhere                   */
/* ------------------------------------------------------------------ */

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<ApiKeyStatus | null>(null);
  const [loading, setLoading] = React.useState(true);

  const checkStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/api-key");
      if (res.ok) {
        const data = (await res.json()) as ApiKeyStatus;
        setStatus(data);
      }
    } catch {
      // fail open if we can't reach the endpoint
      setStatus({
        hasGlobalKey: true,
        hasUserKey: false,
        hasClaudeCode: false,
        claudeEmail: null,
        claudeSubscription: null,
        provider: "openai",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  // If there's a global key, user key, or Claude Code auth, render the app
  if (status?.hasGlobalKey || status?.hasUserKey || status?.hasClaudeCode) {
    return <>{children}</>;
  }

  // Otherwise show setup screen
  return <AuthSetupScreen onSaved={checkStatus} />;
}

/* ------------------------------------------------------------------ */
/*  Full-screen setup — Claude Code first, API key fallback            */
/* ------------------------------------------------------------------ */

function AuthSetupScreen({ onSaved }: { onSaved: () => void }) {
  const [mode, setMode] = React.useState<"claude" | "api-key">("claude");

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="mx-auto w-full max-w-lg space-y-8 px-6">
        {/* Logo / header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
            <ShieldCheckIcon className="size-7 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Connect to AI
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with your Claude account (recommended) or use an API key.
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("claude")}
            className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
              mode === "claude"
                ? "border-foreground/20 bg-foreground/5 text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            }`}
          >
            Claude Account
          </button>
          <button
            type="button"
            onClick={() => setMode("api-key")}
            className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
              mode === "api-key"
                ? "border-foreground/20 bg-foreground/5 text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            }`}
          >
            API Key
          </button>
        </div>

        {mode === "claude" ? (
          <ClaudeAuthPanel onAuthed={onSaved} />
        ) : (
          <ApiKeyPanel onSaved={onSaved} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Claude Code auth panel                                             */
/* ------------------------------------------------------------------ */

function ClaudeAuthPanel({ onAuthed }: { onAuthed: () => void }) {
  const [checking, setChecking] = React.useState(false);
  const [status, setStatus] = React.useState<{
    installed: boolean;
    authenticated: boolean;
    email: string | null;
    subscriptionType: string | null;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const checkAuth = React.useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/claude-auth");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.authenticated) {
          onAuthed();
        }
      }
    } catch {
      setError("Failed to check auth status");
    } finally {
      setChecking(false);
    }
  }, [onAuthed]);

  React.useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Polling: check every 3 seconds while waiting for auth
  React.useEffect(() => {
    if (status?.authenticated) return;

    const interval = setInterval(() => {
      void checkAuth();
    }, 3000);

    return () => clearInterval(interval);
  }, [status?.authenticated, checkAuth]);

  if (checking && !status) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Checking Claude authentication...
        </p>
      </div>
    );
  }

  if (status?.authenticated) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
          <CheckCircle2Icon className="size-5 shrink-0 text-green-500" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              Signed in as {status.email}
            </p>
            {status.subscriptionType && (
              <p className="text-xs text-muted-foreground">
                Plan: {status.subscriptionType}
              </p>
            )}
          </div>
        </div>
        <Button className="w-full" onClick={onAuthed}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!status?.installed ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-sm text-foreground">
              Claude Code CLI is not installed on this server.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Install it first, then authenticate.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Install Claude Code
            </p>
            <code className="block rounded bg-background px-3 py-2 text-sm text-foreground">
              npm install -g @anthropic-ai/claude-code
            </code>
          </div>
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Then authenticate
            </p>
            <code className="block rounded bg-background px-3 py-2 text-sm text-foreground">
              claude auth login
            </code>
          </div>
          <Button
            className="w-full"
            variant="outline"
            onClick={checkAuth}
            disabled={checking}
          >
            {checking ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : null}
            Check Again
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-4 py-4">
            <div className="flex items-start gap-3">
              <TerminalIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Sign in with Claude
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Run this command in a terminal on the server:
                </p>
                <code className="mt-2 block rounded bg-background px-3 py-2 text-sm text-foreground">
                  claude auth login
                </code>
                <p className="mt-2 text-xs text-muted-foreground">
                  A browser window will open for authentication. Once complete,
                  this page will update automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">
              waiting for authentication...
            </span>
            <Loader2Icon className="size-3 animate-spin text-muted-foreground" />
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            className="w-full"
            variant="outline"
            onClick={checkAuth}
            disabled={checking}
          >
            {checking ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : null}
            Check Again
          </Button>
        </div>
      )}

      {error && (
        <p className="text-center text-[13px] text-destructive">{error}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  API Key panel (fallback)                                           */
/* ------------------------------------------------------------------ */

function ApiKeyPanel({ onSaved }: { onSaved: () => void }) {
  const [provider, setProvider] = React.useState<Provider>("openai");
  const [apiKey, setApiKey] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    const key = apiKey.trim();
    if (!key) {
      setError("Please enter an API key");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      onSaved();
    } catch {
      setError("Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Provider toggle */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Provider
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setProvider("openai");
              setError(null);
            }}
            className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
              provider === "openai"
                ? "border-foreground/20 bg-foreground/5 text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            }`}
          >
            OpenAI
          </button>
          <button
            type="button"
            onClick={() => {
              setProvider("anthropic");
              setError(null);
            }}
            className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
              provider === "anthropic"
                ? "border-foreground/20 bg-foreground/5 text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            }`}
          >
            Anthropic
          </button>
        </div>
      </div>

      {/* Key input */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          API key
        </label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setError(null);
          }}
          placeholder={provider === "openai" ? "sk-..." : "sk-ant-..."}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSave();
          }}
          autoFocus
        />
        {error && (
          <p className="mt-1.5 text-[13px] text-destructive">{error}</p>
        )}
      </div>

      {/* Save button */}
      <Button
        className="w-full"
        onClick={handleSave}
        disabled={saving || !apiKey.trim()}
      >
        {saving ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          "Continue"
        )}
      </Button>

      {/* Get key links */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          Get OpenAI key
          <ExternalLinkIcon className="size-3" />
        </a>
        <span className="text-muted-foreground/30">·</span>
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          Get Anthropic key
          <ExternalLinkIcon className="size-3" />
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings dialog – for changing auth from within the app            */
/* ------------------------------------------------------------------ */

export function ApiKeySettingsDialog() {
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<ApiKeyStatus | null>(null);
  const [provider, setProvider] = React.useState<Provider>("openai");
  const [apiKey, setApiKey] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setApiKey("");
    setError(null);
    void (async () => {
      const res = await fetch("/api/api-key");
      if (res.ok) {
        const data = (await res.json()) as ApiKeyStatus;
        setStatus(data);
        setProvider(data.provider);
      }
    })();
  }, [open]);

  const handleSave = async () => {
    const key = apiKey.trim();
    if (!key) {
      setError("Please enter an API key");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setOpen(false);
    } catch {
      setError("Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch("/api/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
      setOpen(false);
      window.location.reload();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
          title="AI settings"
        >
          <SettingsIcon className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Settings</DialogTitle>
          <DialogDescription>
            {status?.hasClaudeCode
              ? "Connected via Claude Code."
              : status?.hasGlobalKey
                ? "A global API key is configured. You can optionally override it."
                : "Configure your AI provider."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Claude Code status */}
          {status?.hasClaudeCode && (
            <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
              <CheckCircle2Icon className="size-5 shrink-0 text-green-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  Claude Code: {status.claudeEmail}
                </p>
                {status.claudeSubscription && (
                  <p className="text-xs text-muted-foreground">
                    Plan: {status.claudeSubscription}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                Active
              </span>
            </div>
          )}

          {/* Divider if Claude Code is active */}
          {status?.hasClaudeCode && (
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                or use an API key
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          {/* Provider */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Provider
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setProvider("openai");
                  setError(null);
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  provider === "openai"
                    ? "border-foreground/20 bg-foreground/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                OpenAI
              </button>
              <button
                type="button"
                onClick={() => {
                  setProvider("anthropic");
                  setError(null);
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  provider === "anthropic"
                    ? "border-foreground/20 bg-foreground/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                Anthropic
              </button>
            </div>
          </div>

          {/* Key input */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {status?.hasUserKey ? "Replace API key" : "API key"}
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError(null);
              }}
              placeholder={
                status?.hasUserKey
                  ? "Enter new key to replace..."
                  : provider === "openai"
                    ? "sk-..."
                    : "sk-ant-..."
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
            />
            {error && (
              <p className="mt-1.5 text-[13px] text-destructive">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                OpenAI
                <ExternalLinkIcon className="size-3" />
              </a>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                Anthropic
                <ExternalLinkIcon className="size-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              {status?.hasUserKey && !status?.hasGlobalKey && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Removing..." : "Remove key"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !apiKey.trim()}
              >
                {saving ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
