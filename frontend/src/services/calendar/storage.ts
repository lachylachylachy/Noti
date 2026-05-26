import { getMonday, toISODate } from "./utils";

export function loadStringList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function loadRecord(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

export function loadCalendarAnnotations<T = unknown>(key: string): T[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function buildBaseCalendarEvents(): any[] {
  const monday = getMonday(new Date());
  const dateFor = (offset: number) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);
    return toISODate(date);
  };

  return [
    {
      id: "team-orlando",
      title: "Team Orlando",
      date: dateFor(0),
      start: "09:00",
      end: "10:00",
      tone: "stone",
      source: "calendar",
      notes: "Weekly project sync.",
    },
    {
      id: "product-review",
      title: "Product Review",
      date: dateFor(1),
      start: "10:00",
      end: "11:00",
      tone: "slate",
      source: "calendar",
      notes: "Review current product flow and open decisions.",
    },
    {
      id: "design-sync",
      title: "Design Sync",
      date: dateFor(2),
      start: "11:30",
      end: "12:30",
      tone: "violet",
      source: "calendar",
      notes: "Linked Noti context for design discussion.",
    },
    {
      id: "client-call",
      title: "Client Call",
      date: dateFor(3),
      start: "09:30",
      end: "10:30",
      tone: "lavender",
      source: "calendar",
      notes: "Prepare notes before joining.",
    },
    {
      id: "deep-work",
      title: "Deep Work",
      date: dateFor(4),
      start: "14:30",
      end: "16:00",
      tone: "green",
      source: "calendar",
      notes: "Focus block.",
    },
    {
      id: "dinner",
      title: "Dinner with Skye",
      date: dateFor(5),
      start: "19:00",
      end: "20:30",
      tone: "purple",
      source: "calendar",
      notes: "Personal event.",
    },
    {
      id: "gym",
      title: "Gym",
      date: dateFor(0),
      start: "17:00",
      end: "18:15",
      tone: "amber",
      source: "calendar",
      notes: "Training block.",
    },
  ];
}

export function loadCalendarEvents<T = any>(key: string): T[] {
  const fallback = buildBaseCalendarEvents();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback as T[];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : (fallback as T[]);
  } catch {
    return fallback as T[];
  }
}

