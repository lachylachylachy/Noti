export function CalendarWorkspace() {
  const days = ["Mon 5", "Tue 6", "Wed 7", "Thu 8", "Fri 9", "Sat 10", "Sun 11"];
  const hours = ["all-day", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM", "10 PM"];

  return (
    <main className="workspace-main workspace-mode-space calendar-space">
      <div className="mode-header">
        <div>
          <p className="eyebrow">Calendar Space</p>
          <h1>May 5 – May 11, 2025</h1>
        </div>

        <div className="segmented-control">
          <button>Day</button>
          <button className="active">Week</button>
          <button>Month</button>
        </div>
      </div>

      <section className="calendar-shell">
        <div className="calendar-days">
          {days.map((day) => <strong key={day}>{day}</strong>)}
        </div>

        <div className="calendar-grid">
          <div className="calendar-hours">
            {hours.map((hour) => <span key={hour}>{hour}</span>)}
          </div>

          <div className="calendar-canvas">
            <div className="calendar-line now-line" />
            <div className="calendar-event purple" style={{ gridColumn: "2", gridRow: "3 / span 2" }}>
              Design Sync<br /><small>9:00 – 10:30 AM</small>
            </div>
            <div className="calendar-event blue" style={{ gridColumn: "2", gridRow: "5 / span 2" }}>
              Team Standup<br /><small>11:00 AM – 12:00 PM</small>
            </div>
            <div className="calendar-event green" style={{ gridColumn: "4", gridRow: "6 / span 4" }}>
              Deep Work<br /><small>1:00 – 4:00 PM</small>
            </div>
            <div className="calendar-event purple" style={{ gridColumn: "6", gridRow: "4 / span 3" }}>
              Client Call<br /><small>10:30 AM – 12:00</small>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
