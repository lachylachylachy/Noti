export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonday(date: Date): Date {
  const monday = new Date(date);
  const dayOffset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function normalizeTimeInput(value: string): string {
  if (!value) return "12:00";
  const trimmed = value.trim().toLowerCase();
  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = Number(ampmMatch[2] ?? "0");
    if (ampmMatch[3] === "pm" && hours !== 12) hours += 12;
    if (ampmMatch[3] === "am" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const [rawHours, rawMinutes = "00"] = trimmed.split(":");
  const hours = Math.min(Math.max(Number(rawHours) || 0, 0), 23);
  const minutes = Math.min(Math.max(Number(rawMinutes) || 0, 0), 59);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeToMinutes(value: string): number {
  const normalized = normalizeTimeInput(value);
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const total = Math.min(Math.max(totalMinutes, 0), 23 * 60 + 59);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addMinutesToTime(value: string, amount: number): string {
  const total = Math.min(
    Math.max(timeToMinutes(value) + amount, 0),
    23 * 60 + 59,
  );
  return minutesToTime(total);
}

export function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

export function formatTimeLabel(value: string): string {
  const [hours, minutes] = normalizeTimeInput(value).split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatDateShort(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
  });
}

export function formatDateLong(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function minutesToTop(
  minutes: number,
  startHour: number,
  endHour: number,
): number {
  const start = startHour * 60;
  const total = (endHour - startHour) * 60;
  return Math.min(Math.max(((minutes - start) / total) * 100, 0), 100);
}

export function minutesToHeight(
  minutes: number,
  startHour: number,
  endHour: number,
): number {
  const total = (endHour - startHour) * 60;
  return Math.min(Math.max((minutes / total) * 100, 4.5), 100);
}

