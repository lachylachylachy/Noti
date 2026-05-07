import { useEffect, useMemo, useState } from "react";

type Note = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
};

function App() {
  const [notes, setNotes] = useState<Note[]>(() => {
    const savedNotes = localStorage.getItem("noti-notes");
    return savedNotes ? JSON.parse(savedNotes) : [];
  });

  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    localStorage.setItem("noti-notes", JSON.stringify(notes));
  }, [notes]);

  const selectedNote = notes.find((note) => note.id === selectedNoteId);

  function createNewNote() {
    const newNote: Note = {
      id: Date.now(),
      title: "Untitled Note",
      content: "",
      createdAt: new Date().toLocaleString(),
    };

    setNotes([newNote, ...notes]);
    setSelectedNoteId(newNote.id);
  }

  function updateNote(field: "title" | "content", value: string) {
    if (!selectedNote) return;

    setNotes(
      notes.map((note) =>
        note.id === selectedNote.id ? { ...note, [field]: value } : note
      )
    );
  }

  function deleteNote(id: number) {
    const updatedNotes = notes.filter((note) => note.id !== id);

    setNotes(updatedNotes);

    if (selectedNoteId === id) {
      setSelectedNoteId(updatedNotes[0]?.id ?? null);
    }
  }

  const filteredNotes = useMemo(() => {
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [notes, searchQuery]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: "#0f172a",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: "220px",
          borderRight: "1px solid #1e293b",
          padding: "20px",
          backgroundColor: "#111827",
        }}
      >
        <h1 style={{ marginBottom: "40px" }}>Noti</h1>

        <div style={{ opacity: 0.8 }}>
          <p>All Notes</p>
          <p>Personal</p>
          <p>Projects</p>
          <p>Ideas</p>
          <p>Trash</p>
        </div>
      </div>

      {/* Notes List */}
      <div
        style={{
          width: "320px",
          borderRight: "1px solid #1e293b",
          padding: "20px",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "15px",
          }}
        >
          <h2>Notes</h2>

          <button
            onClick={createNewNote}
            style={{
              backgroundColor: "#312e81",
              border: "none",
              color: "white",
              padding: "8px 14px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            + New
          </button>
        </div>

        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "none",
            marginBottom: "20px",
            backgroundColor: "#1e293b",
            color: "white",
          }}
        />

        {filteredNotes.map((note) => (
          <div
            key={note.id}
            onClick={() => setSelectedNoteId(note.id)}
            style={{
              padding: "15px",
              borderRadius: "10px",
              marginBottom: "12px",
              backgroundColor:
                selectedNoteId === note.id ? "#1e293b" : "#111827",
              cursor: "pointer",
            }}
          >
            <strong>{note.title || "Untitled"}</strong>

            <p
              style={{
                fontSize: "13px",
                opacity: 0.7,
                marginTop: "8px",
              }}
            >
              {note.content.slice(0, 60) || "No content"}
            </p>

            <p
              style={{
                fontSize: "11px",
                opacity: 0.5,
                marginTop: "10px",
              }}
            >
              {note.createdAt}
            </p>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div
        style={{
          flex: 1,
          padding: "40px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {selectedNote ? (
          <>
            <input
              value={selectedNote.title}
              onChange={(e) => updateNote("title", e.target.value)}
              placeholder="Note title"
              style={{
                fontSize: "32px",
                fontWeight: "bold",
                marginBottom: "20px",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "white",
              }}
            />

            <textarea
              value={selectedNote.content}
              onChange={(e) => updateNote("content", e.target.value)}
              placeholder="Start writing..."
              style={{
                flex: 1,
                resize: "none",
                backgroundColor: "#111827",
                border: "1px solid #1e293b",
                borderRadius: "12px",
                padding: "20px",
                color: "white",
                fontSize: "16px",
                outline: "none",
              }}
            />

            <button
              onClick={() => deleteNote(selectedNote.id)}
              style={{
                marginTop: "20px",
                alignSelf: "flex-start",
                backgroundColor: "#7f1d1d",
                color: "white",
                border: "none",
                padding: "10px 16px",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Delete Note
            </button>
          </>
        ) : (
          <>
            <h2>No note selected</h2>
            <p>Create a note to begin.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default App;