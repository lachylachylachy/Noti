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
        onMouseDown={() => {
          closeTransientUi();
        }}
      >
        <div
          className={`workspace-card ${activeEnvironment === "code" ? "workspace-code-space code-environment" : `workspace-${activeWorkspace.toLowerCase()}`} ${sidebarOpen ? "sidebar-expanded" : "sidebar-collapsed"}` }
          onMouseDown={(event) => {
            event.stopPropagation();
            const target = event.target as HTMLElement;
            if (!target.closest(
              ".workspace-sidebar-drawer, .workspace-sidebar-rail, .workspace-menu-popover, .thread-menu-popover, .workspace-more-button, .thread-more-button, .add-space-menu"
            )) {
              setWorkspaceMenuOpen(null);
              setThreadMenuOpen(null);
              setAddSpaceOpen(false);
              if (activeEnvironment === "noti" && activeWorkspace !== "Notes") {
                setSidebarOpen(false);
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
            className="workspace-sidebar-rail"
            aria-label="Integrated applications rail"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={`rail-logo-button ${activeEnvironment === "noti" ? "rail-logo-button-active" : ""}`}
              aria-label="Noti workspace"
              title="Noti"
              onClick={() => {
                setActiveEnvironment("noti");
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
                setSidebarOpen(true);
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
  };

  type EventDraft = Pick<CalendarEvent, "title" | "date" | "start" | "end" | "tone" | "notes">;

  const START_HOUR = 6;
  const END_HOUR = 23;
  const DAY_COUNT = 7;
  const STORAGE_KEY = "noti-calendar-events-v2";
  const NOTES_KEY = "noti-calendar-event-notes-v1";
  const HIDDEN_KEY = "noti-calendar-hidden-events-v1";
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [view, setView] = useState<"Day" | "Week" | "Month" | "Agenda">("Week");
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadCalendarEvents(STORAGE_KEY));
  const [hiddenEventIds, setHiddenEventIds] = useState<string[]>(() => loadStringList(HIDDEN_KEY));
  const [eventNotes, setEventNotes] = useState<Record<string, string>>(() => loadRecord(NOTES_KEY));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [panelTab, setPanelTab] = useState<"Notes" | "Files" | "Links" | "Tasks">("Notes");
  const [calendarMotion, setCalendarMotion] = useState<"idle" | "next" | "prev">("idle");

  const today = new Date();
  const todayIso = toISODate(today);
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
      const current = weekDays.find((day) => day.isToday) ?? weekDays[0];
      return [current];
    }
    return weekDays;
  }, [view, weekDays]);

  const monthDays = useMemo(() => {
    const first = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    const start = getMonday(first);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        iso: toISODate(date),
        number: date.getDate(),
        inMonth: date.getMonth() === weekStart.getMonth(),
        isToday: date.toDateString() === today.toDateString(),
      };
    });
  }, [weekStart, todayIso]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(eventNotes));
  }, [eventNotes]);

  useEffect(() => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenEventIds));
  }, [hiddenEventIds]);

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
        };
      });
  }, [threads, eventNotes, todayIso]);

  const allEvents = useMemo(() => {
    const merged = [...events, ...scheduledEvents]
      .filter((event) => !hiddenEventIds.includes(event.id))
      .map((event) => ({ ...event, notes: eventNotes[event.id] ?? event.notes }));

    return merged.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return timeToMinutes(a.start) - timeToMinutes(b.start);
    });
  }, [events, scheduledEvents, eventNotes, hiddenEventIds]);

  const visibleEvents = allEvents.filter((event) => displayedDays.some((day) => day.iso === event.date));
  const selectedEvent = allEvents.find((event) => event.id === selectedEventId) ?? null;
  const contextOpen = Boolean(selectedEvent);
  const upcoming = allEvents.filter((event) => event.date >= todayIso).slice(0, 6);

  const endOfWeek = new Date(weekStart);
  endOfWeek.setDate(weekStart.getDate() + 6);
  const rangeLabel =
    view === "Month"
      ? weekStart.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "Day"
        ? displayedDays[0]?.iso
          ? new Date(`${displayedDays[0].iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short", year: "numeric" })
          : "Today"
        : `${weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${endOfWeek.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const showNow = weekDays.some((day) => day.isToday) && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;
  const nowTop = minutesToTop(nowMinutes, START_HOUR, END_HOUR);

  function moveWeek(direction: -1 | 1) {
    setCalendarMotion(direction === 1 ? "next" : "prev");
    setWeekStart((current) => {
      const next = new Date(current);
      if (view === "Month") {
        next.setMonth(current.getMonth() + direction);
        return getMonday(next);
      }
      next.setDate(current.getDate() + direction * DAY_COUNT);
      return getMonday(next);
    });
    closeEventPanel();
    window.setTimeout(() => setCalendarMotion("idle"), 360);
  }

  function jumpToToday() {
    const todayWeek = getMonday(new Date());
    const direction = todayWeek.getTime() > weekStart.getTime() ? "next" : todayWeek.getTime() < weekStart.getTime() ? "prev" : "idle";
    setCalendarMotion(direction);
    setWeekStart(todayWeek);
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

  function createEvent() {
    const date = displayedDays.find((day) => day.isToday)?.iso ?? displayedDays[0]?.iso ?? todayIso;
    const newEvent: CalendarEvent = {
      id: `manual-${Date.now()}`,
      title: "New event",
      date,
      start: "12:00",
      end: "12:45",
      tone: "stone",
      source: "calendar",
      notes: "",
    };

    setEvents((current) => [...current, newEvent]);
    setSelectedEventId(newEvent.id);
    setDraft(toEventDraft(newEvent));
    setEditing(true);
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
      setEvents((current) =>
        current.map((event) =>
          event.id === selectedEvent.id
            ? { ...event, ...cleanDraft }
            : event,
        ),
      );
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

  return (
    <section className={`calendar-space ${contextOpen ? "calendar-context-open" : "calendar-context-closed"}`}>
      <div className="calendar-board" aria-label="Calendar workspace">
        <header className="calendar-toolbar">
          <div className="calendar-range-control">
            <button type="button" aria-label="Previous week" onClick={() => moveWeek(-1)}>‹</button>
            <strong>{rangeLabel}</strong>
            <button type="button" aria-label="Next week" onClick={() => moveWeek(1)}>›</button>
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

          <button type="button" className="calendar-add-button" onClick={createEvent}>
            + New Event
          </button>
        </header>

        <div className={`calendar-view-stack calendar-motion-${calendarMotion}`} key={`${view}-${weekStart.toISOString()}`}>
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
                    setWeekStart(getMonday(new Date(`${day.iso}T12:00:00`)));
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
              <button key={day.iso} type="button" className={`calendar-day-heading ${day.isToday ? "calendar-day-current" : ""}`}>
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

            <div className="calendar-grid" role="grid" aria-label="Week calendar grid">
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
      </div>

      {contextOpen && selectedEvent && (
        <aside className="calendar-context-panel" aria-label="Selected calendar event details">
          <button type="button" className="calendar-context-close" onClick={closeEventPanel} aria-label="Close event details">›</button>

          <section className="calendar-upcoming-card">
            <div className="calendar-panel-title-row">
              <h3>Upcoming</h3>
            </div>
            {upcoming.map((event) => (
              <button
                key={`upcoming-${event.id}`}
                type="button"
                className={selectedEvent.id === event.id ? "upcoming-event active" : "upcoming-event"}
                onClick={() => selectEvent(event.id)}
              >
                <strong>{event.title}</strong>
                <span>{formatDateShort(event.date)} · {formatTimeLabel(event.start)}</span>
              </button>
            ))}
          </section>

          <section className="calendar-detail-card">
            <div className="calendar-detail-heading">
              <div>
                <strong>{selectedEvent.title}</strong>
                <p>{formatDateLong(selectedEvent.date)} · {formatTimeLabel(selectedEvent.start)} – {formatTimeLabel(selectedEvent.end)}</p>
              </div>
              <button type="button" aria-label="More event options">•••</button>
            </div>

            <div className="calendar-source-pill">{selectedEvent.source === "note" ? "Linked note" : selectedEvent.source === "reminder" ? "Reminder" : "Calendar event"}</div>

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
                <label>
                  <span>Notes</span>
                  <textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="Add context, links, or follow-up notes..." />
                </label>
                <div className="calendar-edit-actions">
                  <button type="button" onClick={saveDraft}>Save changes</button>
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
                  <div className="calendar-notes-preview">
                    {(eventNotes[selectedEvent.id] ?? selectedEvent.notes)?.trim() || "No extra notes yet. Click Edit to add context."}
                  </div>
                ) : (
                  <p className="calendar-detail-note">{panelTab} attachments will sit here once integrations are connected.</p>
                )}

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
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
}) {
  return {
    title: event.title,
    date: event.date,
    start: normalizeTimeInput(event.start),
    end: normalizeTimeInput(event.end),
    tone: event.tone as "stone" | "slate" | "violet" | "lavender" | "green" | "plum" | "purple" | "amber" | "blue" | "note",
    notes: event.notes,
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
  const [output, setOutput] = useState<string[]>([]);
  const [activity, setActivity] = useState([
    "Updated calendar animations.ts · 12m ago",
    "Created snippet useSpatialDragging · 1h ago",
    "Snapshot created before glass refactor · Yesterday",
  ]);
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

  const sessions: DevSession[] = [
    {
      id: "noti-calendar",
      title: "Noti Spatial Calendar",
      repo: "noti-app",
      branch: "main",
      updated: "Updated 12m ago",
      status: "Active",
    },
    {
      id: "calendar-refactor",
      title: "Calendar Refactor",
      repo: "noti-app",
      branch: "main",
      updated: "Updated 2h ago",
      status: "Draft",
    },
    {
      id: "sidebar-polish",
      title: "Glass Sidebar Polish",
      repo: "noti-app",
      branch: "main",
      updated: "Yesterday",
      status: "Review",
    },
    {
      id: "animation-cleanup",
      title: "Animation Cleanup",
      repo: "noti-app",
      branch: "main",
      updated: "2 days ago",
      status: "Saved",
    },
  ];

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

  function openSession() {
    setMode("session");
    setOutputOpen(false);
  }

  function runCode() {
    setRunning(true);
    setOutputOpen(true);
    setOutput(["Running local session checks…"]);
    window.setTimeout(() => {
      setRunning(false);
      setOutput(["✓ Compiled successfully", "✓ No errors found", "Completed in 362ms"]);
      setActivity((current) => ["Ran Calendar.tsx successfully · Just now", ...current].slice(0, 4));
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
    setActivity((current) => [`Snapshot saved for ${activeSnippet} · Just now`, ...current].slice(0, 4));
  }

  function newSnippet() {
    const label = `snippet-${Date.now().toString().slice(-4)}.tsx`;
    setActiveSnippet(label);
    setLanguage("TSX");
    setCode("export function NewSnippet() {\n  return null\n}\n");
    setMode("session");
    setOutputOpen(false);
  }

  if (mode === "home") {
    return (
      <section className="dev-home-space">
        <div className="dev-home-topbar">
          <div>
            <span className="dev-eyebrow">Noti Code</span>
            <h1>Build, experiment, and ship.</h1>
            <p>Your technical workspace for sessions, snippets, snapshots, and GitHub context.</p>
          </div>
          <div className="dev-home-actions">
            <label className="dev-search-field">
              <span>⌕</span>
              <input placeholder="Search sessions, snippets…" />
            </label>
            <button type="button" className="dev-icon-button">⌘K</button>
            <button type="button" className="dev-icon-button">◌</button>
            <button type="button" className="dev-primary-button" onClick={openSession}>+ New Session</button>
          </div>
        </div>

        <div className="dev-home-grid">
          <article className="dev-card dev-continue-card">
            <div className="dev-card-heading">
              <strong>Continue working</strong>
            </div>
            <div className="dev-current-session">
              <div className="dev-session-title-row">
                <h2>Noti Spatial Calendar</h2>
                <span>Active</span>
              </div>
              <p>Updated 12m ago</p>
              <div className="dev-repo-row">
                <span>GitHub</span>
                <span>noti-app</span>
                <span>main</span>
              </div>
              <div className="dev-session-actions">
                <button type="button" className="dev-primary-button" onClick={openSession}>Continue Session</button>
                <button type="button" className="dev-more-button">•••</button>
              </div>
            </div>
          </article>

          <article className="dev-card dev-activity-card">
            <div className="dev-card-heading">
              <strong>Recent Activity</strong>
            </div>
            <div className="dev-activity-list">
              {activity.map((item) => (
                <button key={item} type="button">
                  <span>◫</span>
                  <strong>{item.split(" · ")[0]}</strong>
                  <small>{item.split(" · ")[1] ?? "Recently"}</small>
                </button>
              ))}
            </div>
          </article>
        </div>

        <section className="dev-section-block">
          <div className="dev-section-header">
            <strong>Recent Sessions</strong>
            <button type="button" onClick={openSession}>View all sessions →</button>
          </div>
          <div className="dev-session-card-row">
            {sessions.slice(1).map((session) => (
              <button key={session.id} type="button" className="dev-small-session" onClick={openSession}>
                <strong>{session.title}</strong>
                <span>{session.updated}</span>
                <small>{session.repo}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="dev-section-block">
          <div className="dev-section-header">
            <strong>Your Integrations</strong>
          </div>
          <div className="dev-integration-row">
            <button type="button" className="dev-integration-card">
              <span>◉</span>
              <strong>GitHub</strong>
              <small>Connected later</small>
            </button>
            <button type="button" className="dev-integration-card">
              <span>⌘</span>
              <strong>VS Code</strong>
              <small>Available later</small>
            </button>
            <button type="button" className="dev-integration-card muted" onClick={newSnippet}>
              <span>＋</span>
              <strong>More Integrations</strong>
              <small>Connect tools you use</small>
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

  return (
    <section className="noti-code-session-space">
      <header className="noti-code-session-header">
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
          <strong>Noti Spatial Calendar</strong>
          <span className="noti-code-active-dot" />
          <small>Active</small>
        </div>

        <div className="noti-code-session-actions">
          <button type="button" className="noti-code-pill">noti-app⌄</button>
          <button type="button" className="noti-code-pill">main⌄</button>
          <button type="button" className="noti-code-icon-button" onClick={copyCode} title="Copy code">⧉</button>
          <button type="button" className="noti-code-icon-button" onClick={saveSnapshot} title="Save snapshot">◌</button>
          <button type="button" className="noti-code-primary-button" onClick={runCode}>{running ? "Running…" : "▷ Run"}</button>
        </div>
      </header>

      <div className="noti-code-editor-layout">
        <aside className="noti-code-files-panel" aria-label="File explorer">
          <div className="noti-code-panel-heading">
            <strong>Files</strong>
            <span>
              <button type="button" title="New file">＋</button>
              <button type="button" title="New folder">▣</button>
            </span>
          </div>

          <div className="noti-code-file-tree">
            <button type="button">⌄ src</button>
            <button type="button">&nbsp;&nbsp;⌄ components</button>
            <button type="button">&nbsp;&nbsp;&nbsp;&nbsp;⌄ calendar</button>
            {["Calendar.tsx", "useCalendar.ts", "calendar.types.ts"].map((file) => (
              <button
                type="button"
                key={file}
                className={activeSnippet === file ? "active-file" : ""}
                onClick={() => setActiveSnippet(file)}
              >
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{file}
              </button>
            ))}
            <button type="button">&nbsp;&nbsp;› hooks</button>
            <button type="button">&nbsp;&nbsp;› styles</button>
            <button type="button">&nbsp;&nbsp;› utils</button>
            <button type="button">App.tsx</button>
            <button type="button">index.tsx</button>
            <button type="button">.gitignore</button>
            <button type="button">package.json</button>
            <button type="button">README.md</button>
            <button type="button">tsconfig.json</button>
          </div>

          <footer className="noti-code-files-footer">
            <span>main⌄</span>
            <span>◌ 0 0</span>
          </footer>
        </aside>

        <main className="noti-code-editor-panel">
          <div className="noti-code-editor-tab">
            <span>{activeSnippet}</span>
            <button type="button" aria-label="Close file">×</button>
          </div>

          <textarea
            className="noti-code-editor"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
          />

          <footer className="noti-code-editor-status">
            <span>Ln 12, Col 5</span>
            <span>Spaces: 2</span>
            <span>UTF-8</span>
            <span>{language}</span>
            <strong>● Auto-save on</strong>
          </footer>
        </main>

        <aside className="noti-code-right-panel" aria-label="Run output and linked context">
          <section className="noti-code-run-card">
            <div className="noti-code-run-heading">
              <strong>Run</strong>
              <button type="button" className="noti-code-primary-button compact" onClick={runCode}>▷</button>
            </div>
            <div className="noti-code-tabs">
              <button type="button" className="active">Output</button>
              <button type="button">Console</button>
            </div>
            <div className="noti-code-output-box">
              {outputOpen ? output.map((line) => <span key={line}>{line}</span>) : <p>No output yet.</p>}
              <div className="noti-code-success-mark">✓<small>No errors found</small></div>
            </div>
            <button type="button" className="noti-code-clear-button" onClick={() => { setOutput([]); setOutputOpen(false); }}>Clear</button>
          </section>

          <section className="noti-code-context-card">
            <div className="noti-code-panel-heading">
              <strong>Notes</strong>
              <span>
                <button type="button">◌</button>
                <button type="button">＋</button>
              </span>
            </div>
            <textarea
              className="noti-code-note-box"
              defaultValue={"Working on the new spatial calendar layout.\n\nFocus on interaction polish and animation smoothness."}
              spellCheck={false}
            />
          </section>

          <section className="noti-code-linked-card">
            <strong>Linked</strong>
            <button type="button"><span>◉</span><div><b>noti-app</b><small>GitHub Repository</small></div></button>
            <button type="button"><span>⑂</span><div><b>main</b><small>Branch</small></div></button>
          </section>
        </aside>
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
