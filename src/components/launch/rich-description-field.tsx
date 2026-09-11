"use client";

import { useRef, useState, type KeyboardEvent } from "react";

const MAX_LENGTH = 500;

const EMOJI_SET = [
  "🚀", "🌙", "🔥", "💎", "🙌", "⚡", "🦍", "📈", "💰", "🎉",
  "🧊", "🌊", "🥇", "🏆", "🤝", "👀", "😂", "🫡", "🎯", "🌱",
] as const;

const TOOL =
  "grid size-8 cursor-pointer place-items-center border border-rule bg-raised font-bold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Rich text description field: bold/italic/underline via markdown-style
 * wrapping, an emoji picker, and a 0/500 character counter. v1 stores plain
 * text (with markers) — the backend will receive it verbatim.
 */
export function RichDescriptionField({
  value,
  onChange,
  invalid,
  id = "launch-description",
}: {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  id?: string;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  function wrapSelection(marker: string) {
    const area = areaRef.current;
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    if (start === end) return;
    const selected = value.slice(start, end);
    const already = value.slice(start - marker.length, start) === marker;
    const next = already
      ? value.slice(0, start - marker.length) +
        selected +
        value.slice(end + marker.length)
      : value.slice(0, start) +
        marker +
        selected +
        marker +
        value.slice(end);
    if (next.length > MAX_LENGTH) return;
    onChange(next);
    window.requestAnimationFrame(() => {
      area.focus();
      const offset = already ? -marker.length : marker.length;
      area.setSelectionRange(start + offset, end + offset);
    });
  }

  function insertEmoji(emoji: string) {
    const area = areaRef.current;
    const next = value + emoji;
    if (next.length > MAX_LENGTH) return;
    onChange(next);
    setEmojiOpen(false);
    window.requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(next.length, next.length);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      wrapSelection("**");
    } else if (key === "i") {
      event.preventDefault();
      wrapSelection("*");
    } else if (key === "u") {
      event.preventDefault();
      wrapSelection("__");
    }
  }

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-bold">
        Description <span className="text-error">*</span>
      </span>
      <div
        className="grid overflow-hidden rounded-lg border border-rule bg-raised focus-within:border-ink aria-invalid:border-2 aria-invalid:border-error"
        aria-invalid={invalid || undefined}
      >
        <div
          className="flex items-center gap-1.5 border-b border-rule bg-raised px-2 py-1.5"
          role="toolbar"
          aria-label="Text formatting"
        >
          <button
            aria-label="Bold"
            className={`${TOOL} font-black italic-0`}
            type="button"
            onClick={() => wrapSelection("**")}
          >
            B
          </button>
          <button
            aria-label="Italic"
            className={`${TOOL} italic`}
            type="button"
            onClick={() => wrapSelection("*")}
          >
            I
          </button>
          <button
            aria-label="Underline"
            className={`${TOOL} underline`}
            type="button"
            onClick={() => wrapSelection("__")}
          >
            U
          </button>
          <div className="relative ml-auto">
            <button
              aria-expanded={emojiOpen}
              aria-label="Insert emoji"
              className={TOOL}
              type="button"
              onClick={() => setEmojiOpen((open) => !open)}
            >
              🙂
            </button>
            {emojiOpen ? (
              <div
                className="absolute right-0 z-30 mt-1 grid w-56 grid-cols-6 gap-1 rounded-lg border-2 border-ink bg-paper p-2 shadow-lg"
                role="dialog"
                aria-label="Emoji picker"
              >
                {EMOJI_SET.map((emoji) => (
                  <button
                    className="grid size-8 cursor-pointer place-items-center rounded border-0 bg-transparent text-lg hover:bg-raised"
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <textarea
          aria-describedby={`${id}-counter`}
          className="min-h-24 w-full resize-y border-0 bg-raised px-3 py-2.5 text-ink outline-none"
          id={id}
          maxLength={MAX_LENGTH}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your token here..."
          ref={areaRef}
          rows={4}
          value={value}
        />
        <div className="flex justify-end border-t border-rule bg-raised px-3 py-1.5">
          <span
            className="font-mono text-xs text-ink-muted"
            id={`${id}-counter`}
          >
            {value.length} / {MAX_LENGTH} characters
          </span>
        </div>
      </div>
    </div>
  );
}

export default RichDescriptionField;
