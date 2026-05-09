export type WorkspaceMode = "notes" | "calendar" | "reminders" | "code" | "projects" | "archive";

export type Priority = "Low" | "Medium" | "High" | "Urgent";

export type MessageKind = "note" | "meta_prompt" | "ack";

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

export type Reminder = {
  id: number;
  title: string;
  date: string;
  time: string;
  notes: string;
  completed: boolean;
};

export type WorkspaceItem = {
  id: WorkspaceMode;
  label: string;
  icon: string;
};
