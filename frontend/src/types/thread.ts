export type Priority = "Low" | "Medium" | "High" | "Urgent";

export type MessageKind = "note" | "calendar_question" | "meta_prompt" | "ack";

export type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  kind: MessageKind;
  typing?: boolean;
  createdAt: string;
};

export type NoteThread = {
  id: number;
  title: string;
  category: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  createdAt: string;
  updatedAt: string;
  messages: ThreadMessage[];
};

// Future-facing core model (kept additive; current UI still uses NoteThread).
export type ThreadType =
  | "note"
  | "task"
  | "plan"
  | "code"
  | "calendar"
  | "reminder"
  | "project";

export type LinkedEntity = {
  id: string;
  type:
    | "calendar_event"
    | "reminder"
    | "code_snippet"
    | "repo"
    | "file"
    | "board"
    | "external_service";
  source: "noti" | "apple" | "google" | "microsoft" | "github" | "local";
  externalId?: string;
  metadata?: Record<string, unknown>;
};

export type WorkspaceMode =
  | "focus"
  | "notes"
  | "calendar"
  | "reminders"
  | "code"
  | "board"
  | "timeline";

export type WorkspacePanel =
  | "composer"
  | "thread_list"
  | "thread_detail"
  | "calendar"
  | "reminders"
  | "board"
  | "code_editor"
  | "context";

export type WorkspaceContext = {
  preferredMode: WorkspaceMode;
  activePanels: WorkspacePanel[];
  suggestedActions?: Array<{
    id: string;
    label: string;
    intent: "open" | "create" | "link";
    payload?: Record<string, unknown>;
  }>;
};

export type Thread = {
  id: string;
  title: string;
  body?: string;
  type: ThreadType;
  status?: "open" | "active" | "done" | "archived";
  priority?: Priority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  workspaceContext?: WorkspaceContext;
  linkedEntities: LinkedEntity[];
};

export type WorkspaceName =
  | "Notes"
  | "Today"
  | "Calendar"
  | "Reminders"
  | "Projects"
  | "Tasks"
  | "Files"
  | "Meetings"
  | "Knowledge";

export type AppEnvironment = "noti" | "code";

