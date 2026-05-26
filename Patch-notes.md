## 2026-05-27 — Architecture cleanup (no UI changes)

### Technical notes
- Extracted shared thread/workspace types into `frontend/src/types/thread.ts` and refactored `frontend/src/App.tsx` to import them.
- Moved thread persistence + normalization into `frontend/src/services/threads/storage.ts` (`loadThreads`, `saveThreads`, `normaliseThread`).
- Moved message creation into `frontend/src/services/threads/messages.ts` (`createMessage`).
- Centralized workspace/space catalog + enabled-spaces persistence in `frontend/src/services/workspaces/spaces.ts` (`SPACE_CATALOG`, `loadEnabledSpaces`, `saveEnabledSpaces`, `getSpaceDefinition`).
- Added future-facing core thread model (additive only) in `frontend/src/types/thread.ts` (`Thread`, `ThreadType`, `LinkedEntity`, `WorkspaceContext`, etc.).
- Added mapper `frontend/src/services/threads/mapper.ts` (`mapNoteThreadToThread`) to bridge current `NoteThread` → future `Thread`.
- Added/expanded workspace engine scaffolding in `frontend/src/services/workspace-engine/resolveWorkspace.ts`.
- Extracted calendar helpers/storage out of `App.tsx`:
  - `frontend/src/services/calendar/utils.ts` (date/time parsing/formatting utilities)
  - `frontend/src/services/calendar/storage.ts` (localStorage loaders + base calendar events)
- Extracted reminders domain out of `App.tsx`:
  - `frontend/src/services/reminders/model.ts` (types + constants like `REMINDER_STORAGE_KEY`)
  - `frontend/src/services/reminders/utils.ts` (parse/group/compare/list-normalization)
  - `frontend/src/services/reminders/storage.ts` (load saved reminders + defaults)
- Kept localStorage keys the same (no migration) and avoided any JSX/CSS/layout changes.

### Human terms (non-technical)
We reorganized the “brains” of the app into cleaner folders (saving/loading, reminders, calendar, and thread logic) so it’s easier to build new features without messing with the look and feel.

