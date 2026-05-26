import type { NoteThread, Thread, ThreadType } from "../../types/thread";

function toTagList(category: string | undefined): string[] {
  const trimmed = (category ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "unassigned") return [];
  return [trimmed];
}

function inferThreadType(noteThread: NoteThread): ThreadType {
  const category = (noteThread.category ?? "").toLowerCase();
  const title = (noteThread.title ?? "").toLowerCase();

  if (noteThread.dueDate) return "reminder";
  if (category.includes("project")) return "project";
  if (category.includes("reminder") || title.includes("remind")) return "reminder";
  return "note";
}

export function mapNoteThreadToThread(noteThread: NoteThread): Thread {
  const firstUserMessage =
    noteThread.messages?.find((message) => message.role === "user")?.text ?? "";

  return {
    id: `thread-${noteThread.id}`,
    title: noteThread.title || "Untitled",
    body: firstUserMessage || undefined,
    type: inferThreadType(noteThread),
    priority: noteThread.priority,
    tags: toTagList(noteThread.category),
    createdAt: noteThread.createdAt,
    updatedAt: noteThread.updatedAt,
    linkedEntities: [],
  };
}

