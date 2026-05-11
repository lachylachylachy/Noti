import type { KeyboardEvent, RefObject } from "react";
import type { NoteThread, Priority } from "../types/workspace";
import { BottomComposer } from "../components/Composer";
import { CATEGORIES, PRIORITIES, getGreeting } from "../utils/storage";

type NotesWorkspaceProps = {
  draft: string;
  threadDraft: string;
  threads: NoteThread[];
  selectedThread: NoteThread | null;
  selectedThreadId: number | null;
  mainInputRef: RefObject<HTMLTextAreaElement | null>;
  threadInputRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (value: string) => void;
  onThreadDraftChange: (value: string) => void;
  onMainKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onThreadKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCreateThread: (content: string) => void;
  onAppendToThread: () => void;
  onStartNewThread: () => void;
  onSelectThread: (id: number) => void;
  onDeleteThread: (id: number) => void;
  onOpenCalendar: () => void;
  onOpenCode: () => void;
  onCreateReminder: () => void;
  onUpdateThreadField: <K extends keyof NoteThread>(threadId: number, field: K, value: NoteThread[K]) => void;
};

export function NotesWorkspace({
  draft,
  threadDraft,
  threads,
  selectedThread,
  selectedThreadId,
  mainInputRef,
  threadInputRef,
  onDraftChange,
  onThreadDraftChange,
  onMainKeyDown,
  onThreadKeyDown,
  onCreateThread,
  onAppendToThread,
  onStartNewThread,
  onSelectThread,
  onDeleteThread,
  onOpenCalendar,
  onOpenCode,
  onCreateReminder,
  onUpdateThreadField,
}: NotesWorkspaceProps) {
  const recentThreads = [...threads].sort((a, b) => b.id - a.id).slice(0, 4);
  const hasThreads = threads.length > 0;

  return (
    <>
      <main className="workspace-main notes-space">
        <section className={`hero-composer ${hasThreads ? "hero-composer-compact" : ""}`}>
          <h1>{getGreeting()}, Lachy <span /></h1>

          <div className="main-composer-card">
            <textarea
              ref={mainInputRef}
              className="main-composer-input"
              placeholder="What’s on your mind?"
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={onMainKeyDown}
              aria-label="Create a new note"
            />

            <div className="composer-action-row">
              <button type="button" onClick={() => onCreateThread(draft)}>▣ Note</button>
              <button type="button" onClick={() => onCreateThread(draft || "New task")}>□ Task</button>
              <button type="button" onClick={onCreateReminder}>◴ Reminder</button>
              <button type="button" onClick={onOpenCalendar}>▦ Calendar</button>
              <button type="button" onClick={onOpenCode}>⌘ Code Space</button>
            </div>
          </div>
        </section>

        {selectedThread && (
          <section className="thread-layer">
            {selectedThread.messages.map((message, index) => {
              const showMetaControls =
                message.role === "assistant" &&
                message.kind === "meta_prompt" &&
                index === 1;

              return (
                <div
                  key={message.id}
                  className={`message-row ${message.role === "user" ? "message-user" : "message-noti"}`}
                >
                  {message.role === "assistant" && <div className="noti-avatar">N</div>}

                  <div className={`message-bubble ${message.role === "user" ? "user-bubble" : "noti-bubble"}`}>
                    {message.role === "assistant" ? (
                      <>
                        {message.typing ? (
                          <div className="typing-line">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </div>
                        ) : (
                          <div className="assistant-copy"><strong>{message.text}</strong></div>
                        )}

                        {showMetaControls && (
                          <div className="metadata-grid">
                            <label>
                              Date
                              <input
                                type="date"
                                aria-label="Note due date"
                                value={selectedThread.dueDate}
                                onChange={(event) =>
                                  onUpdateThreadField(selectedThread.id, "dueDate", event.target.value)
                                }
                              />
                            </label>

                            <label>
                              Time
                              <input
                                type="time"
                                aria-label="Note due time"
                                value={selectedThread.dueTime}
                                onChange={(event) =>
                                  onUpdateThreadField(selectedThread.id, "dueTime", event.target.value)
                                }
                              />
                            </label>

                            <label>
                              Priority
                              <div className="minimal-select-wrap">
                                <select
                                  value={selectedThread.priority}
                                  aria-label="Note priority"
                                  onChange={(event) =>
                                    onUpdateThreadField(selectedThread.id, "priority", event.target.value as Priority)
                                  }
                                >
                                  {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
                                </select>
                              </div>
                            </label>

                            <label>
                              Category
                              <div className="minimal-select-wrap">
                                <select
                                  value={selectedThread.category}
                                  aria-label="Note category"
                                  onChange={(event) =>
                                    onUpdateThreadField(selectedThread.id, "category", event.target.value)
                                  }
                                >
                                  {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                                </select>
                              </div>
                            </label>
                          </div>
                        )}
                      </>
                    ) : message.text}
                  </div>
                </div>
              );
            })}
            <div className="selected-thread-actions">
              <button
                type="button"
                className="selected-thread-danger"
                onClick={() => onDeleteThread(selectedThread.id)}
              >
                Delete note
              </button>
            </div>
          </section>
        )}

        <section className="recent-section">
          <div className="recent-header">Recent threads</div>
          <div className="recent-grid">
            {recentThreads.map((thread) => (
              <article
                key={thread.id}
                className={`recent-thread-card-shell ${selectedThreadId === thread.id ? "recent-thread-card-active" : ""}`}
              >
                <button
                  type="button"
                  className="recent-thread-card-main"
                  onClick={() => onSelectThread(thread.id)}
                  aria-label={`Open note: ${thread.title}`}
                >
                  <strong>{thread.category}</strong>
                  <p>{thread.title}</p>
                  <small>Edited recently <span className="thread-category-dot">●</span></small>
                </button>

                <button
                  type="button"
                  className="recent-thread-delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteThread(thread.id);
                  }}
                  aria-label={`Delete note: ${thread.title}`}
                  title="Delete note"
                >
                  ×
                </button>
              </article>
            ))}

            <button type="button" className="new-thread-card" onClick={onStartNewThread} aria-label="Start a new thread">
              <span>+</span>
              <p>New thread</p>
            </button>
          </div>
        </section>
      </main>

      {hasThreads && (
        <BottomComposer
          inputRef={threadInputRef}
          value={threadDraft}
          placeholder={
            selectedThread
              ? "Write more, or add to the selected note..."
              : "Ask anything or capture a thought..."
          }
          onChange={onThreadDraftChange}
          onKeyDown={onThreadKeyDown}
          onSubmit={onAppendToThread}
          onNew={onStartNewThread}
        />
      )}
    </>
  );
}
