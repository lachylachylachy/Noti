import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

type Priority = "Low" | "Medium" | "High" | "Urgent";
type MessageKind = "note" | "calendar_question" | "meta_prompt" | "ack";

type CalendarDraft = {
  dueDate: string;
  dueTime: string;
  priority: Priority;
  category: string;
};
type WorkspaceName =
  | "Notes"
  | "Today"
  | "Calendar"
  | "Reminders"
  | "Projects"
  | "Tasks"
  | "Files"
  | "Meetings"
  | "Knowledge";

type AppEnvironment = "noti" | "code";

type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  kind: MessageKind;
  typing?: boolean;
  createdAt: string;
};

type NoteThread = {
  id: number;
  title: string;
  category: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  createdAt: string;
  updatedAt: string;
  messages: ThreadMessage[];
};

const THREADS_STORAGE_KEY = "noti-threads-v3-option1";
const ENABLED_SPACES_STORAGE_KEY = "noti-enabled-spaces-v1";
const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Urgent"];
const CATEGORIES = [
  "Unassigned",
  "Personal",
  "Work",
  "Projects",
  "Ideas",
  "Study",
];

function getDefaultCalendarDraft(): CalendarDraft {
  const now = new Date();
  const rounded = new Date(now);
  const minutes = rounded.getMinutes();
  const nextSlot = minutes <= 30 ? 30 : 60;
  rounded.setMinutes(nextSlot, 0, 0);

  return {
    dueDate: toISODate(rounded),
    dueTime: `${String(rounded.getHours()).padStart(2, "0")}:${String(rounded.getMinutes()).padStart(2, "0")}`,
    priority: "Medium",
    category: "Unassigned",
  };
}
const REQUIRED_SPACES: WorkspaceName[] = ["Notes"];

const SPACE_CATALOG: Array<{
  name: WorkspaceName;
  label: string;
  description: string;
  status: "ready" | "concept";
}> = [
  {
    name: "Today",
    label: "Today",
    description: "Daily notes, reminders, and active priorities.",
    status: "ready",
  },
  {
    name: "Calendar",
    label: "Calendar",
    description: "Time-blocked notes and scheduled reminders.",
    status: "ready",
  },
  {
    name: "Reminders",
    label: "Reminders",
    description: "Lightweight follow-ups grouped by time.",
    status: "ready",
  },
  {
    name: "Projects",
    label: "Projects",
    description: "Grouped threads, project context, and active workstreams.",
    status: "ready",
  },
  {
    name: "Tasks",
    label: "Tasks",
    description: "Simple action lists separate from calendar commitments.",
    status: "concept",
  },
  {
    name: "Files",
    label: "Files",
    description: "Attach documents, screenshots, and workspace references.",
    status: "concept",
  },
  {
    name: "Meetings",
    label: "Meetings",
    description: "Meeting notes, decisions, and follow-up summaries.",
    status: "concept",
  },
  {
    name: "Knowledge",
    label: "Knowledge",
    description: "A calm internal wiki for reusable notes and decisions.",
    status: "concept",
  },
];

function createMessage(
  role: "user" | "assistant",
  text: string,
  kind: MessageKind,
  typing = false,
): ThreadMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    text,
    kind,
    typing,
    createdAt: new Date().toLocaleString(),
  };
}

