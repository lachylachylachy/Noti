import type { WorkspaceName } from "../../types/thread";

export type ThreadIntent = "note" | "calendar" | "reminder" | "project" | "code";

export function resolveWorkspaceFromIntent(
  intent: ThreadIntent | null | undefined,
): WorkspaceName {
  switch (intent) {
    case "calendar":
      return "Calendar";
    case "reminder":
      return "Reminders";
    case "project":
      return "Projects";
    case "code":
      return "Notes";
    case "note":
    default:
      return "Notes";
  }
}

export type WorkspaceResolutionInput = {
  intent?: ThreadIntent | null;
  fallback?: WorkspaceName;
};

export function resolveWorkspace(input: WorkspaceResolutionInput): WorkspaceName {
  return resolveWorkspaceFromIntent(input.intent) ?? (input.fallback ?? "Notes");
}

