import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { NotesWorkspace } from "./workspaces/NotesWorkspace";
import { CalendarWorkspace } from "./workspaces/CalendarWorkspace";
import { RemindersWorkspace } from "./workspaces/RemindersWorkspace";
import { CodeWorkspace } from "./workspaces/CodeWorkspace";
import { ProjectsWorkspace } from "./workspaces/ProjectsWorkspace";
import { ArchiveWorkspace } from "./workspaces/ArchiveWorkspace";

import type { NoteThread, Reminder, WorkspaceItem, WorkspaceMode } from "./types/workspace";
import {
  REMINDERS_STORAGE_KEY,
  THREADS_STORAGE_KEY,
  createMessage,
  getUpdateReply,
  normaliseThread,
  seededReminders,
} from "./utils/storage";

import "./styles/layout.css";
import "./styles/topbar.css";
import "./styles/sidebar.css";
import "./styles/workspaces.css";

const workspaceItems: WorkspaceItem[] = [
  { id: "notes", label: "Today", icon: "◌" },
  { id: "projects", label: "Inbox", icon: "□" },
  { id: "calendar", label: "Calendar", icon: "▦" },
  { id: "reminders", label: "Reminders", icon: "☑" },
  { id: "code", label: "Code", icon: "⌘" },
  { id: "archive", label: "Archive", icon: "◇" },
];

