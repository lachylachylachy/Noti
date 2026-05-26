# Integrations

## Integration Philosophy

Integrations should feel like contextual ecosystem bridges, not separate apps bolted onto the sidebar.

They should help the active thread or workspace become more useful.

Examples:

- A coding thread can connect to GitHub repos, branches, PRs, snippets, and commits.
- A planning thread can connect to Apple Calendar, Google Calendar, Outlook, or reminders.
- A project thread can connect to Drive, OneDrive, Slack, Teams, or GitHub context.

## Sidebar Role

The side rail can contain integration icons, but those icons should not simply open full external apps.

Better behaviour:

- show connected ecosystem status
- surface contextual files/events/repos/messages
- allow linking external items to threads
- show lightweight previews
- deep-link out only when needed

## Suggested Integration Order

### Phase 1: Local Noti Foundation

Before third-party integrations:

- threads
- workspaces
- local persistence
- calendar/reminder/code data structures
- workspace engine

### Phase 2: GitHub

GitHub is likely the best first real integration because it aligns with Code Space.

Useful features:

- connect repo to code thread
- attach commit/branch/PR context
- save snippets against repos
- show file/repo metadata
- link Noti implementation notes to actual project history

### Phase 3: Apple Calendar / Reminders

Apple integration is important for the macOS-first direction.

Useful features:

- read calendar events
- create events from planning threads
- create reminders from notes
- link reminders/events back to threads

### Phase 4: Google / Microsoft

Useful for broader productivity and enterprise use.

Potential services:

- Google Calendar
- Google Drive
- Outlook Calendar
- Microsoft To Do
- OneDrive
- Teams

### Phase 5: Collaboration Ecosystems

Later possibilities:

- Slack
- Discord
- Teams messages/channels
- Figma
- Jira/Linear

These should only be added after the core experience is strong.

## What to Avoid

Avoid becoming a plugin marketplace too early.

Avoid:

- too many sidebar icons
- full app-within-app experiences
- notification spam
- integration dashboards
- enterprise clutter
- confusing permission flows before the value is obvious

## Enterprise Direction

For enterprise users, Noti should eventually help organise connected work context across systems without overwhelming the user.

Possible enterprise value:

- one calm place for project context
- thread-linked files, meetings, tasks, repos, and conversations
- fewer context switches
- better personal workflow continuity
- optional team/workspace integrations later
