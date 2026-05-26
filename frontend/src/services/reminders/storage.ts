import { toISODate } from "../calendar/utils";
import type { ReminderItem } from "./model";
import { isReminderItem } from "./utils";

export function loadReminders(
  storageKey: string,
  fallbackFactory: () => ReminderItem[],
): ReminderItem[] {
  try {
    const saved = localStorage.getItem(storageKey);
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    if (Array.isArray(parsed)) return parsed.filter(isReminderItem);
  } catch {
    // Use defaults below.
  }

  return fallbackFactory();
}

export function buildDefaultReminders(): ReminderItem[] {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const later = new Date();
  later.setDate(today.getDate() + 5);

  return [
    {
      id: "review-deployment",
      title: "Review deployment plan",
      detail: "Go through the checklist and update any blockers.",
      date: toISODate(today),
      time: "10:00",
      list: "Work",
      priority: "High",
      completed: false,
    },
    {
      id: "project-standup",
      title: "Project standup",
      detail: "Bring current decisions and next actions.",
      date: toISODate(tomorrow),
      time: "09:30",
      list: "Work",
      priority: "Medium",
      completed: false,
    },
    {
      id: "study-exam",
      title: "Study for exam",
      detail: "Review notes and practice questions.",
      date: toISODate(later),
      time: "14:00",
      list: "Study",
      priority: "Medium",
      completed: false,
    },
  ];
}

