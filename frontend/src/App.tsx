import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

type Priority = "Low" | "Medium" | "High" | "Urgent";
type AssistantMessageKind = "meta_prompt" | "ack";

type CategoryItem = {
  id: string;
  name: string;
  archived?: boolean;
};

type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  kind: "note" | AssistantMessageKind;
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

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: "personal", name: "Personal" },
  { id: "work", name: "Work" },
  { id: "projects", name: "Projects" },
  { id: "study", name: "Study" },
  { id: "ideas", name: "Ideas" },
];

const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Urgent"];

const THREADS_STORAGE_KEY = "noti-threads-v2";
const CATEGORIES_STORAGE_KEY = "noti-categories-v2";

function createMessage(
  role: "user" | "assistant",
  text: string,
  kind: "note" | AssistantMessageKind,
  typing = false
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
          id: message.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role: message.role === "assistant" ? "assistant" : "user",
          text: message.text ?? "",
          kind:
            message.kind === "meta_prompt" || message.kind === "ack"
              ? message.kind
              : "note",
          typing: Boolean(message.typing),
          createdAt: message.createdAt ?? now,
        }))
      : [],
  };
}

function App() {
  const appWindow = getCurrentWindow();

  const topInputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"All" | string>("All");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [openMenuCategoryId, setOpenMenuCategoryId] = useState<string | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);

  const [topDraft, setTopDraft] = useState("");
  const [bottomDraft, setBottomDraft] = useState("");

  const [categories, setCategories] = useState<CategoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  const [threads, setThreads] = useState<NoteThread[]>(() => {
    try {
      const saved = localStorage.getItem(THREADS_STORAGE_KEY);
      return saved ? JSON.parse(saved).map(normaliseThread) : [];
    } catch {
      return [];
    }
  });

  const hasThreads = threads.length > 0;

  useEffect(() => {
    localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  }, [categories]);

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

  useEffect(() => {
    if (hasThreads) {
      setSidebarCollapsed(true);
    }
  }, [hasThreads]);

  const visibleCategories = useMemo(
    () => categories.filter((category) => !category.archived),
    [categories]
  );

  const archivedCategories = useMemo(
    () => categories.filter((category) => category.archived),
    [categories]
  );

  const threadsByCategory = useMemo(() => {
    const grouped: Record<string, NoteThread[]> = {
      Unassigned: [],
    };

    [...visibleCategories, ...archivedCategories].forEach((category) => {
      grouped[category.name] = [];
    });

    threads.forEach((thread) => {
      if (!grouped[thread.category]) {
        grouped[thread.category] = [];
      }
      grouped[thread.category].push(thread);
    });

    Object.values(grouped).forEach((items) => {
      items.sort((a, b) => b.id - a.id);
    });

    return grouped;
  }, [threads, visibleCategories, archivedCategories]);

  const visibleThreads = useMemo(() => {
    if (activeCategory === "All") {
      return [...threads].sort((a, b) => b.id - a.id);
    }

    return [...threads]
      .filter((thread) => thread.category === activeCategory)
      .sort((a, b) => b.id - a.id);
  }, [threads, activeCategory]);

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId);

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

  function focusActiveComposer() {
    if (hasThreads) {
      bottomInputRef.current?.focus();
      return;
    }

    topInputRef.current?.focus();
  }

  function updateThread(
    threadId: number,
    updater: (thread: NoteThread) => NoteThread
  ) {
    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId ? updater(thread) : thread
      )
    );
  }

  function finishTypingMessage(threadId: number, messageId: string) {
    window.setTimeout(() => {
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                typing: false,
              }
            : message
        ),
      }));
    }, 650);
  }

  function appendAssistantMessage(
    threadId: number,
    text: string,
    kind: AssistantMessageKind
  ) {
    const assistantMessage = createMessage("assistant", text, kind, true);

    updateThread(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toLocaleString(),
      messages: [...thread.messages, assistantMessage],
    }));

    finishTypingMessage(threadId, assistantMessage.id);
  }

  function createThreadFromDraft(content: string) {
    const trimmed = content.trim();
    if (!trimmed) return;

    const now = new Date().toLocaleString();
    const threadId = Date.now();

    const userMessage = createMessage("user", trimmed, "note");
    const assistantMessage = createMessage(
      "assistant",
      "New note added. Add a date, time, priority, or category if you want.",
      "meta_prompt",
      true
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

    setThreads((currentThreads) => [newThread, ...currentThreads]);
    setSelectedThreadId(threadId);
    setSidebarCollapsed(true);
    setTopDraft("");
    setBottomDraft("");

    setExpandedCategory("Unassigned");
    setActiveCategory("All");

    finishTypingMessage(threadId, assistantMessage.id);

    requestAnimationFrame(() => {
      bottomInputRef.current?.focus();
    });
  }

  function appendToSelectedThread() {
    if (!selectedThread || !bottomDraft.trim()) return;

    const trimmed = bottomDraft.trim();
    const userMessage = createMessage("user", trimmed, "note");
    const reply = getUpdateReply();
    const assistantMessage = createMessage("assistant", reply, "ack", true);

    updateThread(selectedThread.id, (thread) => ({
      ...thread,
      updatedAt: new Date().toLocaleString(),
      messages: [...thread.messages, userMessage, assistantMessage],
    }));

    setBottomDraft("");
    finishTypingMessage(selectedThread.id, assistantMessage.id);
  }

  function handleBottomSubmit() {
    if (selectedThread && bottomDraft.trim()) {
      appendToSelectedThread();
      return;
    }

    createThreadFromDraft(bottomDraft);
  }

  function updateThreadField<K extends keyof NoteThread>(
    threadId: number,
    field: K,
    value: NoteThread[K]
  ) {
    updateThread(threadId, (thread) => ({
      ...thread,
      [field]: value,
      updatedAt: new Date().toLocaleString(),
    }));

    appendAssistantMessage(threadId, getUpdateReply(), "ack");
  }

  function deleteThread(threadId: number) {
    setThreads((currentThreads) =>
      currentThreads.filter((thread) => thread.id !== threadId)
    );

    if (selectedThreadId === threadId) {
      setSelectedThreadId(null);
    }
  }

  function renameCategory(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;

    const nextName = window.prompt("Rename category", category.name)?.trim();
    if (!nextName || nextName === category.name) return;

    const nameTaken =
      nextName === "Unassigned" ||
      categories.some(
        (item) =>
          item.id !== categoryId &&
          item.name.toLowerCase() === nextName.toLowerCase()
      );

    if (nameTaken) {
      window.alert("That category name already exists.");
      return;
    }

    setCategories((currentCategories) =>
      currentCategories.map((item) =>
        item.id === categoryId
          ? {
              ...item,
              name: nextName,
            }
          : item
      )
    );

    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.category === category.name
          ? {
              ...thread,
              category: nextName,
              updatedAt: new Date().toLocaleString(),
            }
          : thread
      )
    );

    if (activeCategory === category.name) {
      setActiveCategory(nextName);
    }

    if (expandedCategory === category.name) {
      setExpandedCategory(nextName);
    }

    setOpenMenuCategoryId(null);
  }

  async function shareCategory(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;

    const categoryThreads = threads.filter(
      (thread) => thread.category === category.name
    );

    const shareText = [
      category.name,
      "",
      ...categoryThreads.map((thread) => `• ${thread.title}`),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(shareText || category.name);
      window.alert(`Copied "${category.name}" to clipboard.`);
    } catch {
      window.alert("Could not copy category content.");
    }

    setOpenMenuCategoryId(null);
  }

  function archiveCategory(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;

    setCategories((currentCategories) =>
      currentCategories.map((item) =>
        item.id === categoryId
          ? {
              ...item,
              archived: !item.archived,
            }
          : item
      )
    );

    if (activeCategory === category.name) {
      setActiveCategory("All");
    }

    if (expandedCategory === category.name) {
      setExpandedCategory(null);
    }

    setOpenMenuCategoryId(null);
  }

  function confirmDeleteCategory(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;

    const confirmed = window.confirm(
      `Delete "${category.name}"? Its notes will be moved to Unassigned.`
    );

    if (!confirmed) return;

    setCategories((currentCategories) =>
      currentCategories.filter((item) => item.id !== categoryId)
    );

    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.category === category.name
          ? {
              ...thread,
              category: "Unassigned",
              updatedAt: new Date().toLocaleString(),
            }
          : thread
      )
    );

    if (activeCategory === category.name) {
      setActiveCategory("All");
    }

    if (expandedCategory === category.name) {
      setExpandedCategory(null);
    }

    setDraggedCategoryId(null);
    setOpenMenuCategoryId(null);
  }

  function handleTopInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      createThreadFromDraft(topDraft);
    }
  }

  function handleBottomInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleBottomSubmit();
    }
  }

  function handleCategoryClick(categoryName: string) {
    setActiveCategory(categoryName);
    setExpandedCategory((current) =>
      current === categoryName ? null : categoryName
    );
    setOpenMenuCategoryId(null);
  }

  function handleCategoryDragStart(categoryId: string) {
    setDraggedCategoryId(categoryId);
    setOpenMenuCategoryId(null);
  }

  function handleCategoryDrop(targetCategoryId: string) {
    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) return;

    const visible = categories.filter((item) => !item.archived);
    const archived = categories.filter((item) => item.archived);

    const sourceIndex = visible.findIndex((item) => item.id === draggedCategoryId);
    const targetIndex = visible.findIndex((item) => item.id === targetCategoryId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const reordered = [...visible];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setCategories([...reordered, ...archived]);
    setDraggedCategoryId(null);
  }

  function renderCategoryBlock(category: CategoryItem, muted = false) {
    const categoryThreads = threadsByCategory[category.name] ?? [];
    const isExpanded = expandedCategory === category.name;
    const isActive = activeCategory === category.name;
    const allowMenu = !muted;

    return (
      <div key={category.id} className="category-block">
        <div
          className={`nav-item-row ${isActive ? "nav-item-row-active" : ""} ${muted ? "nav-item-row-muted" : ""}`}
          draggable={!sidebarCollapsed && allowMenu}
          onDragStart={() => allowMenu && handleCategoryDragStart(category.id)}
          onDragEnd={() => setDraggedCategoryId(null)}
          onDragOver={(event) => {
            if (allowMenu) event.preventDefault();
          }}
          onDrop={() => allowMenu && handleCategoryDrop(category.id)}
        >
          <button
            className={`nav-item ${isActive ? "nav-item-active" : ""}`}
            onClick={() => handleCategoryClick(category.name)}
          >
            <span>{getCategoryDot(category.name)}</span>
            <strong>{category.name}</strong>
          </button>

          {!sidebarCollapsed && allowMenu && (
            <div className="category-actions">
              <button
                className="category-menu-trigger"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenMenuCategoryId((current) =>
                    current === category.id ? null : category.id
                  );
                }}
                title="Category options"
              >
                ⋯
              </button>

              {openMenuCategoryId === category.id && (
                <div className="category-menu">
                  <button onClick={() => shareCategory(category.id)}>Share</button>
                  <button onClick={() => renameCategory(category.id)}>Rename</button>
                  <button onClick={() => archiveCategory(category.id)}>
                    {category.archived ? "Unarchive" : "Archive"}
                  </button>
                  <button
                    className="danger-option"
                    onClick={() => confirmDeleteCategory(category.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {!sidebarCollapsed && isExpanded && (
          <div className="category-note-list">
            {categoryThreads.length > 0 ? (
              categoryThreads.map((thread) => (
                <button
                  key={thread.id}
                  className={`category-note-row ${selectedThreadId === thread.id ? "category-note-row-active" : ""}`}
                  onClick={() => {
                    setSelectedThreadId(thread.id);
                    setActiveCategory(category.name);
                  }}
                >
                  <span className="category-note-title">{thread.title}</span>
                  <small>{thread.priority}</small>
                </button>
              ))
            ) : (
              <div className="category-note-empty">No notes yet</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`app-shell ${isFullscreen ? "is-fullscreen" : ""}`}>
      <div
        className="window-drag-region"
        onMouseDown={() => appWindow.startDragging()}
      />

      <div className="mac-window-controls">
        <button className="mac-control close" onClick={closeWindow} title="Close" />
        <button
          className="mac-control minimise"
          onClick={minimiseWindow}
          title="Minimise"
        />
        <button
          className="mac-control maximise"
          onClick={toggleFullscreen}
          title="Fullscreen"
        />
      </div>

      <section className={`noti-workspace ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((current) => !current)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>

        <aside className="side-rail">
          <div className="brand-block">
            <div className="brand-mark">N</div>
            <div className="brand-copy">
              <h1>Noti</h1>
              <p>Productivity OS</p>
            </div>
          </div>

          <nav className="nav-stack">
            <button
              className={`nav-item ${activeCategory === "All" ? "nav-item-active" : ""}`}
              onClick={() => {
                setActiveCategory("All");
                setExpandedCategory(null);
                setOpenMenuCategoryId(null);
              }}
            >
              <span>⌘</span>
              <strong>All Notes</strong>
            </button>

            <div className="nav-group">
              {visibleCategories.map((category) => renderCategoryBlock(category))}
            </div>

            <div className="nav-divider" />

            {renderCategoryBlock({ id: "unassigned", name: "Unassigned" }, true)}

            {!sidebarCollapsed && archivedCategories.length > 0 && (
              <>
                <div className="nav-divider" />
                <div className="archived-heading">Archived</div>
                <div className="nav-group">
                  {archivedCategories.map((category) => renderCategoryBlock(category))}
                </div>
              </>
            )}
          </nav>

          {!sidebarCollapsed && draggedCategoryId && (
            <div
              className="category-delete-zone"
              onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
              onDrop={() => confirmDeleteCategory(draggedCategoryId)}
            >
              Drop here to delete
            </div>
          )}

          <button className="rail-quick-capture" onClick={focusActiveComposer}>
            <span>+</span>
            {!sidebarCollapsed && <strong>Quick capture</strong>}
          </button>
        </aside>

        <main className="agenda-space">
          <section className={`agenda-start ${hasThreads ? "agenda-start-hidden" : ""}`}>
            <p className="eyebrow">Noti workspace</p>
            <h2>What’s on the agenda today?</h2>

            <div className="agenda-input-shell">
              <textarea
                ref={topInputRef}
                className="agenda-input"
                placeholder="Start typing a note..."
                value={topDraft}
                onChange={(event) => setTopDraft(event.target.value)}
                onKeyDown={handleTopInputKeyDown}
                autoFocus
              />

              <div className="agenda-input-footer">
                <span>Press Enter to add note</span>
                <button
                  className="primary-button"
                  onClick={() => createThreadFromDraft(topDraft)}
                >
                  Add Note
                </button>
              </div>
            </div>
          </section>

          <section className={`conversation-flow ${hasThreads ? "conversation-flow-active" : ""}`}>
            {visibleThreads.map((thread) => (
              <article
                key={thread.id}
                className={`note-thread ${selectedThreadId === thread.id ? "note-thread-active" : ""}`}
                onClick={() => setSelectedThreadId(thread.id)}
              >
                {thread.messages.map((message, index) => {
                  const showMetaControls =
                    message.role === "assistant" &&
                    message.kind === "meta_prompt" &&
                    index === 1;

                  return (
                    <div
                      key={message.id}
                      className={`message-row ${
                        message.role === "user" ? "message-user" : "message-noti"
                      }`}
                    >
                      {message.role === "assistant" && <div className="noti-avatar">N</div>}

                      <div
                        className={`message-bubble ${
                          message.role === "user" ? "user-bubble" : "noti-bubble"
                        }`}
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

                            {showMetaControls && (
                              <div className="metadata-grid">
                                <label>
                                  Date
                                  <input
                                    type="date"
                                    value={thread.dueDate}
                                    onChange={(event) =>
                                      updateThreadField(
                                        thread.id,
                                        "dueDate",
                                        event.target.value
                                      )
                                    }
                                  />
                                </label>

                                <label>
                                  Time
                                  <input
                                    type="time"
                                    value={thread.dueTime}
                                    onChange={(event) =>
                                      updateThreadField(
                                        thread.id,
                                        "dueTime",
                                        event.target.value
                                      )
                                    }
                                  />
                                </label>

                                <label>
                                  Priority
                                  <div className="minimal-select-wrap">
                                    <select
                                      value={thread.priority}
                                      onChange={(event) =>
                                        updateThreadField(
                                          thread.id,
                                          "priority",
                                          event.target.value as Priority
                                        )
                                      }
                                    >
                                      {PRIORITIES.map((priority) => (
                                        <option key={priority}>{priority}</option>
                                      ))}
                                    </select>
                                  </div>
                                </label>

                                <label>
                                  Category
                                  <div className="minimal-select-wrap">
                                    <select
                                      value={thread.category}
                                      onChange={(event) =>
                                        updateThreadField(
                                          thread.id,
                                          "category",
                                          event.target.value
                                        )
                                      }
                                    >
                                      {[...visibleCategories.map((item) => item.name), "Unassigned"].map(
                                        (categoryName) => (
                                          <option key={categoryName}>{categoryName}</option>
                                        )
                                      )}
                                    </select>
                                  </div>
                                </label>
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

                <div className="thread-actions">
                  <button onClick={() => appendAssistantMessage(thread.id, "Done.", "ack")}>
                    Mark done
                  </button>

                  <button onClick={() => deleteThread(thread.id)}>Delete</button>
                </div>
              </article>
            ))}
          </section>

          {hasThreads && (
            <section className="bottom-composer">
              <button
                className="composer-icon-button"
                title="New note"
                onClick={() => {
                  setSelectedThreadId(null);
                  bottomInputRef.current?.focus();
                }}
              >
                +
              </button>

              <textarea
                ref={bottomInputRef}
                className="bottom-composer-input"
                placeholder={
                  selectedThread
                    ? "Write more, or add to the selected note..."
                    : "Write more, or add another note..."
                }
                value={bottomDraft}
                onChange={(event) => setBottomDraft(event.target.value)}
                onKeyDown={handleBottomInputKeyDown}
              />

              <button className="composer-icon-button" title="Voice input">
                ◌
              </button>

              <button
                className="composer-send-button"
                onClick={handleBottomSubmit}
                title="Submit"
              >
                ↑
              </button>
            </section>
          )}
        </main>
      </section>
    </div>
  );
}

function getCategoryDot(categoryName: string) {
  switch (categoryName) {
    case "Personal":
      return "●";
    case "Work":
      return "◆";
    case "Projects":
      return "■";
    case "Study":
      return "◐";
    case "Ideas":
      return "✦";
    case "Unassigned":
      return "○";
    default:
      return "●";
  }
}

function getUpdateReply() {
  const replies = ["Updated.", "Noted.", "Saved.", "Added."];
  return replies[Math.floor(Math.random() * replies.length)];
}

export default App;