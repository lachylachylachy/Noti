import type { MessageKind, NoteThread, Reminder, ThreadMessage } from "../types/workspace";

export const THREADS_STORAGE_KEY = "noti-threads-v4-workspaces";
export const REMINDERS_STORAGE_KEY = "noti-reminders-v1";

export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export const CATEGORIES = ["Unassigned", "Personal", "Work", "Projects", "Ideas", "Study"];

export const seededReminders: Reminder[] = [
  {
    id: 1,
    title: "Finish Noti UI polish",
    date: "2026-05-08",
    time: "11:00",
    notes: "Tighten sidebar, workspace modes, and composer polish.",
    completed: false,
  },
  {
    id: 2,
    title: "Dinner with Skye",
    date: "2026-05-15",
    time: "19:00",
    notes: "Seafood restaurant downtown.",
    completed: false,
  },
  {
    id: 3,
    title: "Book Greece flights",
    date: "2026-05-20",
    time: "09:00",
    notes: "Check itinerary and baggage before booking.",
    completed: false,
  },
];

export function createMessage(
  role: "user" | "assistant",
  text: string,
  kind: "note" | MessageKind,
  typing = false
): ThreadMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    text,
    kind,
    typing,
    createdAt: new Date().toLocaleString(),
  };
}

export function normaliseThread(thread: Partial<NoteThread>): NoteThread {
  const now = new Date().toLocaleString();

  return {
    id: thread.id ?? Date.now(),
    title: thread.title ?? "Untitled Note",
    category: thread.category ?? "Unassigned",
    priority: thread.priority ?? "Medium",
    dueDate: thread.dueDate ?? "",
    dueTime: thread.dueTime ?? "",
    createdAt: thread.createdAt ?? now,
    updatedAt: thread.updatedAt ?? now,
    messages: Array.isArray(thread.messages)
      ? thread.messages.map((message) => ({
          id: message.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role: message.role === "assistant" ? "assistant" : "user",
          text: message.text ?? "",
          kind: message.kind ?? "note",
          typing: Boolean(message.typing),
          createdAt: message.createdAt ?? now,
        }))
      : [],
  };
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function getUpdateReply() {
  const replies = ["Updated.", "Noted.", "Saved.", "Added."];
  return replies[Math.floor(Math.random() * replies.length)];
}
