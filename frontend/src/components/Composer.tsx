import type { KeyboardEvent, RefObject } from "react";

type ComposerProps = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onNew: () => void;
};

export function BottomComposer({ inputRef, value, placeholder, onChange, onKeyDown, onSubmit, onNew }: ComposerProps) {
  return (
    <section className="bottom-composer floating-bottom-composer" aria-label="Note composer">
      <button type="button" className="composer-icon-button" onClick={onNew} aria-label="Start new note" title="New note">
        +
      </button>
      <textarea
        ref={inputRef}
        className="bottom-composer-input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Write note"
      />
      <button type="button" className="composer-icon-button" aria-label="Voice input" title="Voice input">
        ◌
      </button>
      <button type="button" className="composer-send-button" onClick={onSubmit} aria-label="Send note" title="Send">
        ➤
      </button>
    </section>
  );
}
