import type { Priority } from "../../types/thread";

export type ReminderList =
  | "Personal"
  | "Work"
  | "Study"
  | "Health"
  | "Finance"
  | "Noti";

export type ReminderItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
  time: string;
  list: ReminderList;
  priority: Priority;
  completed: boolean;
  linkedThreadId?: number;
};

export type ReminderFilter =
  | "All Reminders"
  | "Today"
  | "Tomorrow"
  | "This Week"
  | "Overdue"
  | "Completed";

export type ReminderViewMode = "List" | "Calendar" | "Focus";

export const REMINDER_LISTS: ReminderList[] = [
  "Personal",
  "Work",
  "Study",
  "Health",
  "Finance",
  "Noti",
];

export const REMINDER_STORAGE_KEY = "noti-reminders-stable-v1";

