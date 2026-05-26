import type { MessageKind, ThreadMessage } from "../../types/thread";

export function createMessage(
  role: "user" | "assistant",
  text: string,
  kind: MessageKind,
  typing = false,
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