function normaliseThread(thread: Partial<NoteThread>): NoteThread {
  const now = new Date().toLocaleString();

  return {
    id: thread.id ?? Date.now(),
    title: thread.title ?? "Untitled Note",
    category: thread.category ?? "Unassigned",
    priority: thread.priority ?? "Medium",
    dueDate: thread.dueDate ?? "",
    dueTime: thread.dueTime ?? "",
    createdAt: thread.createdAt ?? now,
    updatedAt: thread.updatedAt ?? now,
    messages: Array.isArray(thread.messages)
      ? thread.messages.map((message) => ({
          id:
            message.id ??
            `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role: message.role === "assistant" ? "assistant" : "user",
          text: message.text ?? "",
          kind: message.kind ?? "note",
          typing: Boolean(message.typing),
          createdAt: message.createdAt ?? now,
        }))
      : [],
  };
}

function App() {
  const appWindow = getCurrentWindow();
  const mainInputRef = useRef<HTMLTextAreaElement | null>(null);
  const threadInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [codeRailVisible, setCodeRailVisible] = useState(false);
  const codeRailHideTimer = useRef<number | null>(null);
  const [activeEnvironment, setActiveEnvironment] = useState<AppEnvironment>("noti");
  const [codeSection, setCodeSection] = useState<
    "Home" | "Sessions" | "Snippets" | "Snapshots" | "Integrations"
  >("Home");
  const [activeWorkspace, setActiveWorkspace] =
    useState<WorkspaceName>("Notes");
  const [enabledSpaces, setEnabledSpaces] = useState<WorkspaceName[]>(() => {
    try {
      const saved = localStorage.getItem(ENABLED_SPACES_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0
        ? [
            "Notes",
            ...parsed.filter(
              (space): space is WorkspaceName =>
                space !== "Notes" &&
                SPACE_CATALOG.some((catalogSpace) => catalogSpace.name === space),
            ),
          ]
        : REQUIRED_SPACES;
    } catch {
      return REQUIRED_SPACES;
    }
  });
  const [addSpaceOpen, setAddSpaceOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState<WorkspaceName | null>(null);
  const [threadMenuOpen, setThreadMenuOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [threadDraft, setThreadDraft] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [calendarDrafts, setCalendarDrafts] = useState<Record<number, CalendarDraft>>({});

  const [threads, setThreads] = useState<NoteThread[]>(() => {
    try {
      const saved = localStorage.getItem(THREADS_STORAGE_KEY);
      return saved ? JSON.parse(saved).map(normaliseThread) : [];
    } catch {
      return [];
    }
  });

  const hasThreads = threads.length > 0;
  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const recentThreads = useMemo(
    () => [...threads].sort((a, b) => b.id - a.id).slice(0, 4),
    [threads],
  );
  const enabledWorkspaceOptions = useMemo(
    () => enabledSpaces.map((space) => getSpaceOption(space)),
    [enabledSpaces],
  );
  const availableSpaces = useMemo(
    () => SPACE_CATALOG.filter((space) => !enabledSpaces.includes(space.name)),
    [enabledSpaces],
  );

  useEffect(() => {
    localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    localStorage.setItem(
      ENABLED_SPACES_STORAGE_KEY,
      JSON.stringify(enabledSpaces),
    );
  }, [enabledSpaces]);

  useEffect(() => {
    async function syncFullscreenState() {
      const fullscreen = await appWindow.isFullscreen();
      setIsFullscreen(fullscreen);
    }

    syncFullscreenState();
    const unlistenResize = appWindow.onResized(syncFullscreenState);

    return () => {
      unlistenResize.then((fn) => fn());
    };
  }, [appWindow]);

  async function closeWindow() {
    await appWindow.close();
  }

  async function minimiseWindow() {
    await appWindow.minimize();
  }

  async function toggleFullscreen() {
    const fullscreen = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!fullscreen);
    setIsFullscreen(!fullscreen);
  }

  function handleTopbarMouseDown(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;

    // Only drag the window from non-interactive topbar space.
    // Without this guard, the Tauri drag handler steals clicks from buttons,
    // profile controls, sidebar/menu buttons, and form elements.
    if (
      target.closest(
        "button, input, textarea, select, a, [role='button'], .profile-dropdown",
      )
    ) {
      return;
    }

    appWindow.startDragging();
  }

  function revealCodeRail() {
    if (activeEnvironment !== "code") return;
    if (codeRailHideTimer.current) {
      window.clearTimeout(codeRailHideTimer.current);
      codeRailHideTimer.current = null;
    }
    setCodeRailVisible(true);
  }

  function softlyHideCodeRail() {
    if (activeEnvironment !== "code" || sidebarOpen) return;
    if (codeRailHideTimer.current) {
      window.clearTimeout(codeRailHideTimer.current);
    }
    codeRailHideTimer.current = window.setTimeout(() => {
      setCodeRailVisible(false);
      codeRailHideTimer.current = null;
    }, 260);
  }

  function collapseSidebarChrome() {
    setWorkspaceMenuOpen(null);
    setThreadMenuOpen(null);
    setAddSpaceOpen(false);
    setProfileOpen(false);
    setSidebarOpen(false);
    if (activeEnvironment === "code") {
      setCodeRailVisible(false);
    }
  }

  function closeTransientUi() {
    setProfileOpen(false);
    setWorkspaceMenuOpen(null);
    setThreadMenuOpen(null);
    setAddSpaceOpen(false);
  }

  function updateThread(
    threadId: number,
    updater: (thread: NoteThread) => NoteThread,
  ) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? updater(thread) : thread,
      ),
    );
  }

  function finishTyping(threadId: number, messageId: string, delay = 750) {
    window.setTimeout(() => {
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) =>
          message.id === messageId ? { ...message, typing: false } : message,
        ),
      }));
    }, delay);
  }

  function addAssistantMessage(
    threadId: number,
    text: string,
    kind: MessageKind = "ack",
  ) {
    const assistant = createMessage("assistant", text, kind, true);

    updateThread(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toLocaleString(),
      messages: [...thread.messages, assistant],
    }));

    finishTyping(threadId, assistant.id);
  }

  function createThread(content: string) {
    const trimmed = content.trim();
    if (!trimmed) return;

    const now = new Date().toLocaleString();
    const threadId = Date.now();
    const userMessage = createMessage("user", trimmed, "note");
    const assistantMessage = createMessage(
      "assistant",
      "Saved. Do you want to add this to your calendar?",
      "calendar_question",
      true,
    );

    const newThread: NoteThread = {
      id: threadId,
      title: trimmed,
      category: "Unassigned",
      priority: "Medium",
      dueDate: "",
      dueTime: "",
      createdAt: now,
      updatedAt: now,
      messages: [userMessage, assistantMessage],
    };

    setThreads((current) => [newThread, ...current]);
    setSelectedThreadId(threadId);
    setDraft("");
    setThreadDraft("");
    finishTyping(threadId, assistantMessage.id, 1350);

    requestAnimationFrame(() => {
      threadInputRef.current?.focus();
    });
  }

  function appendToSelectedThread() {
    if (!selectedThread || !threadDraft.trim()) {
      createThread(threadDraft);
      return;
    }

    const userMessage = createMessage("user", threadDraft.trim(), "note");
    const assistantMessage = createMessage(
      "assistant",
      getUpdateReply(),
      "ack",
      true,
    );

    updateThread(selectedThread.id, (thread) => ({
      ...thread,
      updatedAt: new Date().toLocaleString(),
      messages: [...thread.messages, userMessage, assistantMessage],
    }));

    setThreadDraft("");
    finishTyping(selectedThread.id, assistantMessage.id);
  }

  function answerCalendarQuestion(threadId: number, wantsCalendar: boolean) {
    if (wantsCalendar) {
      const assistant = createMessage(
        "assistant",
        "Add the calendar details, then confirm when it looks right.",
        "meta_prompt",
        true,
      );

      updateThread(threadId, (thread) => {
        setCalendarDrafts((current) => ({
          ...current,
          [threadId]: {
            ...getDefaultCalendarDraft(),
            dueDate: thread.dueDate || getDefaultCalendarDraft().dueDate,
            dueTime: thread.dueTime || getDefaultCalendarDraft().dueTime,
            priority: thread.priority || "Medium",
            category: thread.category || "Unassigned",
          },
        }));

        return {
          ...thread,
          updatedAt: new Date().toLocaleString(),
          messages: [
            ...thread.messages.filter(
              (message) =>
                message.kind !== "calendar_question" &&
                message.kind !== "meta_prompt",
            ),
            assistant,
          ],
        };
      });

      finishTyping(threadId, assistant.id, 1050);
      return;
    }

    const assistant = createMessage("assistant", getUpdateReply(), "ack", true);

    updateThread(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toLocaleString(),
      messages: [
        ...thread.messages.filter(
          (message) =>
            message.kind !== "calendar_question" &&
            message.kind !== "meta_prompt",
        ),
        assistant,
      ],
    }));

    finishTyping(threadId, assistant.id, 700);
  }

  function updateCalendarDraft(threadId: number, values: Partial<CalendarDraft>) {
    setCalendarDrafts((current) => ({
      ...current,
      [threadId]: {
        dueDate: current[threadId]?.dueDate ?? selectedThread?.dueDate ?? getDefaultCalendarDraft().dueDate,
        dueTime: current[threadId]?.dueTime ?? selectedThread?.dueTime ?? getDefaultCalendarDraft().dueTime,
        priority: current[threadId]?.priority ?? selectedThread?.priority ?? "Medium",
        category: current[threadId]?.category ?? selectedThread?.category ?? "Unassigned",
        ...values,
      },
    }));
  }

  function confirmCalendarDraft(threadId: number) {
    const draftDetails = calendarDrafts[threadId];
    const assistant = createMessage("assistant", "Calendar updated.", "ack", true);

    updateThread(threadId, (thread) => ({
      ...thread,
      dueDate: draftDetails?.dueDate ?? thread.dueDate,
      dueTime: draftDetails?.dueTime ?? thread.dueTime,
      priority: draftDetails?.priority ?? thread.priority,
      category: draftDetails?.category ?? thread.category,
      updatedAt: new Date().toLocaleString(),
      messages: [
        ...thread.messages.filter((message) => message.kind !== "meta_prompt"),
        assistant,
      ],
    }));

    setCalendarDrafts((current) => {
      const next = { ...current };
      delete next[threadId];
      return next;
    });

    finishTyping(threadId, assistant.id, 650);
  }

  function cancelCalendarDraft(threadId: number) {
    const assistant = createMessage("assistant", "No calendar change made.", "ack", true);

    updateThread(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toLocaleString(),
      messages: [
        ...thread.messages.filter((message) => message.kind !== "meta_prompt"),
        assistant,
      ],
    }));

    setCalendarDrafts((current) => {
      const next = { ...current };
      delete next[threadId];
      return next;
    });

    finishTyping(threadId, assistant.id, 650);
  }

  function addWorkspace(space: WorkspaceName) {
    setEnabledSpaces((current) =>
      current.includes(space) ? current : [...current, space],
    );
    setActiveWorkspace(space);
    setAddSpaceOpen(false);
    if (space !== "Notes") {
      setSelectedThreadId(null);
    }
    if (space === "Calendar") {
      setSidebarOpen(false);
    }
  }

  function removeWorkspace(space: WorkspaceName) {
    if (space === "Notes") return;
    setEnabledSpaces((current) => current.filter((item) => item !== space));
    if (activeWorkspace === space) {
      setActiveWorkspace("Notes");
      setSidebarOpen(true);
    }
  }

  function deleteThread(threadId: number) {
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    setSelectedThreadId((current) => (current === threadId ? null : current));
  }

  function startNewThread() {
    setSelectedThreadId(null);
    setDraft("");
    setThreadDraft("");

    requestAnimationFrame(() => {
      mainInputRef.current?.focus();
    });
  }

  function handleMainKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      createThread(draft);
    }
  }

  function handleThreadKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      appendToSelectedThread();
    }
  }

  function formatEditedTime(thread: NoteThread) {
    if (!thread.updatedAt) return "Edited recently";
    return "Edited recently";
  }

  return (
    <div
      className={`app-shell option-one-shell ${isFullscreen ? "is-fullscreen" : ""}`}
    >
      <section
        className="floating-stage"
        onMouseMove={(event) => {
          const stageBounds = event.currentTarget.getBoundingClientRect();
          if (activeEnvironment === "code" && !sidebarOpen && event.clientX - stageBounds.left <= 28) {
            revealCodeRail();
          }
        }}
        onMouseDown={() => {
          closeTransientUi();
          collapseSidebarChrome();
        }}
      >
        <div
          className={`workspace-card ${activeEnvironment === "code" ? "workspace-code-space code-environment" : `workspace-${activeWorkspace.toLowerCase()}`} ${sidebarOpen ? "sidebar-expanded" : "sidebar-collapsed"} ${activeEnvironment === "code" && (codeRailVisible || sidebarOpen) ? "code-rail-peek" : ""}` }
          onMouseDown={(event) => {
            event.stopPropagation();
            const target = event.target as HTMLElement;
            if (!target.closest(
              ".workspace-sidebar-drawer, .workspace-sidebar-rail, .workspace-menu-popover, .thread-menu-popover, .workspace-more-button, .thread-more-button, .add-space-menu"
            )) {
              setWorkspaceMenuOpen(null);
              setThreadMenuOpen(null);
              setAddSpaceOpen(false);
              setSidebarOpen(false);
              if (activeEnvironment === "code") {
                setCodeRailVisible(false);
              }
            }
          }}
        >
          <header
            className="workspace-topbar"
            onMouseDown={handleTopbarMouseDown}
          >
            <div className="workspace-brand">
              <button
                type="button"
                className="workspace-logo"
                aria-label="New note"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  startNewThread();
                }}
              >
                N
              </button>
              <span>{activeEnvironment === "code" ? "Noti Code" : "Notes"}</span>
              <small className="workspace-credit">imagined by Lachlan Beasley</small>
            </div>

            <div className="workspace-actions">
              <button
                className="topbar-icon-button"
                title="Search"
                aria-label="Search"
              >
                ⌕
              </button>

              <div className="profile-wrapper">
                <button
                  className="profile-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setProfileOpen((current) => !current);
                  }}
                  title="Profile"
                >
                  LB
                </button>

                <div
                  className={`profile-dropdown ${profileOpen ? "profile-dropdown-open" : ""}`}
                >
                  <div className="profile-header">
                    <div className="profile-avatar">LB</div>
                    <div>
                      <strong>Lachy Beasley</strong>
                      <p>Local Noti workspace</p>
                    </div>
                  </div>

                  <button>Profile</button>
                  <button>Settings</button>
                  <button>Appearance</button>
                  <button>Help</button>
                  <button className="danger-option">Log out</button>
                </div>
              </div>

              <button className="new-note-button" onClick={startNewThread}>
                + New
              </button>

              <div className="window-controls-inline">
                <button onClick={minimiseWindow} title="Minimise">
                  —
                </button>
                <button onClick={toggleFullscreen} title="Fullscreen">
                  □
                </button>
                <button onClick={closeWindow} title="Close">
                  ×
                </button>
              </div>
            </div>
          </header>

          <aside
            className={`workspace-sidebar-rail ${activeEnvironment === "code" && !(codeRailVisible || sidebarOpen) ? "code-rail-hidden" : ""}`}
            aria-label="Integrated applications rail"
            onMouseEnter={revealCodeRail}
            onMouseLeave={softlyHideCodeRail}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={`rail-logo-button ${activeEnvironment === "noti" ? "rail-logo-button-active" : ""}`}
              aria-label="Noti workspace"
              title="Noti"
              onClick={() => {
                setActiveEnvironment("noti");
                setCodeRailVisible(false);
                setSidebarOpen(true);
              }}
            >
              N
            </button>

            <button
              type="button"
              className={`rail-logo-button rail-code-button ${activeEnvironment === "code" ? "rail-logo-button-active" : ""}`}
              aria-label="Noti Code"
              title="Noti Code"
              onClick={() => {
                setActiveEnvironment("code");
                setCodeRailVisible(true);
                setSidebarOpen(false);
                setSelectedThreadId(null);
              }}
            >
              &lt;/&gt;
            </button>

            <div className="rail-empty-state" aria-hidden="true" />

            <button
              type="button"
              className="rail-context-action"
              title={activeEnvironment === "code" ? "Add integration" : "Add workspace"}
              aria-label={activeEnvironment === "code" ? "Add integration" : "Add workspace"}
              onClick={() => {
                setSidebarOpen(true);
                setCodeRailVisible(true);
                if (activeEnvironment === "noti") {
                  setAddSpaceOpen((current) => !current);
                }
              }}
            >
              +
            </button>
          </aside>

          <aside
            className={`workspace-sidebar-drawer ${sidebarOpen ? "workspace-sidebar-drawer-open" : ""}`}
            aria-hidden={!sidebarOpen}
            onMouseEnter={() => { if (activeEnvironment === "code") setCodeRailVisible(true); }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {activeEnvironment === "code" ? (
              <CodeSpaceSidebar
                activeSection={codeSection}
                onSelectSection={setCodeSection}
                onCollapse={() => setSidebarOpen(false)}
              />
            ) : (
            <>
            <div className="sidebar-brand-row">
              <div className="sidebar-logo">N</div>
              <div className="sidebar-brand-copy">
                <strong>Noti</strong>
                <small>Local workspace</small>
              </div>
              <button
                type="button"
                className="sidebar-collapse-button"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                onClick={() => setSidebarOpen(false)}
              >
                ◧
              </button>
            </div>

            <label className="sidebar-search-field">
              <span>⌕</span>
              <input placeholder="Search threads" />
            </label>

            <nav className="sidebar-nav-list" aria-label="Workspace navigation">
              {enabledWorkspaceOptions.map((item) => (
                <div key={item.name} className="sidebar-nav-wrap">
                  <button
                    type="button"
                    className={`sidebar-nav-item ${activeWorkspace === item.name ? "sidebar-nav-item-active" : ""}`}
                    aria-current={
                      activeWorkspace === item.name ? "page" : undefined
                    }
                    onClick={() => {
                      setActiveWorkspace(item.name);
                      if (item.name !== "Notes") {
                        setSelectedThreadId(null);
                      }
                      if (item.name === "Calendar") {
                        setSidebarOpen(false);
                      }
                    }}
                  >
                    <span>{getWorkspaceIcon(item.name)}</span>
                    <strong>{item.label}</strong>
                  </button>

                  {item.name !== "Notes" && (
                    <div className="workspace-more-menu">
                      <button
                        type="button"
                        className="workspace-more-button"
                        aria-label={`More options for ${item.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setThreadMenuOpen(null);
                          setWorkspaceMenuOpen((current) => current === item.name ? null : item.name);
                        }}
                      >
                        •••
                      </button>
                      {workspaceMenuOpen === item.name && (
                        <div className="workspace-menu-popover">
                          <button type="button" onClick={() => { setActiveWorkspace(item.name); setWorkspaceMenuOpen(null); }}>Open</button>
                          <button type="button" onClick={() => setWorkspaceMenuOpen(null)}>Pin space</button>
                          <button type="button" onClick={() => { removeWorkspace(item.name); setWorkspaceMenuOpen(null); }}>Remove from sidebar</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <div className="add-space-section">
              <button
                type="button"
                className="add-space-toggle"
                onClick={() => setAddSpaceOpen((current) => !current)}
                aria-expanded={addSpaceOpen}
              >
                <span>+</span>
                <strong>Add workspace</strong>
              </button>

              {addSpaceOpen && (
                <div className="add-space-menu">
                  {availableSpaces.length > 0 ? (
                    availableSpaces.map((space) => (
                      <button
                        type="button"
                        key={space.name}
                        className="add-space-option"
                        onClick={() => addWorkspace(space.name)}
                      >
                        <span>{getWorkspaceIcon(space.name)}</span>
                        <div>
                          <strong>{space.label}</strong>
                          <small>{space.description}</small>
                        </div>
                        {space.status === "concept" && <em>Soon</em>}
                      </button>
                    ))
                  ) : (
                    <div className="add-space-empty">
                      All spaces are already enabled.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pinned-section">
              <p className="pinned-title">Recents</p>
              {recentThreads.slice(0, 3).length > 0 ? (
                recentThreads.slice(0, 3).map((thread) => (
                  <div key={thread.id} className="pinned-item-wrap">
                    <button
                      type="button"
                      className="pinned-item"
                      onClick={() => {
                        setSelectedThreadId(thread.id);
                        setActiveWorkspace("Notes");
                      }}
                    >
                      <span>{getCategoryIcon(thread.category)}</span>
                      <strong>{thread.title}</strong>
                    </button>
                    <div className="thread-more-menu">
                      <button
                        type="button"
                        className="thread-more-button"
                        aria-label={`More options for ${thread.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setWorkspaceMenuOpen(null);
                          setThreadMenuOpen((current) => current === thread.id ? null : thread.id);
                        }}
                      >
                        •••
                      </button>
                      {threadMenuOpen === thread.id && (
                        <div className="thread-menu-popover">
                          <button type="button" onClick={() => setThreadMenuOpen(null)}>Pin note</button>
                          <button type="button" onClick={() => setThreadMenuOpen(null)}>Move to project</button>
                          <button type="button" onClick={() => { setSelectedThreadId(thread.id); setThreadMenuOpen(null); }}>Open note</button>
                          <button type="button" onClick={() => setThreadMenuOpen(null)}>Archive</button>
                          <button type="button" className="thread-menu-danger" onClick={() => { deleteThread(thread.id); setThreadMenuOpen(null); }}>Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="pinned-empty">No recent threads yet.</div>
              )}
            </div>

            <div className="sidebar-footer-state">
              <span />
              <small>Synced locally</small>
            </div>
            </>
            )}
          </aside>

          <main className="workspace-main">
            {activeEnvironment === "code" ? (
              <CodeSpaceWorkspace section={codeSection} threads={threads} />
            ) : activeWorkspace === "Notes" ? (
              <>
                <section
                  className={`hero-composer ${selectedThread ? "hero-composer-hidden" : ""}`}
                >
                  <h1>
                    {getGreeting()}, Lachy <span />
                  </h1>

                  <div className="main-composer-card">
                    <textarea
                      ref={mainInputRef}
                      className="main-composer-input"
                      placeholder="What's on your mind?"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onFocus={() => setSidebarOpen(false)}
                      onKeyDown={handleMainKeyDown}
                      autoFocus
                    />

                    <div className="composer-action-row">
                      <button>▣ Note</button>
                      <button>▢ Task</button>
                      <button>◷ Reminder</button>
                      <button>⌘ Code</button>
                      <button>⇧ Upload</button>
                      <button className="composer-mic">◌</button>
                    </div>
                  </div>
                </section>

                {selectedThread && (
                  <section className="thread-layer">
                    {selectedThread.messages.map((message) => {
                      const showCalendarQuestion =
                        message.role === "assistant" &&
                        message.kind === "calendar_question";

                      const showMetaControls =
                        message.role === "assistant" &&
                        message.kind === "meta_prompt";

                      return (
                        <div
                          key={message.id}
                          className={`message-row ${message.role === "user" ? "message-user" : "message-noti"} ${message.kind === "meta_prompt" ? "message-meta" : ""}`}
                        >
                          {message.role === "assistant" && (
                            <div className="noti-avatar">N</div>
                          )}

                          <div
                            className={`message-bubble ${message.role === "user" ? "user-bubble" : "noti-bubble"}`}
                          >
                            {message.role === "assistant" ? (
                              <>
                                {message.typing ? (
                                  <div className="typing-line">
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                  </div>
                                ) : (
                                  <div className="assistant-copy">
                                    <strong>{message.text}</strong>
                                  </div>
                                )}

                                {showCalendarQuestion && !message.typing && (
                                  <div className="calendar-choice-row">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        answerCalendarQuestion(
                                          selectedThread.id,
                                          true,
                                        )
                                      }
                                    >
                                      Yes, add it
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        answerCalendarQuestion(
                                          selectedThread.id,
                                          false,
                                        )
                                      }
                                    >
                                      No
                                    </button>
                                  </div>
                                )}

                                {showMetaControls && !message.typing && (
                                  <div className="metadata-panel">
                                    <div className="metadata-grid">
                                    <label>
                                      Date
                                      <input
                                        type="date"
                                        value={calendarDrafts[selectedThread.id]?.dueDate ?? selectedThread.dueDate}
                                        onChange={(event) =>
                                          updateCalendarDraft(selectedThread.id, {
                                            dueDate: event.target.value,
                                          })
                                        }
                                      />
                                    </label>

                                    <label>
                                      Time
                                      <input
                                        type="time"
                                        value={calendarDrafts[selectedThread.id]?.dueTime ?? selectedThread.dueTime}
                                        onChange={(event) =>
                                          updateCalendarDraft(selectedThread.id, {
                                            dueTime: event.target.value,
                                          })
                                        }
                                      />
                                    </label>

                                    <label>
                                      Priority
                                      <div className="minimal-select-wrap">
                                        <select
                                          value={calendarDrafts[selectedThread.id]?.priority ?? selectedThread.priority}
                                          onChange={(event) =>
                                            updateCalendarDraft(selectedThread.id, {
                                              priority: event.target.value as Priority,
                                            })
                                          }
                                        >
                                          {PRIORITIES.map((priority) => (
                                            <option key={priority}>
                                              {priority}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </label>

                                    <label>
                                      Category
                                      <div className="minimal-select-wrap">
                                        <select
                                          value={calendarDrafts[selectedThread.id]?.category ?? selectedThread.category}
                                          onChange={(event) =>
                                            updateCalendarDraft(selectedThread.id, {
                                              category: event.target.value,
                                            })
                                          }
                                        >
                                          {CATEGORIES.map((category) => (
                                            <option key={category}>
                                              {category}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </label>
                                    </div>
                                    <div className="calendar-confirm-row">
                                      <button type="button" onClick={() => confirmCalendarDraft(selectedThread.id)}>
                                        Confirm
                                      </button>
                                      <button type="button" onClick={() => cancelCalendarDraft(selectedThread.id)}>
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              message.text
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </section>
                )}

                {!selectedThread && (
                  <section className="recent-section">
                    <div className="recent-header">Recent threads</div>

                    <div className="recent-grid">
                      {recentThreads.map((thread) => (
                        <button
                          key={thread.id}
                          className={`recent-thread-card ${selectedThreadId === thread.id ? "recent-thread-card-active" : ""}`}
                          onClick={() => setSelectedThreadId(thread.id)}
                        >
                          <span className="thread-category-dot">
                            {getCategoryIcon(thread.category)}
                          </span>
                          <strong>{thread.category}</strong>
                          <p>{thread.title}</p>
                          <small>{formatEditedTime(thread)}</small>
                        </button>
                      ))}

                      <button
                        className="new-thread-card"
                        onClick={startNewThread}
                      >
                        <span>+</span>
                        <p>New thread</p>
                      </button>
                    </div>
                  </section>
                )}
              </>
            ) : activeWorkspace === "Calendar" ? (
              <CalendarWorkspace threads={threads} />
            ) : activeWorkspace === "Reminders" ? (
              <RemindersWorkspace threads={threads} />
            ) : (
              <WorkspacePreview
                workspace={activeWorkspace}
                threads={threads}
                onNewNote={() => {
                  setActiveWorkspace("Notes");
                  startNewThread();
                }}
              />
            )}
          </main>

          {activeEnvironment === "noti" && selectedThread && activeWorkspace === "Notes" && (
            <section className="bottom-composer floating-bottom-composer">
              <button
                className="composer-icon-button"
                title="New note"
                onClick={startNewThread}
              >
                +
              </button>

              <textarea
                ref={threadInputRef}
                className="bottom-composer-input"
                placeholder={
                  selectedThread
                    ? "Write more, or add to the selected note..."
                    : "Ask anything or capture a thought..."
                }
                value={threadDraft}
                onChange={(event) => setThreadDraft(event.target.value)}
                onKeyDown={handleThreadKeyDown}
              />

              <button className="composer-icon-button" title="Attach">
                N
              </button>
              <button className="composer-icon-button" title="Voice input">
                ◌
              </button>
              <button
                className="composer-send-button"
                onClick={appendToSelectedThread}
                title="Submit"
              >
                ➤
              </button>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getSpaceOption(workspace: WorkspaceName) {
  if (workspace === "Notes") {
    return {
      name: "Notes" as WorkspaceName,
      label: "Notes",
      description: "Conversation-first note capture.",
      status: "ready" as const,
    };
  }

  return (
    SPACE_CATALOG.find((space) => space.name === workspace) ?? {
      name: workspace,
      label: workspace,
      description: "Workspace",
      status: "concept" as const,
    }
  );
}


function CalendarWorkspace({ threads }: { threads: NoteThread[] }) {
  type CalendarTone =
    | "stone"
    | "slate"
    | "violet"
    | "lavender"
    | "green"
    | "plum"
    | "purple"
    | "amber"
    | "blue"
    | "note";

  type CalendarEvent = {
    id: string;
    title: string;
    date: string;
    start: string;
    end: string;
    tone: CalendarTone;
    source: "calendar" | "note" | "reminder";
    notes: string;
    thread?: NoteThread;
    recurrence?: "None" | "Daily" | "Weekly" | "Monthly";
    reminder?: "None" | "At time" | "15 minutes before" | "1 hour before";
  };

  type EventDraft = Pick<CalendarEvent, "title" | "date" | "start" | "end" | "tone" | "notes"> & {
    recurrence: "None" | "Daily" | "Weekly" | "Monthly";
    reminder: "None" | "At time" | "15 minutes before" | "1 hour before";
  };

  type CalendarAnnotation = {
    id: string;
    view: "Day" | "Week" | "Month" | "Agenda";
    anchor: string;
    text: string;
    x: number;
    y: number;
  };

  const START_HOUR = 6;
  const END_HOUR = 23;
  const DAY_COUNT = 7;
  const STORAGE_KEY = "noti-calendar-events-v3";
  const NOTES_KEY = "noti-calendar-event-notes-v2";
  const HIDDEN_KEY = "noti-calendar-hidden-events-v2";
  const ANNOTATIONS_KEY = "noti-calendar-annotations-v1";
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [view, setView] = useState<"Day" | "Week" | "Month" | "Agenda">("Week");
  const [anchorDate, setAnchorDate] = useState(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  });
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadCalendarEvents(STORAGE_KEY));
  const [hiddenEventIds, setHiddenEventIds] = useState<string[]>(() => loadStringList(HIDDEN_KEY));
  const [eventNotes, setEventNotes] = useState<Record<string, string>>(() => loadRecord(NOTES_KEY));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [panelTab, setPanelTab] = useState<"Notes" | "Files" | "Links" | "Tasks">("Notes");
  const [calendarMotion, setCalendarMotion] = useState<"idle" | "next" | "prev">("idle");
  const [density, setDensity] = useState<"Compact" | "Comfortable" | "Expanded">("Compact");
  const [filter, setFilter] = useState<"All" | "Calendar" | "Notes" | "Reminders">("All");
  const [quickText, setQuickText] = useState("");
  const [creatingSlot, setCreatingSlot] = useState<{ date: string; start: string; end: string } | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [annotations, setAnnotations] = useState<CalendarAnnotation[]>(() => loadCalendarAnnotations(ANNOTATIONS_KEY));
  const gridRef = useRef<HTMLDivElement | null>(null);
  const today = new Date();
  const todayIso = toISODate(today);
  const weekStart = useMemo(() => getMonday(anchorDate), [anchorDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: DAY_COUNT }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return {
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        number: date.getDate(),
        iso: toISODate(date),
        isToday: date.toDateString() === today.toDateString(),
      };
    });
  }, [weekStart, todayIso]);

  const displayedDays = useMemo(() => {
    if (view === "Day") {
      return [{
        label: anchorDate.toLocaleDateString(undefined, { weekday: "short" }),
        number: anchorDate.getDate(),
        iso: toISODate(anchorDate),
        isToday: anchorDate.toDateString() === today.toDateString(),
      }];
    }
    return weekDays;
  }, [view, weekDays, anchorDate, todayIso]);

  const monthDays = useMemo(() => {
    const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const start = getMonday(first);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        iso: toISODate(date),
        number: date.getDate(),
        inMonth: date.getMonth() === anchorDate.getMonth(),
        isToday: date.toDateString() === today.toDateString(),
      };
    });
  }, [anchorDate, todayIso]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(eventNotes));
  }, [eventNotes]);

  useEffect(() => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenEventIds));
  }, [hiddenEventIds]);

  useEffect(() => {
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(annotations));
  }, [annotations]);

  const scheduledEvents = useMemo<CalendarEvent[]>(() => {
    return threads
      .filter((thread) => thread.dueDate || thread.dueTime)
      .map((thread) => {
        const start = normalizeTimeInput(thread.dueTime || "12:00");
        const end = addMinutesToTime(start, 45);
        const isReminder = thread.category.toLowerCase().includes("reminder") || thread.title.toLowerCase().includes("remind");

        return {
          id: `thread-${thread.id}`,
          title: thread.title,
          date: thread.dueDate || todayIso,
          start,
          end,
          tone: isReminder ? "amber" : "note",
          source: isReminder ? "reminder" : "note",
          notes:
            eventNotes[`thread-${thread.id}`] ||
            thread.messages.find((message) => message.role === "user")?.text ||
            "Linked Noti note.",
          thread,
          recurrence: "None",
          reminder: "At time",
        };
      });
  }, [threads, eventNotes, todayIso]);

  const allEvents = useMemo(() => {
    const merged = [...events, ...scheduledEvents]
      .filter((event) => !hiddenEventIds.includes(event.id))
      .map((event) => ({ ...event, notes: eventNotes[event.id] ?? event.notes }));

    const sourceFiltered = filter === "All" ? merged : merged.filter((event) => {
      if (filter === "Calendar") return event.source === "calendar";
      if (filter === "Notes") return event.source === "note";
      return event.source === "reminder";
    });

    return sourceFiltered.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return timeToMinutes(a.start) - timeToMinutes(b.start);
    });
  }, [events, scheduledEvents, eventNotes, hiddenEventIds, filter]);

  const currentAnnotationAnchor = view === "Month"
    ? `${anchorDate.getFullYear()}-${anchorDate.getMonth() + 1}`
    : view === "Day"
      ? toISODate(anchorDate)
      : toISODate(weekStart);
  const visibleAnnotations = annotations.filter((annotation) => annotation.view === view && annotation.anchor === currentAnnotationAnchor);
  const visibleEvents = allEvents.filter((event) => displayedDays.some((day) => day.iso === event.date));
  const selectedEvent = allEvents.find((event) => event.id === selectedEventId) ?? null;
  const contextOpen = Boolean(selectedEvent);
  const upcoming = allEvents.filter((event) => event.date >= todayIso).slice(0, 8);

  const endOfWeek = new Date(weekStart);
  endOfWeek.setDate(weekStart.getDate() + 6);
  const rangeLabel =
    view === "Month"
      ? anchorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "Day"
        ? anchorDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short", year: "numeric" })
        : `${weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${endOfWeek.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const showNow = displayedDays.some((day) => day.isToday) && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;
  const nowTop = minutesToTop(nowMinutes, START_HOUR, END_HOUR);
  const densityClass = `calendar-density-${density.toLowerCase()}`;

  function moveCalendar(direction: -1 | 1) {
    setCalendarMotion(direction === 1 ? "next" : "prev");
    setAnchorDate((current) => {
      const next = new Date(current);
      if (view === "Day") next.setDate(current.getDate() + direction);
      else if (view === "Week" || view === "Agenda") next.setDate(current.getDate() + direction * DAY_COUNT);
      else next.setMonth(current.getMonth() + direction);
      return next;
    });
    closeEventPanel();
    window.setTimeout(() => setCalendarMotion("idle"), 360);
  }

  function jumpToToday() {
    const target = new Date();
    target.setHours(0, 0, 0, 0);
    const direction = target.getTime() > anchorDate.getTime() ? "next" : target.getTime() < anchorDate.getTime() ? "prev" : "idle";
    setCalendarMotion(direction);
    setAnchorDate(target);
    closeEventPanel();
    window.setTimeout(() => setCalendarMotion("idle"), direction === "idle" ? 0 : 360);
  }

  function closeEventPanel() {
    setSelectedEventId(null);
    setEditing(false);
    setDraft(null);
  }

  function selectEvent(eventId: string) {
    const event = allEvents.find((item) => item.id === eventId);
    if (!event) return;
    setSelectedEventId(eventId);
    setPanelTab("Notes");
    setEditing(false);
    setDraft(toEventDraft(event));
  }

  function createEvent(overrides?: Partial<CalendarEvent>) {
    const date = overrides?.date ?? displayedDays.find((day) => day.isToday)?.iso ?? displayedDays[0]?.iso ?? todayIso;
    const start = normalizeTimeInput(overrides?.start ?? "12:00");
    const newEvent: CalendarEvent = {
      id: `manual-${Date.now()}`,
      title: overrides?.title ?? "New event",
      date,
      start,
      end: normalizeTimeInput(overrides?.end ?? addMinutesToTime(start, 45)),
      tone: overrides?.tone ?? "green",
      source: "calendar",
      notes: overrides?.notes ?? "",
      recurrence: overrides?.recurrence ?? "None",
      reminder: overrides?.reminder ?? "15 minutes before",
    };

    setEvents((current) => [...current, newEvent]);
    setSelectedEventId(newEvent.id);
    setDraft(toEventDraft(newEvent));
    setEditing(true);
  }

  function createFromQuickText() {
    const parsed = parseCalendarQuickText(quickText, anchorDate);
    if (!parsed) return;
    createEvent(parsed);
    setQuickText("");
  }

  function startEditing() {
    if (!selectedEvent) return;
    setDraft(toEventDraft(selectedEvent));
    setEditing(true);
  }

  function saveDraft() {
    if (!selectedEvent || !draft) return;
    const cleanDraft: EventDraft = {
      ...draft,
      title: draft.title.trim() || "Untitled event",
      start: normalizeTimeInput(draft.start),
      end: normalizeTimeInput(draft.end),
      notes: draft.notes,
    };

    if (timeToMinutes(cleanDraft.end) <= timeToMinutes(cleanDraft.start)) {
      cleanDraft.end = addMinutesToTime(cleanDraft.start, 45);
    }

    if (selectedEvent.source === "calendar") {
      setEvents((current) => {
        const updatedBase = { ...selectedEvent, ...cleanDraft };
        const withoutOldRepeats = current.filter((event) => !event.id.startsWith(`${selectedEvent.id}-repeat-`));
        const updatedEvents = withoutOldRepeats.map((event) =>
          event.id === selectedEvent.id ? updatedBase : event,
        );
        return [...updatedEvents, ...buildRecurringCopies(updatedBase, cleanDraft.recurrence)];
      });
    }

    setEventNotes((current) => ({ ...current, [selectedEvent.id]: cleanDraft.notes }));
    setEditing(false);
  }

  function duplicateEvent() {
    if (!selectedEvent) return;
    const copy: CalendarEvent = {
      ...selectedEvent,
      id: `manual-${Date.now()}`,
      source: "calendar",
      title: `${selectedEvent.title} copy`,
      start: addMinutesToTime(selectedEvent.start, 30),
      end: addMinutesToTime(selectedEvent.end, 30),
    };

    setEvents((current) => [...current, copy]);
    setSelectedEventId(copy.id);
    setDraft(toEventDraft(copy));
    setEditing(true);
  }

  function deleteEvent() {
    if (!selectedEvent) return;
    if (selectedEvent.source === "calendar") {
      setEvents((current) => current.filter((event) => event.id !== selectedEvent.id));
    } else {
      setHiddenEventIds((current) => [...new Set([...current, selectedEvent.id])]);
    }
    closeEventPanel();
  }

  function updateDraft<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateSelectedNotes(value: string) {
    if (!selectedEvent) return;
    setEventNotes((current) => ({ ...current, [selectedEvent.id]: value }));
    if (selectedEvent.source === "calendar") {
      setEvents((current) => current.map((event) => event.id === selectedEvent.id ? { ...event, notes: value } : event));
    }
  }

  function addCalendarAnnotation(event: React.MouseEvent<HTMLDivElement>) {
    if (!drawMode) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, select")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const text = window.prompt("Add calendar annotation");
    if (!text?.trim()) return;
    setAnnotations((current) => [
      ...current,
      {
        id: `annotation-${Date.now()}`,
        view,
        anchor: currentAnnotationAnchor,
        text: text.trim(),
        x: Math.round(((event.clientX - rect.left) / rect.width) * 100),
        y: Math.round(((event.clientY - rect.top) / rect.height) * 100),
      },
    ]);
  }

  function removeCalendarAnnotation(annotationId: string) {
    setAnnotations((current) => current.filter((annotation) => annotation.id !== annotationId));
  }

  function buildRecurringCopies(baseEvent: CalendarEvent, recurrence: CalendarEvent["recurrence"]) {
    if (!recurrence || recurrence === "None") return [];
    const intervalDays = recurrence === "Daily" ? 1 : recurrence === "Weekly" ? 7 : 0;
    const copies: CalendarEvent[] = [];
    const baseDate = new Date(`${baseEvent.date}T12:00:00`);
    const count = recurrence === "Monthly" ? 5 : recurrence === "Weekly" ? 8 : 6;

    for (let index = 1; index <= count; index += 1) {
      const nextDate = new Date(baseDate);
      if (recurrence === "Monthly") nextDate.setMonth(baseDate.getMonth() + index);
      else nextDate.setDate(baseDate.getDate() + intervalDays * index);
      copies.push({
        ...baseEvent,
        id: `${baseEvent.id}-repeat-${index}`,
        date: toISODate(nextDate),
      });
    }

    return copies;
  }

  function gridPointToSlot(clientX: number, clientY: number) {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width - 1);
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height - 1);
    const dayIndex = Math.min(displayedDays.length - 1, Math.floor((x / rect.width) * displayedDays.length));
    const totalMinutes = (END_HOUR - START_HOUR) * 60;
    const rawMinutes = START_HOUR * 60 + (y / rect.height) * totalMinutes;
    const rounded = Math.round(rawMinutes / 15) * 15;
    const start = minutesToTime(rounded);
    return { date: displayedDays[dayIndex]?.iso ?? todayIso, start };
  }

  function beginSlotCreate(event: MouseEvent<HTMLDivElement>) {
    if (view === "Month" || view === "Agenda") return;
    if ((event.target as HTMLElement).closest(".calendar-event-card")) return;
    const slot = gridPointToSlot(event.clientX, event.clientY);
    if (!slot) return;
    setCreatingSlot({ ...slot, end: addMinutesToTime(slot.start, 30) });
  }

  function updateSlotCreate(event: MouseEvent<HTMLDivElement>) {
    if (!creatingSlot) return;
    const slot = gridPointToSlot(event.clientX, event.clientY);
    if (!slot) return;
    const startMinutes = timeToMinutes(creatingSlot.start);
    const endMinutes = Math.max(timeToMinutes(slot.start), startMinutes + 30);
    setCreatingSlot({ ...creatingSlot, end: minutesToTime(endMinutes) });
  }

  function finishSlotCreate() {
    if (!creatingSlot) return;
    createEvent({ ...creatingSlot, title: "New time block", tone: "green" });
    setCreatingSlot(null);
  }

  return (
    <section className={`calendar-space ${contextOpen ? "calendar-context-open" : "calendar-context-closed"} ${densityClass}`}>
      <div className={drawMode ? "calendar-board calendar-board-drawing" : "calendar-board"} aria-label="Calendar workspace" onDoubleClick={addCalendarAnnotation}>
        <header className="calendar-toolbar">
          <div className="calendar-range-control">
            <button type="button" onClick={() => moveCalendar(-1)} aria-label={`Previous ${view.toLowerCase()}`}>‹</button>
            <strong>{rangeLabel}</strong>
            <button type="button" onClick={() => moveCalendar(1)} aria-label={`Next ${view.toLowerCase()}`}>›</button>
            <button type="button" className="calendar-today-button" onClick={jumpToToday}>Today</button>
          </div>

          <div className="calendar-view-controls" aria-label="Calendar views">
            {(["Day", "Week", "Month", "Agenda"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={view === item ? "calendar-view-active" : ""}
                onClick={() => setView(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="calendar-toolbar-actions">
            <button
              type="button"
              className="calendar-tool-chip"
              title="Cycle calendar density"
              onClick={() =>
                setDensity((current) =>
                  current === "Compact" ? "Comfortable" : current === "Comfortable" ? "Expanded" : "Compact",
                )
              }
            >
              Density · {density}
            </button>
            <button
              type="button"
              className="calendar-tool-chip"
              title="Cycle visible sources"
              onClick={() =>
                setFilter((current) =>
                  current === "All" ? "Calendar" : current === "Calendar" ? "Notes" : current === "Notes" ? "Reminders" : "All",
                )
              }
            >
              {filter}
            </button>
            <button
              type="button"
              className={drawMode ? "calendar-tool-chip calendar-tool-chip-active" : "calendar-tool-chip"}
              title="Draw annotations"
              onClick={() => setDrawMode((current) => !current)}
            >
              Draw
            </button>
            <button type="button" className="calendar-add-button" onClick={() => createEvent()}>
              + New Event
            </button>
          </div>
        </header>

        <div className={`calendar-view-stack calendar-motion-${calendarMotion}`} key={`${view}-${anchorDate.toISOString()}-${density}-${filter}`}>
        {view === "Month" ? (
          <div className="calendar-month-shell">
            {monthDays.map((day) => {
              const dayEvents = allEvents.filter((event) => event.date === day.iso).slice(0, 3);
              return (
                <button
                  key={day.iso}
                  type="button"
                  className={`calendar-month-cell ${day.inMonth ? "" : "calendar-month-muted"} ${day.isToday ? "calendar-month-today" : ""}`}
                  onClick={() => {
                    setAnchorDate(new Date(`${day.iso}T12:00:00`));
                    setView("Day");
                  }}
                >
                  <strong>{day.number}</strong>
                  {dayEvents.map((event) => (
                    <span key={event.id}>{event.title}</span>
                  ))}
                </button>
              );
            })}
          </div>
        ) : view === "Agenda" ? (
          <div className="calendar-agenda-shell">
            {upcoming.length > 0 ? upcoming.map((event) => (
              <button key={event.id} type="button" className="calendar-agenda-item" onClick={() => selectEvent(event.id)}>
                <span>{formatDateLong(event.date)}</span>
                <strong>{event.title}</strong>
                <small>{formatTimeLabel(event.start)} – {formatTimeLabel(event.end)}</small>
              </button>
            )) : <div className="calendar-empty-state">No upcoming events.</div>}
          </div>
        ) : (
        <div className="calendar-week-shell">
          <div className="calendar-week-header">
            <div className="calendar-time-spacer" />
            {displayedDays.map((day) => (
              <button
                key={day.iso}
                type="button"
                className={`calendar-day-heading ${day.isToday ? "calendar-day-current" : ""}`}
                onClick={() => {
                  setAnchorDate(new Date(`${day.iso}T12:00:00`));
                  setView("Day");
                }}
              >
                <span>{day.label}</span>
                <strong>{day.number}</strong>
              </button>
            ))}
          </div>

          <div className="calendar-grid-wrap">
            <div className="calendar-time-column" aria-hidden="true">
              {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index).map((hour) => (
                <span key={hour}>{formatHourLabel(hour)}</span>
              ))}
            </div>

            <div
              className="calendar-grid"
              role="grid"
              aria-label={`${view} calendar grid`}
              ref={gridRef}
              onMouseDown={beginSlotCreate}
              onMouseMove={updateSlotCreate}
              onMouseUp={finishSlotCreate}
              onMouseLeave={() => setCreatingSlot(null)}
            >
              {showNow && <div className="calendar-now-line" style={{ top: `${nowTop}%` }}><span>Now</span></div>}
              {displayedDays.map((day, index) => (
                <div
                  key={`grid-${day.iso}`}
                  className="calendar-day-column"
                  style={{ left: `calc(${(index * 100) / displayedDays.length}%)`, width: `calc(${100 / displayedDays.length}%)` }}
                />
              ))}
              {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
                <div
                  key={`hour-line-${index}`}
                  className="calendar-hour-line"
                  style={{ top: `${(index * 100) / (END_HOUR - START_HOUR)}%` }}
                />
              ))}

              {creatingSlot && (
                <div
                  className="calendar-slot-preview"
                  style={{
                    left: `calc(${(displayedDays.findIndex((day) => day.iso === creatingSlot.date) * 100) / displayedDays.length}% + 8px)`,
                    width: `calc(${100 / displayedDays.length}% - 16px)`,
                    top: `${minutesToTop(timeToMinutes(creatingSlot.start), START_HOUR, END_HOUR)}%`,
                    height: `${Math.max(minutesToHeight(timeToMinutes(creatingSlot.end) - timeToMinutes(creatingSlot.start), START_HOUR, END_HOUR), 6)}%`,
                  }}
                >
                  New event · {formatTimeLabel(creatingSlot.start)}
                </div>
              )}

              {visibleEvents.map((event) => {
                const dayIndex = displayedDays.findIndex((day) => day.iso === event.date);
                const start = timeToMinutes(event.start);
                const end = Math.max(timeToMinutes(event.end), start + 30);
                const top = minutesToTop(start, START_HOUR, END_HOUR);
                const height = Math.max(minutesToHeight(end - start, START_HOUR, END_HOUR), 7.5);

                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`calendar-event-card calendar-event-${event.tone} ${selectedEvent?.id === event.id ? "calendar-event-selected" : ""}`}
                    style={{
                      left: `calc(${(dayIndex * 100) / displayedDays.length}% + 6px)`,
                      width: `calc(${100 / displayedDays.length}% - 12px)`,
                      top: `${top}%`,
                      height: `${height}%`,
                    }}
                    onClick={() => selectEvent(event.id)}
                    aria-label={`${event.title}, ${formatTimeLabel(event.start)} to ${formatTimeLabel(event.end)}`}
                  >
                    <strong>{event.title}</strong>
                    <span>{formatTimeLabel(event.start)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}
        </div>

        {visibleAnnotations.map((annotation) => (
          <button
            key={annotation.id}
            type="button"
            className="calendar-annotation"
            style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
            title="Click to delete annotation"
            onClick={() => removeCalendarAnnotation(annotation.id)}
          >
            {annotation.text}
          </button>
        ))}
      </div>

      {contextOpen && selectedEvent && (
        <aside className="calendar-context-panel" aria-label="Selected calendar event details">
          <button type="button" className="calendar-context-close" onClick={closeEventPanel} aria-label="Close event details">›</button>

          <section className="calendar-detail-card">
            <div className="calendar-detail-heading">
              <div>
                <strong>{selectedEvent.title}</strong>
                <p>{formatDateLong(selectedEvent.date)} · {formatTimeLabel(selectedEvent.start)} – {formatTimeLabel(selectedEvent.end)}</p>
              </div>
              <button type="button" aria-label="More event options">•••</button>
            </div>

            {editing && draft ? (
              <div className="calendar-edit-form">
                <label>
                  <span>Title</span>
                  <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
                </label>
                <div className="calendar-edit-row">
                  <label>
                    <span>Date</span>
                    <input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} />
                  </label>
                  <label>
                    <span>Colour</span>
                    <select value={draft.tone} onChange={(event) => updateDraft("tone", event.target.value as CalendarTone)}>
                      <option value="stone">Stone</option>
                      <option value="slate">Slate</option>
                      <option value="violet">Violet</option>
                      <option value="green">Green</option>
                      <option value="amber">Amber</option>
                      <option value="blue">Blue</option>
                      <option value="plum">Plum</option>
                    </select>
                  </label>
                </div>
                <div className="calendar-edit-row">
                  <label>
                    <span>Start</span>
                    <input type="time" value={draft.start} onChange={(event) => updateDraft("start", event.target.value)} />
                  </label>
                  <label>
                    <span>End</span>
                    <input type="time" value={draft.end} onChange={(event) => updateDraft("end", event.target.value)} />
                  </label>
                </div>
                <div className="calendar-edit-row">
                  <label>
                    <span>Repeat</span>
                    <select value={draft.recurrence} onChange={(event) => updateDraft("recurrence", event.target.value as EventDraft["recurrence"])}>
                      <option>None</option>
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                  </label>
                  <label>
                    <span>Reminder</span>
                    <select value={draft.reminder} onChange={(event) => updateDraft("reminder", event.target.value as EventDraft["reminder"])}>
                      <option>None</option>
                      <option>At time</option>
                      <option>15 minutes before</option>
                      <option>1 hour before</option>
                    </select>
                  </label>
                </div>
                <label>
                  <span>Notes</span>
                  <textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="Add context, links, or follow-up notes..." />
                </label>
                <div className="calendar-edit-actions">
                  <button type="button" onClick={saveDraft}>Save</button>
                  <button type="button" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="calendar-detail-tabs">
                  {(["Notes", "Files", "Links", "Tasks"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={panelTab === tab ? "calendar-tab-active" : ""}
                      onClick={() => setPanelTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {panelTab === "Notes" ? (
                  <textarea
                    className="calendar-notes-preview calendar-notes-editor"
                    value={(eventNotes[selectedEvent.id] ?? selectedEvent.notes) || ""}
                    onChange={(event) => updateSelectedNotes(event.target.value)}
                    placeholder="Add notes, context, or links..."
                  />
                ) : (
                  <p className="calendar-detail-note">{panelTab} attachments will sit here once integrations are connected.</p>
                )}

                <div className="calendar-context-meta">
                  <span>{selectedEvent.recurrence && selectedEvent.recurrence !== "None" ? `Repeats ${selectedEvent.recurrence.toLowerCase()}` : "Does not repeat"}</span>
                  <span>{selectedEvent.reminder && selectedEvent.reminder !== "None" ? selectedEvent.reminder : "No reminder"}</span>
                </div>

                <div className="calendar-detail-actions">
                  <button type="button" onClick={startEditing}>Edit</button>
                  <button type="button" onClick={duplicateEvent}>Duplicate</button>
                  <button type="button" className="calendar-delete-action" onClick={deleteEvent}>Delete</button>
                </div>
              </>
            )}
          </section>
        </aside>
      )}
    </section>
  );
}

function loadCalendarAnnotations(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getMonday(date: Date) {
  const monday = new Date(date);
  const dayOffset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatHourLabel(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

function timeToMinutes(value: string) {
  const normalized = normalizeTimeInput(value);
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeTimeInput(value: string) {
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

function addMinutesToTime(value: string, amount: number) {
  const total = Math.min(Math.max(timeToMinutes(value) + amount, 0), 23 * 60 + 59);
  return minutesToTime(total);
}

function minutesToTime(totalMinutes: number) {
  const total = Math.min(Math.max(totalMinutes, 0), 23 * 60 + 59);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseCalendarQuickText(value: string, baseDate: Date) {
  const text = value.trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);

  if (lower.includes("tomorrow")) {
    date.setDate(date.getDate() + 1);
  } else {
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const foundDay = weekdays.findIndex((day) => lower.includes(day));
    if (foundDay >= 0) {
      const current = date.getDay();
      const offset = (foundDay - current + 7) % 7 || 7;
      date.setDate(date.getDate() + offset);
    }
  }

  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  const start = timeMatch
    ? normalizeTimeInput(`${timeMatch[1]}:${timeMatch[2] ?? "00"} ${timeMatch[3]}`)
    : "12:00";
  const title = text
    .replace(/today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday/gi, "")
    .replace(/\d{1,2}(?::\d{2})?\s*(am|pm)/gi, "")
    .trim() || "New event";

  return {
    title,
    date: toISODate(date),
    start,
    end: addMinutesToTime(start, 60),
    tone: "green" as const,
    source: "calendar" as const,
    notes: `Created from: ${text}`,
  };
}

function minutesToTop(minutes: number, startHour: number, endHour: number) {
  const start = startHour * 60;
  const total = (endHour - startHour) * 60;
  return Math.min(Math.max(((minutes - start) / total) * 100, 0), 100);
}

function minutesToHeight(minutes: number, startHour: number, endHour: number) {
  const total = (endHour - startHour) * 60;
  return Math.min(Math.max((minutes / total) * 100, 4.5), 100);
}

function formatTimeLabel(value: string) {
  const [hours, minutes] = normalizeTimeInput(value).split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDateShort(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

function formatDateLong(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function toEventDraft(event: {
  title: string;
  date: string;
  start: string;
  end: string;
  tone: string;
  notes: string;
  recurrence?: "None" | "Daily" | "Weekly" | "Monthly";
  reminder?: "None" | "At time" | "15 minutes before" | "1 hour before";
}) {
  return {
    title: event.title,
    date: event.date,
    start: normalizeTimeInput(event.start),
    end: normalizeTimeInput(event.end),
    tone: event.tone as "stone" | "slate" | "violet" | "lavender" | "green" | "plum" | "purple" | "amber" | "blue" | "note",
    notes: event.notes,
    recurrence: event.recurrence ?? "None",
    reminder: event.reminder ?? "15 minutes before",
  };
}

function loadCalendarEvents(key: string): any[] {
  const fallback = buildBaseCalendarEvents();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadStringList(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function loadRecord(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function buildBaseCalendarEvents(): any[] {
  const monday = getMonday(new Date());
  const dateFor = (offset: number) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);
    return toISODate(date);
  };

  return [
    { id: "team-orlando", title: "Team Orlando", date: dateFor(0), start: "09:00", end: "10:00", tone: "stone", source: "calendar", notes: "Weekly project sync." },
    { id: "product-review", title: "Product Review", date: dateFor(1), start: "10:00", end: "11:00", tone: "slate", source: "calendar", notes: "Review current product flow and open decisions." },
    { id: "design-sync", title: "Design Sync", date: dateFor(2), start: "11:30", end: "12:30", tone: "violet", source: "calendar", notes: "Linked Noti context for design discussion." },
    { id: "client-call", title: "Client Call", date: dateFor(3), start: "09:30", end: "10:30", tone: "lavender", source: "calendar", notes: "Prepare notes before joining." },
    { id: "deep-work", title: "Deep Work", date: dateFor(4), start: "14:30", end: "16:00", tone: "green", source: "calendar", notes: "Focus block." },
    { id: "dinner", title: "Dinner with Skye", date: dateFor(5), start: "19:00", end: "20:30", tone: "purple", source: "calendar", notes: "Personal event." },
    { id: "gym", title: "Gym", date: dateFor(0), start: "17:00", end: "18:15", tone: "amber", source: "calendar", notes: "Training block." },
  ];
}


type ReminderItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
  time: string;
  list: "Personal" | "Work" | "Study" | "Health" | "Finance" | "Noti";
  priority: Priority;
  completed: boolean;
  linkedThreadId?: number;
};

const REMINDER_LISTS: ReminderItem["list"][] = ["Personal", "Work", "Study", "Health", "Finance", "Noti"];
const REMINDER_STORAGE_KEY = "noti-reminders-stable-v1";

function RemindersWorkspace({ threads }: { threads: NoteThread[] }) {
  type ReminderFilter = "All Reminders" | "Today" | "Tomorrow" | "This Week" | "Overdue" | "Completed";
  type ReminderViewMode = "List" | "Calendar" | "Focus";

  const [filter, setFilter] = useState<ReminderFilter>("This Week");
  const [viewMode, setViewMode] = useState<ReminderViewMode>("List");
  const [quickText, setQuickText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderItem[]>(() => getInitialReminders());

  useEffect(() => {
    try {
      localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
    } catch {
      // Keep the workspace usable if local storage is blocked.
    }
  }, [reminders]);

  const today = new Date();
  const todayIso = toISODate(today);
  const tomorrowDate = new Date(today);
  tomorrowDate.setDate(today.getDate() + 1);
  const tomorrowIso = toISODate(tomorrowDate);
  const weekEndDate = new Date(today);
  weekEndDate.setDate(today.getDate() + 6);
  const weekEndIso = toISODate(weekEndDate);

  const linkedReminders = useMemo<ReminderItem[]>(() => {
    return threads
      .filter((thread) => Boolean(thread?.dueDate))
      .map((thread) => ({
        id: `thread-${thread.id}`,
        title: thread.title || "Linked Noti note",
        detail: thread.messages?.find((message) => message.role === "user")?.text || "Linked from Notes.",
        date: thread.dueDate || todayIso,
        time: normalizeTimeInput(thread.dueTime || "09:00"),
        list: normaliseReminderList(thread.category || "Noti"),
        priority: thread.priority || "Medium",
        completed: false,
        linkedThreadId: thread.id,
      }));
  }, [threads, todayIso]);

  const allReminders = useMemo(() => {
    const existing = new Set(reminders.map((reminder) => reminder.id));
    return [...reminders, ...linkedReminders.filter((reminder) => !existing.has(reminder.id))].sort(compareReminders);
  }, [reminders, linkedReminders]);

  const counts = {
    "All Reminders": allReminders.filter((reminder) => !reminder.completed).length,
    Today: allReminders.filter((reminder) => !reminder.completed && reminder.date === todayIso).length,
    Tomorrow: allReminders.filter((reminder) => !reminder.completed && reminder.date === tomorrowIso).length,
    "This Week": allReminders.filter((reminder) => !reminder.completed && reminder.date >= todayIso && reminder.date <= weekEndIso).length,
    Overdue: allReminders.filter((reminder) => !reminder.completed && reminder.date < todayIso).length,
    Completed: allReminders.filter((reminder) => reminder.completed).length,
  } satisfies Record<ReminderFilter, number>;

  const listCounts = REMINDER_LISTS.reduce((acc, list) => {
    acc[list] = allReminders.filter((reminder) => !reminder.completed && reminder.list === list).length;
    return acc;
  }, {} as Record<ReminderItem["list"], number>);

  const visibleReminders = allReminders.filter((reminder) => {
    if (filter === "Completed") return reminder.completed;
    if (reminder.completed) return false;
    if (filter === "Today") return reminder.date === todayIso;
    if (filter === "Tomorrow") return reminder.date === tomorrowIso;
    if (filter === "This Week") return reminder.date >= todayIso && reminder.date <= weekEndIso;
    if (filter === "Overdue") return reminder.date < todayIso;
    return true;
  });

  const selected = allReminders.find((reminder) => reminder.id === selectedId) ?? null;
  const grouped = groupReminders(visibleReminders, todayIso, tomorrowIso);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });

  function addReminder(text = quickText) {
    const parsed = parseReminderText(text);
    if (!parsed.title.trim()) return;

    const reminder: ReminderItem = {
      id: `reminder-${Date.now()}`,
      title: parsed.title,
      detail: parsed.detail,
      date: parsed.date,
      time: parsed.time,
      list: parsed.list,
      priority: parsed.priority,
      completed: false,
    };

    setReminders((current) => [reminder, ...current]);
    setSelectedId(reminder.id);
    setQuickText("");
    setFilter("All Reminders");
  }

  function updateReminder(id: string, patch: Partial<ReminderItem>) {
    if (id.startsWith("thread-")) return;
    setReminders((current) => current.map((reminder) => reminder.id === id ? { ...reminder, ...patch } : reminder));
  }

  function toggleReminder(id: string) {
    if (id.startsWith("thread-")) return;
    setReminders((current) => current.map((reminder) => reminder.id === id ? { ...reminder, completed: !reminder.completed } : reminder));
  }

  function deleteReminder(id: string) {
    if (id.startsWith("thread-")) return;
    setReminders((current) => current.filter((reminder) => reminder.id !== id));
    setSelectedId(null);
  }

  const filterItems: Array<{ label: ReminderFilter; icon: string }> = [
    { label: "All Reminders", icon: "◌" },
    { label: "Today", icon: "◷" },
    { label: "Tomorrow", icon: "◴" },
    { label: "This Week", icon: "▦" },
    { label: "Overdue", icon: "△" },
  ];

  return (
    <section className="reminders-workspace" aria-label="Reminders workspace">
      <div className="reminders-shell reminders-shell-v2">
        <aside className="reminders-filter-panel reminders-filter-panel-v2">
          <div className="reminders-panel-header reminders-filter-header">
            <div>
              <strong>Filters</strong>
              <small>Smart lists</small>
            </div>
            <button type="button" className="reminders-subtle-button" aria-label="Close filters">×</button>
          </div>

          <nav className="reminder-smart-list reminder-smart-list-v2" aria-label="Reminder filters">
            {filterItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={filter === item.label ? "reminder-smart-active" : ""}
                onClick={() => setFilter(item.label)}
              >
                <span>{item.icon}</span>
                <strong>{item.label}</strong>
                <small>{counts[item.label]}</small>
              </button>
            ))}
          </nav>

          <div className="reminder-list-summary reminder-list-summary-v2">
            <p>Lists</p>
            {REMINDER_LISTS.filter((list) => list !== "Noti").map((list) => (
              <button key={list} type="button" onClick={() => setFilter("All Reminders")}>
                <span className={`reminder-list-dot reminder-list-${list.toLowerCase()}`} />
                <strong>{list}</strong>
                <small>{listCounts[list]}</small>
              </button>
            ))}
            <button type="button" className="reminders-new-list-button">
              <span>+</span>
              <strong>New List</strong>
              <small />
            </button>
          </div>
        </aside>

        <main className="reminders-main-panel reminders-main-panel-v2">
          <div className="reminders-main-header reminders-main-header-v2">
            <div>
              <p className="reminders-kicker">Reminders</p>
              <h2>{filter}</h2>
            </div>
            <div className="reminders-header-actions reminders-header-actions-v2">
              <label className="reminders-view-select">
                <span>View</span>
                <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ReminderViewMode)}>
                  <option>List</option>
                  <option>Calendar</option>
                  <option>Focus</option>
                </select>
              </label>
              <button type="button" onClick={() => setFilter("Today")}>Today</button>
              <button type="button" onClick={() => addReminder("New reminder tomorrow at 9am")}>+ New Reminder</button>
            </div>
          </div>

          <div className="reminders-quick-bar">
            <input
              value={quickText}
              onChange={(event) => setQuickText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addReminder();
              }}
              placeholder="Remind me to review this tomorrow at 9am"
            />
            <button type="button" onClick={() => addReminder()}>Add</button>
          </div>

          {viewMode === "Calendar" ? (
            <div className="reminders-calendar-view" aria-label="Reminder calendar view">
              {weekDays.map((date) => {
                const iso = toISODate(date);
                const dayItems = visibleReminders.filter((reminder) => reminder.date === iso);
                return (
                  <section key={iso} className="reminders-calendar-day">
                    <header>
                      <span>{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
                      <strong>{date.getDate()}</strong>
                    </header>
                    <div>
                      {dayItems.length === 0 ? <em>No reminders</em> : dayItems.map((reminder) => (
                        <button key={reminder.id} type="button" onClick={() => setSelectedId(reminder.id)} className={`reminder-calendar-pill reminder-list-${reminder.list.toLowerCase()}`}>
                          <strong>{reminder.title}</strong>
                          <small>{formatTimeLabel(reminder.time)}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : viewMode === "Focus" ? (
            <div className="reminders-focus-view">
              {(visibleReminders[0] || selected) ? (
                <article className="reminders-focus-card">
                  <span className={`reminder-list-dot reminder-list-${(selected ?? visibleReminders[0]).list.toLowerCase()}`} />
                  <h3>{(selected ?? visibleReminders[0]).title}</h3>
                  <p>{(selected ?? visibleReminders[0]).detail}</p>
                  <small>{formatDateLong((selected ?? visibleReminders[0]).date)} · {formatTimeLabel((selected ?? visibleReminders[0]).time)}</small>
                  <button type="button" onClick={() => toggleReminder((selected ?? visibleReminders[0]).id)}>Mark complete</button>
                </article>
              ) : (
                <div className="reminders-empty-state"><strong>Nothing to focus on.</strong><p>Create a reminder to begin.</p></div>
              )}
            </div>
          ) : (
            <div className="reminders-stream reminders-stream-v2">
              {grouped.map((group) => (
                <section key={group.label} className="reminder-group reminder-group-v2">
                  <h3>{group.label}</h3>
                  <div className="reminder-group-stack">
                    {group.items.map((reminder) => (
                      <article
                        key={reminder.id}
                        className={`reminder-card reminder-card-v2 ${selected?.id === reminder.id ? "reminder-card-active" : ""} ${reminder.completed ? "reminder-card-complete" : ""}`}
                        onClick={() => setSelectedId(reminder.id)}
                      >
                        <button
                          type="button"
                          className="reminder-check"
                          aria-label={`Toggle ${reminder.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleReminder(reminder.id);
                          }}
                        >
                          {reminder.completed ? "✓" : ""}
                        </button>
                        <div className="reminder-card-copy">
                          <strong>{reminder.title}</strong>
                          <small>{reminder.detail}</small>
                        </div>
                        <span className={`reminder-priority reminder-priority-${reminder.priority.toLowerCase()}`}>{reminder.list}</span>
                        <button
                          type="button"
                          className="reminder-more-button"
                          aria-label={`Open ${reminder.title} details`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(reminder.id);
                          }}
                        >
                          •••
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ))}

              {grouped.length === 0 && (
                <div className="reminders-empty-state">
                  <strong>Nothing here.</strong>
                  <p>Your reminders will appear when they match this view.</p>
                </div>
              )}
            </div>
          )}
        </main>

        <aside className={`reminder-detail-panel reminder-detail-panel-v2 ${selected ? "reminder-detail-panel-open" : ""}`}>
          {selected ? (
            <>
              <div className="reminder-detail-header">
                <div>
                  <small>{selected.linkedThreadId ? "Linked from Notes" : "Reminder details"}</small>
                  <strong>{selected.title}</strong>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Close reminder details">×</button>
              </div>

              <textarea
                className="reminder-detail-textarea"
                value={selected.detail}
                readOnly={Boolean(selected.linkedThreadId)}
                onChange={(event) => updateReminder(selected.id, { detail: event.target.value })}
                placeholder="Add details, links, or context..."
              />

              <div className="reminder-detail-grid">
                <label>Date<input type="date" value={selected.date} disabled={Boolean(selected.linkedThreadId)} onChange={(event) => updateReminder(selected.id, { date: event.target.value })} /></label>
                <label>Time<input type="time" value={selected.time} disabled={Boolean(selected.linkedThreadId)} onChange={(event) => updateReminder(selected.id, { time: event.target.value })} /></label>
                <label>Priority<select value={selected.priority} disabled={Boolean(selected.linkedThreadId)} onChange={(event) => updateReminder(selected.id, { priority: event.target.value as Priority })}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
                <label>List<select value={selected.list} disabled={Boolean(selected.linkedThreadId)} onChange={(event) => updateReminder(selected.id, { list: event.target.value as ReminderItem["list"] })}>{REMINDER_LISTS.map((list) => <option key={list}>{list}</option>)}</select></label>
              </div>

              <div className="reminder-context-card">
                <strong>Linked context</strong>
                <p>{selected.linkedThreadId ? "This came from a scheduled Noti note." : "Calendar events, notes, files, and links will attach here next."}</p>
              </div>

              <div className="reminder-detail-actions">
                <button type="button" onClick={() => toggleReminder(selected.id)} disabled={Boolean(selected.linkedThreadId)}>{selected.completed ? "Mark active" : "Mark complete"}</button>
                <button type="button" className="reminder-danger" onClick={() => deleteReminder(selected.id)} disabled={Boolean(selected.linkedThreadId)}>Delete</button>
              </div>
            </>
          ) : (
            <div className="reminder-detail-empty">
              <strong>Select a reminder</strong>
              <p>Details slide in here when needed.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function getInitialReminders(): ReminderItem[] {
  try {
    const saved = localStorage.getItem(REMINDER_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    if (Array.isArray(parsed)) return parsed.filter(isReminderItem);
  } catch {
    // Use defaults below.
  }

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const later = new Date();
  later.setDate(today.getDate() + 5);

  return [
    {
      id: "review-deployment",
      title: "Review deployment plan",
      detail: "Go through the checklist and update any blockers.",
      date: toISODate(today),
      time: "10:00",
      list: "Work",
      priority: "High",
      completed: false,
    },
    {
      id: "project-standup",
      title: "Project standup",
      detail: "Bring current decisions and next actions.",
      date: toISODate(tomorrow),
      time: "09:30",
      list: "Work",
      priority: "Medium",
      completed: false,
    },
    {
      id: "study-exam",
      title: "Study for exam",
      detail: "Review notes and practice questions.",
      date: toISODate(later),
      time: "14:00",
      list: "Study",
      priority: "Medium",
      completed: false,
    },
  ];
}

function isReminderItem(value: unknown): value is ReminderItem {
  const item = value as ReminderItem;
  return Boolean(item && typeof item.id === "string" && typeof item.title === "string" && typeof item.date === "string");
}

function compareReminders(a: ReminderItem, b: ReminderItem) {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;
  return timeToMinutes(a.time) - timeToMinutes(b.time);
}

function normaliseReminderList(category: string): ReminderItem["list"] {
  const normalized = category.toLowerCase();
  if (normalized.includes("work") || normalized.includes("project")) return "Work";
  if (normalized.includes("study")) return "Study";
  if (normalized.includes("health")) return "Health";
  if (normalized.includes("finance")) return "Finance";
  if (normalized.includes("personal")) return "Personal";
  return "Noti";
}

function parseReminderText(text: string) {
  const source = text.trim();
  const now = new Date();
  const dueDate = new Date(now);
  const lower = source.toLowerCase();

  if (lower.includes("tomorrow")) dueDate.setDate(now.getDate() + 1);
  if (lower.includes("next week") || lower.includes("this week")) dueDate.setDate(now.getDate() + 5);

  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  const time = timeMatch ? normalizeTimeInput(timeMatch[0]) : "09:00";
  const priority: Priority = lower.includes("urgent") ? "Urgent" : lower.includes("high") ? "High" : lower.includes("low") ? "Low" : "Medium";
  const list: ReminderItem["list"] = lower.includes("study") ? "Study" : lower.includes("gym") || lower.includes("health") ? "Health" : lower.includes("pay") || lower.includes("bill") ? "Finance" : lower.includes("work") || lower.includes("deploy") ? "Work" : "Personal";
  const cleaned = source
    .replace(/remind me to/i, "")
    .replace(/tomorrow|next week|this week|high priority|urgent|low priority/gi, "")
    .replace(/\d{1,2}(?::\d{2})?\s*(am|pm)/gi, "")
    .trim();

  const title = cleaned || "New reminder";

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    detail: source,
    date: toISODate(dueDate),
    time,
    priority,
    list,
  };
}

function groupReminders(items: ReminderItem[], todayIso: string, tomorrowIso: string) {
  const groups = new Map<string, ReminderItem[]>();
  for (const item of items) {
    const label = item.completed
      ? "Completed"
      : item.date === todayIso
        ? "Today"
        : item.date === tomorrowIso
          ? "Tomorrow"
          : item.date > tomorrowIso
            ? "Upcoming"
            : "Earlier";
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return ["Today", "Tomorrow", "Upcoming", "Earlier", "Completed"]
    .filter((label) => groups.has(label))
    .map((label) => ({ label, items: groups.get(label) ?? [] }));
}

function getReminderFilterIcon(item: string) {
  switch (item) {
    case "Today":
      return "☼";
    case "Completed":
      return "✓";
    case "All":
      return "◎";
    default:
      return "◌";
  }
}


function CodeSpaceSidebar({
  activeSection,
  onSelectSection,
  onCollapse,
}: {
  activeSection: "Home" | "Sessions" | "Snippets" | "Snapshots" | "Integrations";
  onSelectSection: (section: "Home" | "Sessions" | "Snippets" | "Snapshots" | "Integrations") => void;
  onCollapse: () => void;
}) {
  const sections = [
    { name: "Home" as const, icon: "⌂", description: "Continue building" },
    { name: "Sessions" as const, icon: "◌", description: "Active build work" },
    { name: "Snippets" as const, icon: "</>", description: "Saved code ideas" },
    { name: "Snapshots" as const, icon: "◫", description: "Saved states" },
    { name: "Integrations" as const, icon: "◎", description: "GitHub first" },
  ];

  return (
    <>
      <div className="sidebar-brand-row code-sidebar-brand-row dev-sidebar-brand-row">
        <div className="sidebar-logo dev-sidebar-logo">&lt;/&gt;</div>
        <div className="sidebar-brand-copy">
          <strong>Noti Code</strong>
          <small>Build environment</small>
        </div>
        <button
          type="button"
          className="sidebar-collapse-button"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          onClick={onCollapse}
        >
          ◧
        </button>
      </div>

      <nav className="sidebar-nav-list code-sidebar-nav dev-sidebar-nav" aria-label="Noti Code navigation">
        {sections.map((section) => (
          <button
            key={section.name}
            type="button"
            className={`sidebar-nav-item ${activeSection === section.name ? "sidebar-nav-item-active" : ""}`}
            onClick={() => onSelectSection(section.name)}
          >
            <span>{section.icon}</span>
            <strong>{section.name}</strong>
            <small>{section.description}</small>
          </button>
        ))}
      </nav>

      <div className="pinned-section code-sidebar-section dev-sidebar-github-card">
        <p className="pinned-title">Connected later</p>
        <button type="button" className="github-connect-mini" onClick={() => onSelectSection("Integrations")}>
          <strong>GitHub</strong>
          <span>Repo context</span>
        </button>
      </div>

      <div className="sidebar-footer-state">
        <span />
        <small>Local dev space</small>
      </div>
    </>
  );
}


type DevSession = {
  id: string;
  title: string;
  repo: string;
  branch: string;
  updated: string;
  status: string;
};

function CodeSpaceWorkspace({
  section,
  threads,
}: {
  section: "Home" | "Sessions" | "Snippets" | "Snapshots" | "Integrations";
  threads: NoteThread[];
}) {
  const [mode, setMode] = useState<"home" | "session">(section === "Home" ? "home" : "session");
  const [activeSnippet, setActiveSnippet] = useState("Calendar.tsx");
  const [language, setLanguage] = useState("TSX");
  const [running, setRunning] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<string[]>([
    "Before glass refactor",
    "Calendar animation update",
    "Sidebar layout experiment",
  ]);
  const codeEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState<"Terminal" | "Problems" | "Output" | "Git">("Terminal");
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const [openFiles, setOpenFiles] = useState<string[]>(["Calendar.tsx"]);
  const [editorStats, setEditorStats] = useState({ line: 1, column: 1 });
  const [terminalHistory, setTerminalHistory] = useState<string[]>(["$ git status", "On branch main", "nothing to commit, working tree clean"]);
  const [terminalCommand, setTerminalCommand] = useState("");
  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  const folderUploadRef = useRef<HTMLInputElement | null>(null);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<"Run" | "Notes" | "Linked">("Run");
  const [customFiles, setCustomFiles] = useState<Record<string, string>>({});
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [workspaceNote, setWorkspaceNote] = useState("Working on the new spatial calendar layout.\n\nFocus on interaction polish and animation smoothness.");
  const [commitMessage, setCommitMessage] = useState("");
  const [sessions, setSessions] = useState<DevSession[]>([
    {
      id: "noti-calendar",
      title: "Noti Spatial Calendar",
      repo: "noti-app",
      branch: "main",
      updated: "Updated 12m ago",
      status: "Active",
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("noti-calendar");
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [codeHomeView, setCodeHomeView] = useState<"home" | "sessions" | "activity">("home");
  const [code, setCode] = useState(`import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export function CalendarGrid() {
  const [date, setDate] = useState(new Date())

  useEffect(() => {
    // fetch events
  }, [date])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="calendar-wrapper"
    >
      {/* Calendar grid */}
    </motion.div>
  )
}
`);

  const defaultFileList = [
    "App.tsx",
    "App.css",
    "main.tsx",
    "Calendar.tsx",
    "useCalendar.ts",
    "calendar.types.ts",
    "storage.ts",
    "package.json",
    "README.md",
    "tsconfig.json",
  ];

  const sampleFileContents: Record<string, string> = {
    "Calendar.tsx": code,
    "useCalendar.ts": `import { useMemo, useState } from 'react'

export function useCalendar() {
  const [view, setView] = useState('week')

  const visibleRange = useMemo(() => {
    return { start: new Date(), end: new Date() }
  }, [])

  return { view, setView, visibleRange }
}
`,
    "calendar.types.ts": `export type CalendarView = 'day' | 'week' | 'month' | 'agenda'

export type CalendarEvent = {
  id: string
  title: string
  startsAt: string
  endsAt: string
  notes?: string
}
`,
    "App.tsx": `export default function App() {
  return <main className="noti-shell">Noti</main>
}
`,
    "App.css": `.noti-shell {
  min-height: 100vh;
  background: rgba(10, 10, 10, 0.92);
}
`,
    "main.tsx": `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
`,
    "storage.ts": `export function saveLocal<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}
`,
    "package.json": `{
  "scripts": {
    "dev": "vite",
    "tauri": "tauri"
  }
}
`,
    "README.md": `# Noti Code

A calm engineering workspace built into Noti.
`,
    "tsconfig.json": `{
  "compilerOptions": {
    "jsx": "react-jsx",
    "strict": true
  }
}
`,
  };

  const fileList = Array.from(new Set([...defaultFileList, ...Object.keys(customFiles)]));
  const fileContentMap: Record<string, string> = { ...sampleFileContents, ...customFiles, [activeSnippet]: code };

  const snippetCards = [
    { title: "useSpatialDragging", tag: "React Hook", updated: "Updated 1h ago" },
    { title: "GlassCard", tag: "React Component", updated: "Updated 2h ago" },
    { title: "fadeInUp", tag: "Animation", updated: "Updated yesterday" },
    { title: "cn", tag: "Utility Function", updated: "Updated 2 days ago" },
    { title: "useEventListener", tag: "React Hook", updated: "Updated 3 days ago" },
    { title: "formatDate", tag: "Utility Function", updated: "Updated 4 days ago" },
  ];

  const codeThreads = threads
    .filter((thread) => `${thread.title} ${thread.category}`.toLowerCase().includes("code"))
    .slice(0, 3);

  useEffect(() => {
    if (section === "Home") {
      setMode("home");
    } else {
      setMode("session");
    }
  }, [section]);

  useEffect(() => {
    document.body.classList.toggle("noti-code-session-active", mode === "session");
    return () => document.body.classList.remove("noti-code-session-active");
  }, [mode]);

  useEffect(() => {
    const folderInput = folderUploadRef.current as (HTMLInputElement & { webkitdirectory?: boolean; directory?: boolean }) | null;
    if (folderInput) {
      folderInput.webkitdirectory = true;
      folderInput.directory = true;
    }
  }, []);

  async function closeCompilerWindow() {
    await getCurrentWindow().close();
  }

  async function minimiseCompilerWindow() {
    await getCurrentWindow().minimize();
  }

  async function toggleCompilerFullscreen() {
    const currentWindow = getCurrentWindow();
    const fullscreen = await currentWindow.isFullscreen();
    await currentWindow.setFullscreen(!fullscreen);
  }

  function updateEditorStats(target?: HTMLTextAreaElement | null) {
    const editor = target ?? codeEditorRef.current;
    if (!editor) return;
    const beforeCursor = editor.value.slice(0, editor.selectionStart ?? 0);
    const lines = beforeCursor.split("\n");
    setEditorStats({ line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 });
  }

  function openFile(file: string) {
    setActiveSnippet(file);
    setOpenFiles((current) => current.includes(file) ? current : [...current, file]);
    setCode(fileContentMap[file] ?? `// ${file}\n\n`);
    setQuickOpenOpen(false);
    requestAnimationFrame(() => codeEditorRef.current?.focus());
  }

  function closeFile(file: string) {
    setOpenFiles((current) => {
      const next = current.filter((item) => item !== file);
      if (file === activeSnippet) {
        const fallback = next.at(-1) ?? "Calendar.tsx";
        setActiveSnippet(fallback);
        setCode(fileContentMap[fallback] ?? "");
      }
      return next.length ? next : ["Calendar.tsx"];
    });
  }

  function insertAtSelection(value: string) {
    const editor = codeEditorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const next = code.slice(0, start) + value + code.slice(end);
    setCode(next);
    requestAnimationFrame(() => {
      editor.selectionStart = editor.selectionEnd = start + value.length;
      updateEditorStats(editor);
    });
  }

  function outdentSelection() {
    const editor = codeEditorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const before = code.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const line = code.slice(lineStart);
    const removeCount = line.startsWith("  ") ? 2 : line.startsWith("\t") ? 1 : 0;
    if (!removeCount) return;
    const next = code.slice(0, lineStart) + code.slice(lineStart + removeCount);
    setCode(next);
    requestAnimationFrame(() => {
      editor.selectionStart = editor.selectionEnd = Math.max(lineStart, start - removeCount);
      updateEditorStats(editor);
    });
  }

  function toggleCommentLine() {
    const editor = codeEditorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const before = code.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const lineEndIndex = code.indexOf("\n", start);
    const lineEnd = lineEndIndex === -1 ? code.length : lineEndIndex;
    const line = code.slice(lineStart, lineEnd);
    const trimmed = line.trimStart();
    const leading = line.length - trimmed.length;
    const prefixIndex = lineStart + leading;
    const next = trimmed.startsWith("//")
      ? code.slice(0, prefixIndex) + code.slice(prefixIndex + 2)
      : code.slice(0, prefixIndex) + "// " + code.slice(prefixIndex);
    setCode(next);
    requestAnimationFrame(() => updateEditorStats(editor));
  }

  function handleCodeEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const command = event.metaKey || event.ctrlKey;

    if (event.key === "Tab") {
      event.preventDefault();
      event.shiftKey ? outdentSelection() : insertAtSelection("  ");
      return;
    }

    if (command && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveSnapshot();
      return;
    }

    if (command && event.key === "Enter") {
      event.preventDefault();
      runCode();
      return;
    }

    if (command && event.key.toLowerCase() === "b") {
      event.preventDefault();
      setExplorerOpen((current) => !current);
      return;
    }

    if (command && event.key.toLowerCase() === "j") {
      event.preventDefault();
      setBottomPanelOpen((current) => !current);
      return;
    }

    if (command && event.key.toLowerCase() === "p") {
      event.preventDefault();
      setQuickOpenOpen(true);
      return;
    }

    if (command && event.key.toLowerCase() === "w") {
      event.preventDefault();
      closeFile(activeSnippet);
      return;
    }

    if (command && event.key === "/") {
      event.preventDefault();
      toggleCommentLine();
    }
  }

  function runTerminalCommand() {
    const command = terminalCommand.trim();
    if (!command) return;
    const response = command === "git status"
      ? ["On branch main", "Your branch is up to date with 'origin/main'.", "nothing to commit, working tree clean"]
      : command.startsWith("npm")
        ? ["Simulated command queued. Real Tauri shell integration comes later."]
        : ["Command recorded locally."];
    setTerminalHistory((current) => [...current, `$ ${command}`, ...response]);
    setTerminalCommand("");
  }

  function openSession(sessionId = activeSessionId) {
    const target = sessions.find((session) => session.id === sessionId) ?? sessions[0];
    if (target) {
      setActiveSessionId(target.id);
    }
    setSessionMenuOpen(false);
    setMode("session");
    setOutputOpen(false);
  }

  function createSession() {
    const nextSession: DevSession = {
      id: `session-${Date.now()}`,
      title: "Untitled Session",
      repo: "noti-app",
      branch: "main",
      updated: "Just now",
      status: "Draft",
    };
    setSessions((current) => [nextSession, ...current]);
    setActiveSessionId(nextSession.id);
    setMode("session");
    setOutputOpen(false);
  }

  function deleteSession(sessionId: string) {
    setSessions((current) => current.filter((session) => session.id !== sessionId));
    setSessionMenuOpen(false);
    if (activeSessionId === sessionId) {
      const fallback = sessions.find((session) => session.id !== sessionId);
      if (fallback) {
        setActiveSessionId(fallback.id);
      } else {
        setActiveSessionId("");
      }
    }
  }

  function runCode() {
    setRunning(true);
    setOutputOpen(true);
    setRightPanelOpen(true);
    setRightPanelTab("Run");
    setBottomPanelOpen(true);
    setBottomPanelTab("Output");
    setOutput(["Running local session checks…"]);
    window.setTimeout(() => {
      setRunning(false);
      setOutput(["✓ Compiled successfully", "✓ No errors found", "Completed in 362ms"]);
    }, 700);
  }

  async function copyCode() {
    await navigator.clipboard?.writeText(code);
    setOutputOpen(true);
    setOutput(["✓ Copied snippet to clipboard"]);
  }

  function saveSnapshot() {
    const label = `${activeSnippet} snapshot ${snapshots.length + 1}`;
    setSnapshots((current) => [label, ...current].slice(0, 6));
    setOutputOpen(true);
    setOutput([`✓ Saved ${label}`]);
  }

  function newSnippet() {
    const label = `snippet-${Date.now().toString().slice(-4)}.tsx`;
    const content = "export function NewSnippet() {\n  return null\n}\n";
    setCustomFiles((current) => ({ ...current, [label]: content }));
    setActiveSnippet(label);
    setLanguage("TSX");
    setCode(content);
    setOpenFiles((current) => current.includes(label) ? current : [...current, label]);
    setMode("session");
    setOutputOpen(false);
  }

  function newFile() {
    const label = `untitled-${Date.now().toString().slice(-4)}.tsx`;
    const content = "// New file\n\n";
    setCustomFiles((current) => ({ ...current, [label]: content }));
    openFile(label);
  }

  function newFolder() {
    const label = `folder-${customFolders.length + 1}`;
    setCustomFolders((current) => [...current, label]);
    setTerminalHistory((current) => [...current, `$ mkdir ${label}`, `Created ${label} locally`]);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;

    const readableExtensions = new Set([
      "ts", "tsx", "js", "jsx", "css", "html", "json", "md", "txt", "yml", "yaml", "xml", "svg", "rs", "go", "py", "cs", "java", "rb", "php", "sql", "env", "gitignore"
    ]);

    const entries = await Promise.all(Array.from(files).map((file) => new Promise<[string, string]>((resolve) => {
      const relativeName = ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/^\/+/, "");
      const extension = relativeName.split(".").pop()?.toLowerCase() ?? "";
      const looksReadable = file.type.startsWith("text/") || readableExtensions.has(extension) || !file.type;

      if (!looksReadable || file.size > 2_000_000) {
        resolve([relativeName, `// ${relativeName} imported as a reference.\n// Binary or large file preview is not supported yet.\n`]);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve([relativeName, String(reader.result ?? "")]);
      reader.onerror = () => resolve([relativeName, `// Could not read ${relativeName}`]);
      reader.readAsText(file);
    })));

    setUploadMenuOpen(false);
    setCustomFiles((current) => ({ ...current, ...Object.fromEntries(entries) }));
    setOpenFiles((current) => Array.from(new Set([...current, ...entries.map(([name]) => name)])));
    const [firstName, firstContent] = entries[0];
    setActiveSnippet(firstName);
    setCode(firstContent);
    setOutputOpen(true);
    setRightPanelOpen(true);
    setRightPanelTab("Run");
    setOutput([`✓ Imported ${entries.length} file${entries.length > 1 ? "s" : ""}`, `Opened ${firstName}`]);
  }

  function deleteActiveFile() {
    const file = activeSnippet;
    const isDefaultFile = defaultFileList.includes(file);
    if (!window.confirm(`Remove ${file} from the current Noti Code session?`)) return;

    setCustomFiles((current) => {
      const next = { ...current };
      delete next[file];
      return next;
    });
    closeFile(file);
    setOutputOpen(true);
    setRightPanelOpen(true);
    setRightPanelTab("Run");
    setOutput([isDefaultFile ? `${file} removed from open editors. Base files remain available in Explorer.` : `Deleted ${file} from local workspace`]);
  }

  function commitChanges() {
    const message = commitMessage.trim() || "Update Noti Code workspace";
    setTerminalHistory((current) => [...current, `$ git commit -m "${message}"`, "[main abc1234] " + message]);
    setCommitMessage("");
  }

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];

  if (mode === "home") {
    return (
      <section className="dev-home-space noti-code-compact-home">
        <div className="dev-home-topbar">
          <div>
            <span className="dev-eyebrow">Noti Code</span>
            <h1>Build, experiment, and ship.</h1>
            <p>Your focused coding environment for sessions, snippets, snapshots, and GitHub context.</p>
          </div>
          <div className="dev-home-actions">
            <label className="dev-search-field">
              <span>⌕</span>
              <input placeholder="Search sessions, snippets…" />
            </label>
            <button type="button" className="dev-primary-button" onClick={createSession}>+ New Session</button>
          </div>
        </div>

        <div className="dev-home-view-switcher" aria-label="Noti Code home sections">
          <button type="button" className={codeHomeView === "home" ? "active" : ""} onClick={() => setCodeHomeView("home")}>Home</button>
          <button type="button" className={codeHomeView === "sessions" ? "active" : ""} onClick={() => setCodeHomeView("sessions")}>Sessions</button>
          <button type="button" className={codeHomeView === "activity" ? "active" : ""} onClick={() => setCodeHomeView("activity")}>Activity</button>
        </div>

        {codeHomeView === "home" && (
          <div className="noti-code-home-grid-compact">
            <article className="dev-card dev-continue-card compact-card">
              <div className="dev-card-heading">
                <strong>Continue working</strong>
              </div>
              {activeSession ? (
                <div className="dev-current-session compact-session-card">
                  <div className="dev-session-title-row">
                    <h2>{activeSession.title}</h2>
                    <span>{activeSession.status}</span>
                  </div>
                  <p>{activeSession.updated}</p>
                  <div className="dev-repo-row">
                    <span>GitHub</span>
                    <span>{activeSession.repo}</span>
                    <span>{activeSession.branch}</span>
                  </div>
                  <div className="dev-session-actions">
                    <button type="button" className="dev-primary-button" onClick={() => openSession(activeSession.id)}>Continue Session</button>
                    <div className="dev-menu-wrap">
                      <button type="button" className="dev-more-button" onClick={() => setSessionMenuOpen((open) => !open)}>•••</button>
                      {sessionMenuOpen && (
                        <div className="dev-session-menu" onMouseLeave={() => setSessionMenuOpen(false)}>
                          <button type="button" onClick={() => openSession(activeSession.id)}>Open</button>
                          <button type="button" onClick={() => saveSnapshot()}>Save snapshot</button>
                          <button type="button" className="danger" onClick={() => deleteSession(activeSession.id)}>Delete session</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="dev-empty-state">
                  <strong>No active sessions.</strong>
                  <span>Create a session to start building.</span>
                  <button type="button" className="dev-primary-button" onClick={createSession}>+ New Session</button>
                </div>
              )}
            </article>

            <article className="dev-card dev-activity-card compact-card">
              <div className="dev-card-heading">
                <strong>Activity</strong>
              </div>
              <div className="dev-empty-state compact-empty">
                <strong>Clean slate.</strong>
                <span>Run, snapshot, and GitHub activity will appear here later.</span>
              </div>
            </article>
          </div>
        )}

        {codeHomeView === "sessions" && (
          <section className="dev-section-block compact-section">
            <div className="dev-section-header">
              <strong>Sessions</strong>
              <button type="button" onClick={createSession}>+ New Session</button>
            </div>
            <div className="dev-session-list-compact">
              {sessions.length ? sessions.map((session) => (
                <div key={session.id} className="dev-session-row">
                  <button type="button" onClick={() => openSession(session.id)}>
                    <strong>{session.title}</strong>
                    <span>{session.repo} · {session.branch}</span>
                    <small>{session.updated}</small>
                  </button>
                  <button type="button" className="dev-delete-row" onClick={() => deleteSession(session.id)}>Delete</button>
                </div>
              )) : (
                <div className="dev-empty-state">
                  <strong>No sessions yet.</strong>
                  <span>Create one when you are ready.</span>
                </div>
              )}
            </div>
          </section>
        )}

        {codeHomeView === "activity" && (
          <section className="dev-section-block compact-section">
            <div className="dev-section-header">
              <strong>Activity</strong>
            </div>
            <div className="dev-empty-state wide-empty">
              <strong>No recent activity.</strong>
              <span>This stays quiet until GitHub, snapshots, or session events are connected.</span>
            </div>
          </section>
        )}

        <section className="dev-section-block compact-section">
          <div className="dev-section-header">
            <strong>Integrations</strong>
          </div>
          <div className="dev-integration-row compact-integrations">
            <button type="button" className="dev-integration-card">
              <span>◉</span>
              <strong>GitHub</strong>
              <small>Connect repo context later</small>
            </button>
            <button type="button" className="dev-integration-card">
              <span>⌘</span>
              <strong>VS Code</strong>
              <small>Open locally later</small>
            </button>
            <button type="button" className="dev-integration-card muted" onClick={() => setCodeHomeView("activity")}>
              <span>＋</span>
              <strong>More</strong>
              <small>Keep optional</small>
            </button>
          </div>
        </section>
      </section>
    );
  }

  if (section === "Snippets") {
    return (
      <section className="dev-list-space">
        <div className="dev-list-header">
          <div>
            <span className="dev-eyebrow">Noti Code</span>
            <h1>Snippets</h1>
          </div>
          <div className="dev-home-actions">
            <label className="dev-search-field"><span>⌕</span><input placeholder="Search snippets…" /></label>
            <button type="button" className="dev-primary-button" onClick={newSnippet}>+ New Snippet</button>
          </div>
        </div>
        <div className="dev-filter-row"><button>All</button><button>Favorites</button><button>React</button><button>Animation</button><button>Utils</button></div>
        <div className="dev-snippet-grid">
          {snippetCards.map((snippet) => (
            <button key={snippet.title} type="button" className="dev-snippet-card" onClick={() => { setActiveSnippet(`${snippet.title}.tsx`); setMode("session"); }}>
              <strong>{snippet.title}</strong>
              <span>{snippet.tag}</span>
              <small>{snippet.updated}</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (section === "Snapshots") {
    return (
      <section className="dev-list-space">
        <div className="dev-list-header">
          <div>
            <span className="dev-eyebrow">Noti Code</span>
            <h1>Snapshots</h1>
          </div>
          <button type="button" className="dev-primary-button" onClick={saveSnapshot}>+ New Snapshot</button>
        </div>
        <div className="dev-snapshot-list-large">
          {snapshots.map((snapshot, index) => (
            <button key={`${snapshot}-${index}`} type="button" onClick={openSession}>
              <div className="dev-snapshot-thumb" />
              <div><strong>{snapshot}</strong><span>May {14 - index}, 2026 · noti-app · main</span></div>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (section === "Integrations") {
    return (
      <section className="dev-list-space">
        <div className="dev-list-header">
          <div>
            <span className="dev-eyebrow">Noti Code</span>
            <h1>Integrations</h1>
            <p>Start with GitHub. Keep the rest optional and quiet until the direction is locked.</p>
          </div>
        </div>
        <div className="dev-integration-list">
          {["GitHub", "VS Code", "Linear", "Jira", "Slack"].map((tool, index) => (
            <button key={tool} type="button">
              <span>{index < 2 ? "Connected" : "Connect"}</span>
              <strong>{tool}</strong>
              <small>{tool === "GitHub" ? "Repo context and snapshots" : "Available later"}</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const filteredQuickFiles = fileList.filter((file) =>
    file.toLowerCase().includes(quickOpenQuery.toLowerCase()),
  );

  return (
    <section className={`noti-code-session-space vscode-shell ${explorerOpen ? "explorer-visible" : "explorer-hidden"} ${rightPanelOpen ? "right-panel-visible" : "right-panel-collapsed"}`}>
      <div className="compiler-hover-zone" aria-hidden="true" />
      <div className="compiler-floating-window-controls" aria-label="Window controls">
        <button type="button" onClick={minimiseCompilerWindow} title="Minimise window">—</button>
        <button type="button" onClick={toggleCompilerFullscreen} title="Maximise window">□</button>
        <button type="button" onClick={closeCompilerWindow} title="Close window">×</button>
      </div>
      <header className="noti-code-session-header vscode-session-header">
        <div className="noti-code-session-title">
          <button
            type="button"
            className="noti-code-menu-button"
            onClick={() => setMode("home")}
            aria-label="Back to Noti Code home"
            title="Back to Noti Code home"
          >
            ☰
          </button>
          <span className="noti-code-chevron">⌁</span>
          <strong>{activeSession?.title ?? "Untitled Session"}</strong>
          <span className="noti-code-active-dot" />
          <small>Active</small>
        </div>

        <div className="noti-code-session-actions">
          <button type="button" className="noti-code-pill">{activeSession?.repo ?? "noti-app"}⌄</button>
          <button type="button" className="noti-code-pill">{activeSession?.branch ?? "main"}⌄</button>
          <button type="button" className="noti-code-icon-button tooltip-button" onClick={() => setExplorerOpen((current) => !current)} title="Toggle Explorer — ⌘B" data-tooltip="Explorer">◧</button>
          <button type="button" className="noti-code-icon-button tooltip-button" onClick={() => setQuickOpenOpen(true)} title="Quick open — ⌘P" data-tooltip="Quick open">⌕</button>
          <div className="noti-code-upload-wrap">
            <button type="button" className="noti-code-icon-button tooltip-button" onClick={() => setUploadMenuOpen((current) => !current)} title="Import files or folder" data-tooltip="Import">⇧</button>
            {uploadMenuOpen && (
              <div className="noti-code-upload-menu" onMouseDown={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => fileUploadRef.current?.click()}>Import files</button>
                <button type="button" onClick={() => folderUploadRef.current?.click()}>Import folder</button>
              </div>
            )}
          </div>
          <button type="button" className="noti-code-icon-button tooltip-button" onClick={() => setBottomPanelOpen((current) => !current)} title="Toggle terminal/problems panel — ⌘J" data-tooltip="Bottom panel">⌄</button>
          <button type="button" className="noti-code-icon-button tooltip-button" onClick={() => setRightPanelOpen((current) => !current)} title="Toggle Run / Notes / Linked panel" data-tooltip="Right panel">◫</button>
          <button type="button" className="noti-code-icon-button tooltip-button" onClick={copyCode} title="Copy active file" data-tooltip="Copy">⧉</button>
          <button type="button" className="noti-code-icon-button tooltip-button" onClick={saveSnapshot} title="Save snapshot — ⌘S" data-tooltip="Snapshot">◌</button>
          <button type="button" className="noti-code-icon-button tooltip-button danger" onClick={deleteActiveFile} title="Remove active file from session" data-tooltip="Remove file">⌫</button>
          <button type="button" className="noti-code-primary-button tooltip-button" onClick={runCode} title="Run — ⌘↵" data-tooltip="Run session">{running ? "Running…" : "▷ Run"}</button>
        </div>
      </header>

      <input
        ref={fileUploadRef}
        className="noti-code-file-upload"
        type="file"
        multiple
        onChange={(event) => uploadFiles(event.target.files)}
      />
      <input
        ref={folderUploadRef}
        className="noti-code-file-upload"
        type="file"
        multiple
        onChange={(event) => uploadFiles(event.target.files)}
      />

      {quickOpenOpen && (
        <div className="noti-code-quick-open" onMouseDown={(event) => event.stopPropagation()}>
          <label>
            <span>⌘P</span>
            <input
              autoFocus
              value={quickOpenQuery}
              onChange={(event) => setQuickOpenQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuickOpenOpen(false);
                if (event.key === "Enter" && filteredQuickFiles[0]) openFile(filteredQuickFiles[0]);
              }}
              placeholder="Quick open file…"
            />
          </label>
          <div className="noti-code-quick-results">
            {filteredQuickFiles.slice(0, 8).map((file) => (
              <button key={file} type="button" onClick={() => openFile(file)}>
                <span>#</span>
                <strong>{file}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="noti-code-editor-layout vscode-layout">
        {explorerOpen && (
          <aside className="noti-code-files-panel vscode-explorer" aria-label="File explorer">
            <div className="noti-code-panel-heading vscode-panel-title">
              <strong>EXPLORER</strong>
              <span>
                <button type="button" title="New file" onClick={newFile}>＋</button>
                <button type="button" title="New folder" onClick={newFolder}>▣</button>
                <button type="button" title="Import files or folder" onClick={() => setUploadMenuOpen((current) => !current)}>⇧</button>
                <button type="button" title="More">…</button>
              </span>
            </div>

            <div className="vscode-section-block">
              <button type="button" className="vscode-section-title">⌄ OPEN EDITORS</button>
              {openFiles.map((file) => (
                <button
                  type="button"
                  key={file}
                  className={`vscode-open-editor ${activeSnippet === file ? "active-file" : ""}`}
                  onClick={() => openFile(file)}
                >
                  <span>#</span>
                  <strong>{file}</strong>
                  <em>src</em>
                </button>
              ))}
            </div>

            <div className="vscode-section-block file-tree-block">
              <button type="button" className="vscode-section-title">⌄ FRONTEND</button>
              <div className="noti-code-file-tree">
                <button type="button">› .vscode</button>
                <button type="button">› node_modules</button>
                <button type="button">› public</button>
                {customFolders.map((folder) => <button key={folder} type="button">› {folder}</button>)}
                <button type="button">⌄ src</button>
                <button type="button">&nbsp;&nbsp;› assets</button>
                <button type="button">&nbsp;&nbsp;⌄ components</button>
                <button type="button">&nbsp;&nbsp;&nbsp;&nbsp;⌄ calendar</button>
                {["Calendar.tsx", "useCalendar.ts", "calendar.types.ts"].map((file) => (
                  <button
                    type="button"
                    key={file}
                    className={activeSnippet === file ? "active-file" : ""}
                    onClick={() => openFile(file)}
                  >
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# {file}
                  </button>
                ))}
                <button type="button">&nbsp;&nbsp;› hooks</button>
                <button type="button">&nbsp;&nbsp;› styles</button>
                <button type="button">&nbsp;&nbsp;› utils</button>
                {["App.tsx", "App.css", "main.tsx", "vite-env.d.ts", ".gitignore", "package.json", "README.md", "tsconfig.json"].map((file) => (
                  <button key={file} type="button" className={activeSnippet === file ? "active-file" : ""} onClick={() => openFile(file)}>
                    # {file}
                  </button>
                ))}
                {Object.keys(customFiles).map((file) => (
                  <button key={file} type="button" className={activeSnippet === file ? "active-file imported-file" : "imported-file"} onClick={() => openFile(file)}>
                    ⇧ {file}
                  </button>
                ))}
              </div>
            </div>

            <div className="vscode-collapsed-drawers">
              <button type="button">› OUTLINE</button>
              <button type="button">› TIMELINE</button>
            </div>

            <footer className="noti-code-files-footer vscode-status-strip">
              <span>⑂ main⌄</span>
              <span>◌ 0 0</span>
            </footer>
          </aside>
        )}

        <main className="noti-code-editor-panel vscode-editor-panel">
          <div className="vscode-tabs-row">
            {openFiles.map((file) => (
              <button
                key={file}
                type="button"
                className={`noti-code-editor-tab ${activeSnippet === file ? "active-tab" : ""}`}
                onClick={() => openFile(file)}
              >
                <span># {file}</span>
                <i>{activeSnippet === file ? "●" : ""}</i>
                <b onClick={(event) => { event.stopPropagation(); closeFile(file); }}>×</b>
              </button>
            ))}
          </div>

          <div className="vscode-breadcrumb-row">
            <span>src</span><span>›</span><span>{activeSnippet}</span><span>›</span><strong>{activeSnippet.replace(/\..+$/, "")}</strong>
          </div>

          <div className="vscode-editor-shell">
            <div className="vscode-line-numbers" aria-hidden="true">
              {Array.from({ length: Math.max(28, code.split("\n").length + 2) }).map((_, index) => (
                <span key={index}>{index + 1}</span>
              ))}
            </div>
            <textarea
              ref={codeEditorRef}
              className="noti-code-editor vscode-code-textarea"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                updateEditorStats(event.currentTarget);
              }}
              onClick={(event) => updateEditorStats(event.currentTarget)}
              onKeyUp={(event) => updateEditorStats(event.currentTarget)}
              onKeyDown={handleCodeEditorKeyDown}
              spellCheck={false}
              aria-label="Code editor"
            />
            <div className="vscode-minimap" aria-hidden="true">
              {code.split("\n").slice(0, 38).map((line, index) => (
                <span key={index} style={{ width: `${Math.min(92, Math.max(14, line.length * 1.5))}%` }} />
              ))}
            </div>
          </div>

          {bottomPanelOpen && (
            <section className="vscode-bottom-panel">
              <div className="vscode-bottom-tabs">
                {(["Terminal", "Problems", "Output", "Git"] as const).map((tab) => (
                  <button key={tab} type="button" className={bottomPanelTab === tab ? "active" : ""} onClick={() => setBottomPanelTab(tab)}>{tab}</button>
                ))}
                <button type="button" onClick={() => setBottomPanelOpen(false)}>×</button>
              </div>
              {bottomPanelTab === "Terminal" && (
                <div className="vscode-terminal-panel">
                  <div>{terminalHistory.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</div>
                  <label><span>$</span><input value={terminalCommand} onChange={(event) => setTerminalCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") runTerminalCommand(); }} placeholder="git status" /></label>
                </div>
              )}
              {bottomPanelTab === "Problems" && <div className="vscode-empty-panel">✓ No problems detected</div>}
              {bottomPanelTab === "Output" && <div className="vscode-terminal-panel"><div>{output.length ? output.map((line) => <span key={line}>{line}</span>) : <span>No output yet. Run the session with ⌘↵.</span>}</div></div>}
              {bottomPanelTab === "Git" && <div className="vscode-git-panel"><strong>Source Control</strong><p>main · local workspace</p><input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Commit message" /><button type="button" onClick={commitChanges}>Commit</button><button type="button" onClick={() => setTerminalHistory((current) => [...current, "$ git push origin main", "Push queued for future GitHub integration"])}>Push</button></div>}
            </section>
          )}

          <footer className="noti-code-editor-status vscode-status-bar">
            <span>Ln {editorStats.line}, Col {editorStats.column}</span>
            <button type="button" onClick={() => insertAtSelection("  ")}>Spaces: 2</button>
            <span>UTF-8</span>
            <span>LF</span>
            <span>{language}</span>
            <button type="button" onClick={() => setBottomPanelOpen((current) => !current)}>Panel ⌘J</button>
            <button type="button" onClick={deleteActiveFile} title="Remove active file from this session">Remove file</button>
            <strong>● Auto-save on</strong>
          </footer>
        </main>

        {rightPanelOpen ? (
          <aside className="noti-code-right-panel vscode-right-panel" aria-label="Run output, notes, and linked context">
            <div className="noti-code-right-panel-tabs" role="tablist" aria-label="Right panel sections">
              {(["Run", "Notes", "Linked"] as const).map((tab) => (
                <button key={tab} type="button" className={rightPanelTab === tab ? "active" : ""} onClick={() => setRightPanelTab(tab)}>{tab}</button>
              ))}
              <button type="button" className="collapse-right-panel" onClick={() => setRightPanelOpen(false)} title="Collapse right panel">›</button>
            </div>

            {rightPanelTab === "Run" && (
              <section className="noti-code-run-card">
                <div className="noti-code-run-heading">
                  <strong>Run</strong>
                  <button type="button" className="noti-code-primary-button compact" onClick={runCode} title="Run session — ⌘↵">▷</button>
                </div>
                <div className="noti-code-tabs">
                  <button type="button" className="active" onClick={() => { setBottomPanelOpen(true); setBottomPanelTab("Output"); }}>Output</button>
                  <button type="button" onClick={() => { setBottomPanelOpen(true); setBottomPanelTab("Terminal"); }}>Console</button>
                </div>
                <div className="noti-code-output-box">
                  {outputOpen ? output.map((line) => <span key={line}>{line}</span>) : <p>No output yet.</p>}
                  <div className="noti-code-success-mark">✓<small>No errors found</small></div>
                </div>
                <button type="button" className="noti-code-clear-button" onClick={() => { setOutput([]); setOutputOpen(false); }}>Clear</button>
              </section>
            )}

            {rightPanelTab === "Notes" && (
              <section className="noti-code-context-card full-height-card">
                <div className="noti-code-panel-heading">
                  <strong>Notes</strong>
                  <span><button type="button" title="Save note" onClick={() => setOutput(["✓ Notes saved locally"])}>◌</button><button type="button" title="New note" onClick={() => setWorkspaceNote("")}>＋</button></span>
                </div>
                <textarea
                  className="noti-code-note-box"
                  value={workspaceNote}
                  onChange={(event) => setWorkspaceNote(event.target.value)}
                  spellCheck={false}
                />
              </section>
            )}

            {rightPanelTab === "Linked" && (
              <section className="noti-code-linked-card full-height-card">
                <strong>Linked</strong>
                <button type="button" onClick={() => { setBottomPanelOpen(true); setBottomPanelTab("Git"); }}><span>◉</span><div><b>noti-app</b><small>GitHub Repository</small></div></button>
                <button type="button" onClick={() => { setBottomPanelOpen(true); setBottomPanelTab("Git"); }}><span>⑂</span><div><b>main</b><small>Branch</small></div></button>
                <button type="button" onClick={() => setUploadMenuOpen(true)}><span>⇧</span><div><b>Imported files</b><small>{Object.keys(customFiles).length} local file reference{Object.keys(customFiles).length === 1 ? "" : "s"}</small></div></button>
              </section>
            )}
          </aside>
        ) : (
          <button type="button" className="noti-code-right-rail-reopen" onClick={() => setRightPanelOpen(true)} title="Open Run / Notes / Linked panel">‹</button>
        )}
      </div>
    </section>
  );
}


function WorkspacePreview({
  workspace,
  threads,
  onNewNote,
}: {
  workspace: WorkspaceName;
  threads: NoteThread[];
  onNewNote: () => void;
}) {
  const scheduledThreads = threads.filter(
    (thread) => thread.dueDate || thread.dueTime,
  );
  const projectThreads = threads.filter(
    (thread) => thread.category === "Projects",
  );

  const previewCopy: Record<
    WorkspaceName,
    { title: string; eyebrow: string; body: string }
  > = {
    Notes: {
      title: "Notes",
      eyebrow: "Capture",
      body: "Conversation-first notes live here.",
    },
    Today: {
      title: "Today",
      eyebrow: "Daily space",
      body: "Time-sensitive notes and recently touched work will surface here.",
    },
    Calendar: {
      title: "Calendar",
      eyebrow: "Time layer",
      body: "Scheduled notes appear as calm calendar commitments.",
    },
    Reminders: {
      title: "Reminders",
      eyebrow: "Follow-up layer",
      body: "Notes with dates, times, or reminders become lightweight follow-ups.",
    },
    Projects: {
      title: "Projects",
      eyebrow: "Workstream layer",
      body: "Group related notes into calmer project surfaces without turning into a dashboard.",
    },
    Tasks: {
      title: "Tasks",
      eyebrow: "Action layer",
      body: "A simple action list space for work that is not calendar-bound.",
    },
    Files: {
      title: "Files",
      eyebrow: "Reference layer",
      body: "A future place for screenshots, documents, and linked workspace assets.",
    },
    Meetings: {
      title: "Meetings",
      eyebrow: "Decision layer",
      body: "A future space for meeting notes, summaries, and follow-ups.",
    },
    Knowledge: {
      title: "Knowledge",
      eyebrow: "Memory layer",
      body: "A future reusable knowledge base for decisions and evergreen notes.",
    },
  };

  const copy = previewCopy[workspace];
  const relevantThreads =
    workspace === "Calendar" ||
    workspace === "Reminders" ||
    workspace === "Today"
      ? scheduledThreads
      : workspace === "Projects"
          ? projectThreads
          : threads.slice(0, 3);

  return (
    <section className="workspace-preview-layer">
      <div className="workspace-preview-hero">
        <span>{copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </div>

      <div
        className={`workspace-preview-grid workspace-preview-${workspace.toLowerCase()}`}
      >
        <article className="workspace-preview-card workspace-preview-card-large">
          <div className="workspace-preview-card-header">
            <strong>
              {workspace === "Today" ? "Happening soon" : "Linked threads"}
            </strong>
            <button type="button" onClick={onNewNote}>
              + New note
            </button>
          </div>

          {relevantThreads.length > 0 ? (
            <div className="workspace-preview-list">
              {relevantThreads.slice(0, 4).map((thread) => (
                <div className="workspace-preview-list-item" key={thread.id}>
                  <span>{getCategoryIcon(thread.category)}</span>
                  <div>
                    <strong>{thread.title}</strong>
                    <small>
                      {thread.dueDate || thread.dueTime
                        ? `${thread.dueDate} ${thread.dueTime}`.trim()
                        : thread.category}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="workspace-preview-empty">
              <strong>No linked notes yet.</strong>
              <p>
                Create a note and add time, code, or project context to have it
                appear here.
              </p>
            </div>
          )}
        </article>

        <article className="workspace-preview-card">
          <strong>
            {workspace === "Calendar" ? "Schedule" : "Ambient actions"}
          </strong>
          <p>
            {"This space is now wired into the sidebar and ready for deeper UI next."}
          </p>
        </article>
      </div>
    </section>
  );
}

function getWorkspaceIcon(workspace: string) {
  switch (workspace) {
    case "Notes":
      return "▣";
    case "Today":
      return "☀";
    case "Calendar":
      return "◫";
    case "Reminders":
      return "✓";
    case "Code":
      return "</>";
    case "Projects":
      return "▱";
    case "Tasks":
      return "☑";
    case "Files":
      return "▤";
    case "Meetings":
      return "◉";
    case "Knowledge":
      return "◇";
    default:
      return "•";
  }
}

function getRailIcon(workspace: string) {
  switch (workspace) {
    case "Notes":
      return "I";
    case "Today":
      return "T";
    case "Calendar":
      return "C";
    case "Reminders":
      return "R";
    case "Code":
      return "</>";
    case "Projects":
      return "P";
    case "Archive":
      return "A";
    default:
      return "•";
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "Personal":
      return "●";
    case "Work":
      return "◆";
    case "Projects":
      return "▣";
    case "Ideas":
      return "✦";
    case "Study":
      return "◐";
    default:
      return "⌁";
  }
}

function getUpdateReply() {
  const replies = ["Updated.", "Noted.", "Saved.", "Added."];
  return replies[Math.floor(Math.random() * replies.length)];
}

export default App;
