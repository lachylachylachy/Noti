import type { NoteThread } from "../../types/thread";

export const THREADS_STORAGE_KEY = "noti-threads-v3-option1";

function safeNow(): string {
  return new Date().toLocaleString();
}

export function normaliseThread(thread: Partial<NoteThread>): NoteThread {
  const now = safeNow();

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
          id:
            message.id ??
            `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role: message.role === "assistant" ? "assistant" : "user",
          text: message.text ?? "",
          kind: message.kind ?? "note",
          typing: Boolean(message.typing),
          createdAt: message.createdAt ?? now,
        }))
      : [],
  };
}

export function loadThreads(): NoteThread[] {
  try {
    const saved = localStorage.getItem(THREADS_STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.map(normaliseThread) : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: NoteThread[]) {
  localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
}

