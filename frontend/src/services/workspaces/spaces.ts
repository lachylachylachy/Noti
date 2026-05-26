import type { WorkspaceName } from "../../types/thread";

export type WorkspaceStatus = "ready" | "concept";

export type WorkspaceDefinition = {
  name: WorkspaceName;
  label: string;
  description: string;
  status: WorkspaceStatus;
};

export const ENABLED_SPACES_STORAGE_KEY = "noti-enabled-spaces-v1";

export const REQUIRED_SPACES: WorkspaceName[] = ["Notes"];

export const SPACE_CATALOG: WorkspaceDefinition[] = [
  {
    name: "Today",
    label: "Today",
    description: "Daily notes, reminders, and active priorities.",
    status: "ready",
  },
  {
    name: "Calendar",
    label: "Calendar",
    description: "Time-blocked notes and scheduled reminders.",
    status: "ready",
  },
  {
    name: "Reminders",
    label: "Reminders",
    description: "Lightweight follow-ups grouped by time.",
    status: "ready",
  },
  {
    name: "Projects",
    label: "Projects",
    description: "Grouped threads, project context, and active workstreams.",
    status: "ready",
  },
  {
    name: "Tasks",
    label: "Tasks",
    description: "Simple action lists separate from calendar commitments.",
    status: "concept",
  },
  {
    name: "Files",
    label: "Files",
    description: "Attach documents, screenshots, and workspace references.",
    status: "concept",
  },
  {
    name: "Meetings",
    label: "Meetings",
    description: "Meeting notes, decisions, and follow-up summaries.",
    status: "concept",
  },
  {
    name: "Knowledge",
    label: "Knowledge",
    description: "A calm internal wiki for reusable notes and decisions.",
    status: "concept",
  },
];

export function loadEnabledSpaces(): WorkspaceName[] {
  try {
    const saved = localStorage.getItem(ENABLED_SPACES_STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : null;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return REQUIRED_SPACES;
    }

    const filtered = parsed.filter(
      (space): space is WorkspaceName =>
        space === "Notes" ||
        SPACE_CATALOG.some((catalogSpace) => catalogSpace.name === space),
    );

    if (!filtered.includes("Notes")) {
      filtered.unshift("Notes");
    }

    return filtered.length > 0 ? filtered : REQUIRED_SPACES;
  } catch {
    return REQUIRED_SPACES;
  }
}

export function saveEnabledSpaces(spaces: WorkspaceName[]): void {
  localStorage.setItem(ENABLED_SPACES_STORAGE_KEY, JSON.stringify(spaces));
}

export function getSpaceDefinition(
  workspace: WorkspaceName,
): WorkspaceDefinition {
  if (workspace === "Notes") {
    return {
      name: "Notes",
      label: "Notes",
      description: "Conversation-first note capture.",
      status: "ready",
    };
  }

  return (
    SPACE_CATALOG.find((space) => space.name === workspace) ?? {
      name: workspace,
      label: workspace,
      description: "Workspace",
      status: "concept",
    }
  );
}

