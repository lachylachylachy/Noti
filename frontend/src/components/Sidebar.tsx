import type { WorkspaceItem, WorkspaceMode } from "../types/workspace";

type SidebarProps = {
  open: boolean;
  activeWorkspace: WorkspaceMode;
  workspaceItems: WorkspaceItem[];
  onClose: () => void;
  onOpenWorkspace: (workspace: WorkspaceMode) => void;
};

export function Sidebar({ open, activeWorkspace, workspaceItems, onClose, onOpenWorkspace }: SidebarProps) {
  return (
    <>
      <aside
        className={`workspace-sidebar ${open ? "workspace-sidebar-open" : ""}`}
        aria-hidden={!open}
      >
        <div className="sidebar-brand-row">
          <button type="button" className="sidebar-logo" onClick={onClose} aria-label="Close sidebar">
            ⌘
          </button>
          <strong>Noti</strong>
        </div>

        <div className="sidebar-search-field" role="search">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search sidebar" placeholder="Search" />
        </div>

        <nav className="sidebar-nav-list" aria-label="Workspace navigation">
          {workspaceItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                activeWorkspace === item.id
                  ? "sidebar-nav-item sidebar-nav-item-active"
                  : "sidebar-nav-item"
              }
              onClick={() => onOpenWorkspace(item.id)}
              aria-current={activeWorkspace === item.id ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pinned-section">
          <span className="pinned-title">Pinned</span>
          <button type="button" className="pinned-item">Greece Trip Plan</button>
          <button type="button" className="pinned-item">Launch Plan</button>
        </div>

        <div className="sidebar-footer-state">
          <span>All changes saved</span>
          <small>Ambient workspace</small>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="sidebar-scrim"
          onClick={onClose}
          aria-label="Close sidebar overlay"
        />
      )}
    </>
  );
}
