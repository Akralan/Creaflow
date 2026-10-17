"use client";

import { useEffect, useRef, useState } from "react";
import { color, fontHeading } from "@/lib/design/tokens";

/**
 * Script title — local draft, like EditableField and MaterialSummaryField.
 *
 * Typing must NOT write directly into the parent's `script` object: the persisted value is
 * the only reference that tells us, on blur, whether anything actually changed. When the
 * parent carried the typing itself, that reference was overwritten on every character and the
 * unnecessary-write guard compared the input to itself — the title of a freshly opened script
 * was then never saved.
 *
 * Same resync guard as the other fields: never overwrite typing in progress if
 * the value changes elsewhere (undo, regeneration, another session).
 */
export default function TitleField({
  title,
  onSave,
}: {
  title: string | null;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(title ?? "");
  }, [title]);

  return (
    <input
      ref={inputRef}
      value={draft}
      placeholder="(untitled)"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        // An emptied title does not erase the persisted title (the column is nullable but the gesture is
        // almost always accidental) — we simply restore the display.
        if (!trimmed) {
          setDraft(title ?? "");
          return;
        }
        if (trimmed === (title ?? "")) return;
        onSave(trimmed);
      }}
      style={{
        width: "100%",
        fontFamily: fontHeading,
        fontWeight: 700,
        fontSize: "clamp(1.45rem, 2.6vw, 2.1rem)",
        textOverflow: "ellipsis",
        letterSpacing: "-0.025em",
        lineHeight: 1.1,
        border: "none",
        outline: "none",
        background: "none",
        color: color.text,
        padding: 0,
      }}
    />
  );
}
