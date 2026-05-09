type ProfileMenuProps = {
  profileOpen: boolean;
  onToggle: () => void;
};

export function ProfileMenu({ profileOpen, onToggle }: ProfileMenuProps) {
  return (
    <div className="profile-wrapper">
      <button
        type="button"
        className="profile-button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={profileOpen}
        aria-label="Open profile menu"
        title="Profile"
      >
        LB
      </button>

      <div
        className={`profile-dropdown ${profileOpen ? "profile-dropdown-open" : ""}`}
        role="menu"
        aria-hidden={!profileOpen}
      >
        <div className="profile-header">
          <div className="profile-avatar" aria-hidden="true">LB</div>
          <div>
            <strong>Lachy Beasley</strong>
            <p>Noti Workspace</p>
          </div>
        </div>

        <button type="button" role="menuitem">Profile</button>
        <button type="button" role="menuitem">Settings</button>
        <button type="button" role="menuitem">Appearance</button>
        <button type="button" role="menuitem">Help</button>
        <button type="button" role="menuitem" className="danger-option">Log out</button>
      </div>
    </div>
  );
}
