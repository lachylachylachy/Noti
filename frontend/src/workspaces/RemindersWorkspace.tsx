import type { Reminder } from "../types/workspace";

type RemindersWorkspaceProps = {
  reminders: Reminder[];
  selectedReminder: Reminder | null;
  reminderPanelOpen: boolean;
  onCreateReminder: () => void;
  onSelectReminder: (reminder: Reminder) => void;
  onClosePanel: () => void;
  onUpdateReminder: (id: number, update: Partial<Reminder>) => void;
};

export function RemindersWorkspace({
  reminders,
  selectedReminder,
  reminderPanelOpen,
  onCreateReminder,
  onSelectReminder,
  onClosePanel,
  onUpdateReminder,
}: RemindersWorkspaceProps) {
  const todayReminders = reminders.filter((reminder) => !reminder.completed).slice(0, 3);
  const upcomingReminders = reminders.filter((reminder) => !reminder.completed).slice(3);

  return (
    <main className="workspace-main workspace-mode-space reminders-space">
      <div className="mode-header">
        <div>
          <p className="eyebrow">Reminders Space</p>
          <h1>Reminders</h1>
        </div>
        <button className="new-note-button" onClick={onCreateReminder}>+ New Reminder</button>
      </div>

      <div className={`reminders-layout ${reminderPanelOpen ? "details-open" : ""}`}>
        <section className="reminders-list-panel">
          <div className="filter-pills">
            <button className="active">All</button>
            <button>Today</button>
            <button>Upcoming</button>
            <button>Completed</button>
          </div>

          <ReminderGroup title="Today" reminders={todayReminders} onSelect={onSelectReminder} />
          <ReminderGroup
            title="Upcoming"
            reminders={upcomingReminders.length ? upcomingReminders : reminders.slice(0, 2)}
            onSelect={onSelectReminder}
          />
        </section>

        <aside className="reminder-detail-panel">
          {selectedReminder ? (
            <>
              <button className="panel-close" onClick={onClosePanel}>×</button>
              <p className="eyebrow">Reminder</p>
              <h2>{selectedReminder.title}</h2>
              <label>
                Date
                <input
                  value={selectedReminder.date}
                  onChange={(event) => onUpdateReminder(selectedReminder.id, { date: event.target.value })}
                />
              </label>
              <label>
                Time
                <input
                  value={selectedReminder.time}
                  onChange={(event) => onUpdateReminder(selectedReminder.id, { time: event.target.value })}
                />
              </label>
              <label>
                Notes
                <textarea
                  value={selectedReminder.notes}
                  onChange={(event) => onUpdateReminder(selectedReminder.id, { notes: event.target.value })}
                />
              </label>
              <button className="primary-panel-button" onClick={() => onUpdateReminder(selectedReminder.id, { completed: true })}>
                Mark Complete
              </button>
            </>
          ) : (
            <div className="empty-panel">Select a reminder to view details.</div>
          )}
        </aside>
      </div>
    </main>
  );
}

function ReminderGroup({ title, reminders, onSelect }: { title: string; reminders: Reminder[]; onSelect: (reminder: Reminder) => void }) {
  return (
    <section className="reminder-group">
      <h3>{title}</h3>
      {reminders.map((reminder) => (
        <button key={reminder.id} className="reminder-row" onClick={() => onSelect(reminder)}>
          <span className="reminder-check" />
          <strong>{reminder.title}</strong>
          <small>{reminder.time || reminder.date || "No time"}</small>
        </button>
      ))}
    </section>
  );
}
