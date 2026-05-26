import type { Priority } from "../../types/thread";
import type { ReminderItem, ReminderList } from "./model";
import { normalizeTimeInput, timeToMinutes, toISODate } from "../calendar/utils";

export function isReminderItem(value: unknown): value is ReminderItem {
  const item = value as ReminderItem;
  return Boolean(
    item &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.date === "string",
  );
}

export function compareReminders(a: ReminderItem, b: ReminderItem): number {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;
  return timeToMinutes(a.time) - timeToMinutes(b.time);
}

export function normaliseReminderList(category: string): ReminderList {
  const normalized = category.toLowerCase();
  if (normalized.includes("work") || normalized.includes("project")) return "Work";
  if (normalized.includes("study")) return "Study";
  if (normalized.includes("health")) return "Health";
  if (normalized.includes("finance")) return "Finance";
  if (normalized.includes("personal")) return "Personal";
  return "Noti";
}

export function parseReminderText(text: string): {
  title: string;
  detail: string;
  date: string;
  time: string;
  priority: Priority;
  list: ReminderList;
} {
  const source = text.trim();
  const now = new Date();
  const dueDate = new Date(now);
  const lower = source.toLowerCase();

  if (lower.includes("tomorrow")) dueDate.setDate(now.getDate() + 1);
  if (lower.includes("next week") || lower.includes("this week")) {
    dueDate.setDate(now.getDate() + 5);
  }

  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  const time = timeMatch ? normalizeTimeInput(timeMatch[0]) : "09:00";

  const priority: Priority = lower.includes("urgent")
    ? "Urgent"
    : lower.includes("high")
      ? "High"
      : lower.includes("low")
        ? "Low"
        : "Medium";

  const list: ReminderList = lower.includes("study")
    ? "Study"
    : lower.includes("gym") || lower.includes("health")
      ? "Health"
      : lower.includes("pay") || lower.includes("bill")
        ? "Finance"
        : lower.includes("work") || lower.includes("deploy")
          ? "Work"
          : "Personal";

  const cleaned = source
    .replace(/remind me to/i, "")
    .replace(/tomorrow|next week|this week|high priority|urgent|low priority/gi, "")
    .replace(/\d{1,2}(?::\d{2})?\s*(am|pm)/gi, "")
    .trim();

  const title = cleaned || "New reminder";

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    detail: source,
    date: toISODate(dueDate),
    time,
    priority,
    list,
  };
}

export function groupReminders(
  items: ReminderItem[],
  todayIso: string,
  tomorrowIso: string,
): Array<{ label: string; items: ReminderItem[] }> {
  const groups = new Map<string, ReminderItem[]>();
  for (const item of items) {
    const label = item.completed
      ? "Completed"
      : item.date === todayIso
        ? "Today"
        : item.date === tomorrowIso
          ? "Tomorrow"
          : item.date > tomorrowIso
            ? "Upcoming"
            : "Earlier";
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return ["Today", "Tomorrow", "Upcoming", "Earlier", "Completed"]
    .filter((label) => groups.has(label))
    .map((label) => ({ label, items: groups.get(label) ?? [] }));
}

