# Architecture

## Core Architecture Direction

Noti should be built around a shared thread/data model with multiple workspace render modes.

The app should not treat Notes, Calendar, Reminders, Code, Boards, and Integrations as isolated apps. They should be views and contextual layers around shared underlying data.

## Core Objects

### Thread

A thread is the main unit of thought and work.

Possible fields:

```ts
export type Thread = {
  id: string;
  title: string;
  body?: string;
  type: ThreadType;
  status?: ThreadStatus;
  priority?: Priority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  workspaceContext?: WorkspaceContext;
  linkedEntities: LinkedEntity[];
};
```

### ThreadType

```ts
export type ThreadType =
  | "note"
  | "task"
  | "plan"
  | "code"
  | "calendar"
  | "reminder"
  | "project";
```

### LinkedEntity

Linked entities connect a thread to other objects.

```ts
export type LinkedEntity = {
  id: string;
  type: "calendar_event" | "reminder" | "code_snippet" | "repo" | "file" | "board" | "external_service";
  source: "noti" | "apple" | "google" | "microsoft" | "github" | "local";
  externalId?: string;
  metadata?: Record<string, unknown>;
};
```

### WorkspaceContext

Workspace context tells Noti how to render the environment.

```ts
export type WorkspaceContext = {
  preferredMode: WorkspaceMode;
  activePanels: WorkspacePanel[];
  suggestedActions?: SuggestedAction[];
};
```

### WorkspaceMode

```ts
export type WorkspaceMode =
  | "focus"
  | "notes"
  | "calendar"
  | "reminders"
  | "code"
  | "board"
  | "timeline";
```

## Workspace Engine

The workspace engine decides how the UI should adapt.

Example logic:

```ts
function resolveWorkspaceMode(thread: Thread): WorkspaceMode {
  if (thread.type === "code") return "code";
  if (thread.type === "calendar") return "calendar";
  if (thread.type === "reminder") return "reminders";
  if (thread.type === "project") return "board";
  return "focus";
}
```

Eventually, this can become more intelligent and consider:

- thread content
- tags
- linked entities
- recent user behaviour
- connected integrations
- explicit user preference

## Persistence Direction

Early-stage persistence can start with localStorage, but the proper direction should be:

- local SQLite
- Tauri-compatible persistence layer
- migration/versioning support
- clean repository/service abstraction

Avoid building cloud sync until the local data model is stable.

## Recommended Layers

Suggested frontend structure:

```txt
src/
  app/
    App.tsx
    routes/
  components/
    layout/
    workspace/
    sidebar/
    panels/
    controls/
  features/
    threads/
    calendar/
    reminders/
    code-space/
    integrations/
  services/
    storage/
    workspace-engine/
    integrations/
  styles/
    tokens.css
    layout.css
    glass.css
    typography.css
```

## Technical Priorities

Build in this order:

1. Thread model
2. Local persistence
3. Workspace engine
4. Design system tokens
5. Workspace-specific UI modes
6. Integrations
7. AI suggestions
8. Sync/accounts/collaboration
