import { useState } from "react";
import {
  getAppleCalendarStatus,
  requestAppleCalendarAccess,
  getAppleCalendars,
} from "../integrations/apple";

export default function AppleIntegrationTest() {
  const [status, setStatus] = useState("");
  const [access, setAccess] = useState<boolean | null>(null);
  const [calendars, setCalendars] = useState<string[]>([]);

  async function handleCheckStatus() {
    const result = await getAppleCalendarStatus();
    setStatus(result);
  }

  async function handleRequestAccess() {
    const granted = await requestAppleCalendarAccess();
    setAccess(granted);
  }

  async function handleLoadCalendars() {
    const result = await getAppleCalendars();
    setCalendars(result);
  }

  return (
    <section className="apple-integration-test" aria-label="Apple integration test panel">
      <h2>Apple Integration Test</h2>
      <p>Temporary bridge test for React → Tauri → Rust.</p>

      <div className="apple-test-row">
        <button type="button" onClick={handleCheckStatus}>
          Check Status
        </button>

        <button type="button" onClick={handleRequestAccess}>
          Request Access
        </button>

        <button type="button" onClick={handleLoadCalendars}>
          Load Calendars
        </button>
      </div>

      <p>Status: {status || "Not checked"}</p>

      <p>
        Access:{" "}
        {access === null
          ? "Unknown"
          : access
          ? "Granted"
          : "Denied"}
      </p>

      {calendars.length > 0 && (
        <ul>
          {calendars.map((calendar) => (
            <li key={calendar}>{calendar}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
