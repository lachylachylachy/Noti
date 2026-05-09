import { ProfileMenu } from "./ProfileMenu";

type TopbarProps = {
  searchOpen: boolean;
  profileOpen: boolean;
  onToggleSidebar: () => void;
  onToggleSearch: () => void;
  onToggleProfile: () => void;
  onNewNote: () => void;
  onMinimise: () => void;
  onFullscreen: () => void;
  onClose: () => void;
};

export function Topbar({
  searchOpen,
  profileOpen,
  onToggleSidebar,
  onToggleSearch,
  onToggleProfile,
  onNewNote,
  onMinimise,
  onFullscreen,
  onClose,
}: TopbarProps) {
  return (
    <header className="workspace-topbar">
      <div className="workspace-brand">
        <button
          type="button"
          className="workspace-logo"
          onClick={onToggleSidebar}
          aria-label="Open Noti sidebar"
          title="Open sidebar"
        >
          ⌘
        </button>
        <span>Noti</span>
      </div>

      {searchOpen && (
        <div className="topbar-search-panel" role="search">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search Noti" placeholder="Search notes, reminders, code..." autoFocus />
        </div>
      )}

      <div className="workspace-actions">
        <button
          type="button"
          className="topbar-icon-button"
          onClick={onToggleSearch}
          aria-label={searchOpen ? "Close search" : "Open search"}
          aria-pressed={searchOpen}
          title="Search"
        >
          ⌕
        </button>

        <ProfileMenu profileOpen={profileOpen} onToggle={onToggleProfile} />

        <button type="button" className="new-note-button" onClick={onNewNote}>
          + New
        </button>

        <div className="window-controls-inline" aria-label="Window controls">
          <button type="button" onClick={onMinimise} aria-label="Minimise window" title="Minimise">
            —
          </button>
          <button type="button" onClick={onFullscreen} aria-label="Toggle fullscreen" title="Fullscreen">
            □
          </button>
          <button type="button" onClick={onClose} aria-label="Close window" title="Close">
            ×
          </button>
        </div>
      </div>
    </header>
  );
}
