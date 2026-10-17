"use client";

import { useEffect, useRef, useState } from "react";
import { color } from "@/lib/design/tokens";

// Select-all switch (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A/§7): a selection covering this ratio of the
// edited block + a submitted comment is a gesture of intent ("I want something else"), not an
// edit — the threshold is measured against the content of THIS block, the only candidate consistent with a
// browser selection that cannot extend beyond a single <textarea>.
const SELECT_ALL_RATIO_THRESHOLD = 0.8;

/**
 * Directly editable block of text (docs/SPEC_MATIERE_EDITEUR.md §4.4): `onBlur` persists the
 * value, a non-empty selection shows a free instruction field that replaces
 * only the selected passage (§4.3 — the main gesture validated by the founding test).
 */
export default function EditableField({
  value,
  onSave,
  onApplyInstruction,
  placeholder,
  minRows = 2,
  disabled,
}: {
  value: string;
  onSave: (next: string) => void;
  /** `isMajoritySelection`: selection of ≥80% of the block (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A) — up to
   *  the parent to switch to "new idea" rather than call the selection edit. */
  onApplyInstruction: (selectedText: string, instruction: string, isMajoritySelection: boolean) => Promise<void>;
  placeholder?: string;
  minRows?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [selection, setSelection] = useState<{ text: string; start: number; end: number } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [applying, setApplying] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The component is uncontrolled while typing (local draft) but resyncs if the
  // script changes elsewhere (undo, block regeneration) — avoids overwriting input in progress.
  useEffect(() => {
    if (document.activeElement !== textareaRef.current) {
      setDraft(value);
    }
  }, [value]);

  function handleSelect() {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    if (selectionEnd > selectionStart) {
      setSelection({ text: draft.slice(selectionStart, selectionEnd), start: selectionStart, end: selectionEnd });
    } else {
      setSelection(null);
    }
  }

  async function handleApply() {
    if (!selection || !instruction.trim()) return;
    setApplying(true);
    try {
      const isMajoritySelection = draft.length > 0 && selection.text.length / draft.length >= SELECT_ALL_RATIO_THRESHOLD;
      await onApplyInstruction(selection.text, instruction.trim(), isMajoritySelection);
      setSelection(null);
      setInstruction("");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        rows={minRows}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value && draft.trim()) onSave(draft);
        }}
        onSelect={handleSelect}
        style={{
          width: "100%",
          border: `1px solid ${color.inputBorder}`,
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 14,
          lineHeight: 1.45,
          fontFamily: "inherit",
          background: color.inputBg,
          color: color.text2,
          resize: "vertical",
        }}
      />
      {selection && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 8,
            alignItems: "center",
            background: color.chipBg,
            borderRadius: 10,
            padding: 8,
          }}
        >
          <input
            autoFocus
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApply();
              if (e.key === "Escape") setSelection(null);
            }}
            placeholder={`Rephrase "${selection.text.slice(0, 30)}${selection.text.length > 30 ? "…" : ""}"...`}
            style={{
              flex: 1,
              border: `1px solid ${color.inputBorder}`,
              borderRadius: 8,
              padding: "7px 10px",
              fontSize: 13,
              fontFamily: "inherit",
              background: color.cardBg,
              color: color.text,
            }}
          />
          <button
            onClick={handleApply}
            disabled={applying || !instruction.trim()}
            style={{
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              borderRadius: 8,
              padding: "7px 12px",
              cursor: "pointer",
              background: "oklch(0.55 0.2 292)",
              color: "#fff",
              opacity: applying || !instruction.trim() ? 0.6 : 1,
            }}
          >
            {applying ? "..." : "Apply"}
          </button>
          <button
            onClick={() => setSelection(null)}
            style={{ fontSize: 13, border: "none", background: "none", color: color.textFaint, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
