"use client";

import { useEffect, useRef, useState } from "react";
import { color } from "@/lib/design/tokens";

// Bascule select-all (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A/§7) : une sélection couvrant ce ratio du
// bloc édité + un commentaire soumis est un geste d'intention ("je veux autre chose"), pas une
// retouche — le seuil se mesure par rapport au contenu de CE bloc, seul candidat cohérent avec une
// sélection navigateur qui ne peut pas dépasser un unique <textarea>.
const SELECT_ALL_RATIO_THRESHOLD = 0.8;

/**
 * Bloc de texte directement éditable (docs/SPEC_MATIERE_EDITEUR.md §4.4) : `onBlur` persiste la
 * valeur, une sélection non vide fait apparaître un champ d'instruction libre qui remplace
 * uniquement le passage sélectionné (§4.3 — le geste principal validé par le test fondateur).
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
  /** `isMajoritySelection` : sélection ≥80% du bloc (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A) — au
   *  parent de basculer vers "nouvelle idée" plutôt que d'appeler la retouche par sélection. */
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

  // Le composant est non-contrôlé pendant la frappe (draft local) mais se resynchronise si le
  // script change ailleurs (undo, régénération de bloc) — évite d'écraser une saisie en cours.
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
            placeholder={`Reformule « ${selection.text.slice(0, 30)}${selection.text.length > 30 ? "…" : ""} »...`}
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
            {applying ? "..." : "Appliquer"}
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