function App() {
  const appWindow = getCurrentWindow();
  const mainInputRef = useRef<HTMLTextAreaElement | null>(null);
  const threadInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceMode>("notes");

  const [draft, setDraft] = useState("");
  const [threadDraft, setThreadDraft] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [selectedReminderId, setSelectedReminderId] = useState<number | null>(null);
  const [reminderPanelOpen, setReminderPanelOpen] = useState(false);

  const [threads, setThreads] = useState<NoteThread[]>(() => {
    try {
      const saved = localStorage.getItem(THREADS_STORAGE_KEY);
      return saved ? JSON.parse(saved).map(normaliseThread) : [];
    } catch {
      return [];
    }
  });

  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const saved = localStorage.getItem(REMINDERS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : seededReminders;
    } catch {
      return seededReminders;
    }
  });

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const selectedReminder = reminders.find((reminder) => reminder.id === selectedReminderId) ?? null;

  useEffect(() => {
    localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

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

  function updateThread(threadId: number, updater: (thread: NoteThread) => NoteThread) {
    setThreads((current) =>
      current.map((thread) => (thread.id === threadId ? updater(thread) : thread))
    );
  }

  function finishTyping(threadId: number, messageId: string) {
    window.setTimeout(() => {
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) =>
          message.id === messageId ? { ...message, typing: false } : message
        ),
      }));
    }, 650);
  }

  function addAssistantMessage(threadId: number, text: string) {
    const assistant = createMessage("assistant", text, "ack", true);

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

    setThreads((current) => [newThread, ...current]);
    setSelectedThreadId(threadId);
    setDraft("");
    setThreadDraft("");
    finishTyping(threadId, assistantMessage.id);

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
    const assistantMessage = createMessage("assistant", getUpdateReply(), "ack", true);

    updateThread(selectedThread.id, (thread) => ({
      ...thread,
      updatedAt: new Date().toLocaleString(),
      messages: [...thread.messages, userMessage, assistantMessage],
    }));

    setThreadDraft("");
    finishTyping(selectedThread.id, assistantMessage.id);
  }

  function updateThreadField<K extends keyof NoteThread>(threadId: number, field: K, value: NoteThread[K]) {
    updateThread(threadId, (thread) => ({
      ...thread,
      [field]: value,
      updatedAt: new Date().toLocaleString(),
    }));

    addAssistantMessage(threadId, getUpdateReply());
  }

  function startNewThread() {
    setActiveWorkspace("notes");
    setSelectedThreadId(null);
    setDraft("");
    setThreadDraft("");

    requestAnimationFrame(() => {
      if (threads.length > 0) {
        threadInputRef.current?.focus();
      } else {
        mainInputRef.current?.focus();
      }
    });
  }

  function deleteThread(threadId: number) {
    const threadToDelete = threads.find((thread) => thread.id === threadId);
    const confirmed = window.confirm(
      threadToDelete
        ? `Delete "${threadToDelete.title}"? This cannot be undone.`
        : "Delete this note? This cannot be undone."
    );

    if (!confirmed) return;

    setThreads((current) => current.filter((thread) => thread.id !== threadId));

    if (selectedThreadId === threadId) {
      setSelectedThreadId(null);
    }
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

  function createReminder() {
    const newReminder: Reminder = {
      id: Date.now(),
      title: "New reminder",
      date: "",
      time: "",
      notes: "",
      completed: false,
    };

    setReminders((current) => [newReminder, ...current]);
    setSelectedReminderId(newReminder.id);
    setReminderPanelOpen(true);
    setActiveWorkspace("reminders");
  }

  function updateReminder(id: number, update: Partial<Reminder>) {
    setReminders((current) =>
      current.map((reminder) => (reminder.id === id ? { ...reminder, ...update } : reminder))
    );
  }

  function openWorkspace(workspace: WorkspaceMode) {
    setActiveWorkspace(workspace);
    setSidebarOpen(false);
  }

  return (
    <div className={`app-shell ${isFullscreen ? "is-fullscreen" : ""}`}>
      <div className="floating-stage">
        <Sidebar
          open={sidebarOpen}
          activeWorkspace={activeWorkspace}
          workspaceItems={workspaceItems}
          onClose={() => setSidebarOpen(false)}
          onOpenWorkspace={openWorkspace}
        />

        <section className="workspace-card">
          <Topbar
            searchOpen={searchOpen}
            profileOpen={profileOpen}
            onToggleSidebar={() => setSidebarOpen((current) => !current)}
            onToggleSearch={() => setSearchOpen((current) => !current)}
            onToggleProfile={() => setProfileOpen((current) => !current)}
            onNewNote={startNewThread}
            onMinimise={minimiseWindow}
            onFullscreen={toggleFullscreen}
            onClose={closeWindow}
          />

          {activeWorkspace === "notes" && (
            <NotesWorkspace
              draft={draft}
              threadDraft={threadDraft}
              threads={threads}
              selectedThread={selectedThread}
              selectedThreadId={selectedThreadId}
              mainInputRef={mainInputRef}
              threadInputRef={threadInputRef}
              onDraftChange={setDraft}
              onThreadDraftChange={setThreadDraft}
              onMainKeyDown={handleMainKeyDown}
              onThreadKeyDown={handleThreadKeyDown}
              onCreateThread={createThread}
              onAppendToThread={appendToSelectedThread}
              onStartNewThread={startNewThread}
              onSelectThread={setSelectedThreadId}
              onDeleteThread={deleteThread}
              onOpenCalendar={() => setActiveWorkspace("calendar")}
              onOpenCode={() => setActiveWorkspace("code")}
              onCreateReminder={createReminder}
              onUpdateThreadField={updateThreadField}
            />
          )}

          {activeWorkspace === "calendar" && <CalendarWorkspace />}

          {activeWorkspace === "reminders" && (
            <RemindersWorkspace
              reminders={reminders}
              selectedReminder={selectedReminder}
              reminderPanelOpen={reminderPanelOpen}
              onCreateReminder={createReminder}
              onSelectReminder={(reminder) => {
                setSelectedReminderId(reminder.id);
                setReminderPanelOpen(true);
              }}
              onClosePanel={() => setReminderPanelOpen(false)}
              onUpdateReminder={updateReminder}
            />
          )}

          {activeWorkspace === "code" && <CodeWorkspace />}
          {activeWorkspace === "projects" && <ProjectsWorkspace />}
          {activeWorkspace === "archive" && <ArchiveWorkspace />}
        </section>
      </div>
    </div>
  );
}

export default App;
