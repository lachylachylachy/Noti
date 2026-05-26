import { invoke } from "@tauri-apps/api/core";

export async function getAppleCalendarStatus() {
  return await invoke<string>("apple_calendar_status");
}

export async function requestAppleCalendarAccess() {
  return await invoke<boolean>("apple_request_calendar_access");
}

export async function getAppleCalendars() {
  return await invoke<string[]>("apple_list_calendars");
}
