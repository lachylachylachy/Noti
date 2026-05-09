export default function TodayWorkspace() {
  const todayItems = [
    {
      title: "Dinner with Skye",
      subtitle: "Restaurant reservation",
      time: "7:00 PM",
      tone: "purple",
    },
    {
      title: "Deployment prep",
      subtitle: "Review checklist and notes",
      time: "Tomorrow, 10:00 AM",
      tone: "green",
    },
  ];

  const recentItems = [
    { title: "Ideas for ambient mode", time: "2h ago" },
    { title: "Noti architecture thoughts", time: "5h ago" },
    { title: "Journal — May 10", time: "Yesterday" },
    { title: "Random thoughts", time: "2 days ago" },
  ];

  return (
    <section className="today-space">
      <header className="today-header">
        <div>
          <h1>Today</h1>
          <p>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </header>

      <section className="today-priority-stack">
        {todayItems.map((item) => (
          <article
            key={item.title}
            className={`today-focus-card today-focus-${item.tone}`}
          >
            <span>{item.time}</span>
            <h2>{item.title}</h2>
            <p>{item.subtitle}</p>
          </article>
        ))}
      </section>

      <section className="today-list-section">
        <h3>Happening today</h3>

        <div className="today-list">
          {todayItems.map((item) => (
            <button key={item.title} className="today-list-row">
              <span>{item.title}</span>
              <small>{item.time}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="today-list-section">
        <h3>Recently created</h3>

        <div className="today-list">
          {recentItems.map((item) => (
            <button key={item.title} className="today-list-row">
              <span>{item.title}</span>
              <small>{item.time}</small>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
