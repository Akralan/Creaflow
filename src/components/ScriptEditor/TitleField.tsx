"use client";

import { useEffect, useRef, useState } from "react";
import { color, fontHeading } from "@/lib/design/tokens";

/**
 * Titre du script — brouillon local, comme EditableField et MaterialSummaryField.
 *
 * La saisie ne doit PAS écrire directement dans l'objet `script` du parent : la valeur persistée est
 * la seule référence permettant de savoir, au blur, si quelque chose a réellement changé. Quand le
 * parent portait lui-même la frappe, cette référence était écrasée à chaque caractère et la garde
 * anti-écriture-inutile comparait la saisie à elle-même — le titre d'un script fraîchement ouvert
 * n'était alors jamais enregistré.
 *
 * Même garde de resynchronisation que les autres champs : ne jamais écraser une frappe en cours si
 * la valeur change ailleurs (undo, régénération, autre session).
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
      placeholder="(sans titre)"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        // Un titre vidé n'efface pas le titre persisté (la colonne est nullable mais le geste est
        // presque toujours accidentel) — on restaure simplement l'affichage.
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
        fontSize: 32,
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
