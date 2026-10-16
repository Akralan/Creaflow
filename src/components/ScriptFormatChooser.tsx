"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Film, Images, Type, type LucideIcon } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type CalendarEntry, type VisualFormatFields } from "@/lib/apiClient";
import { DEFAULT_DURATION_MS, DEFAULT_SLIDES } from "@/lib/visualDesign/visualFormat";
import { accent, accentAlpha, color, fontHeading } from "@/lib/design/tokens";

type VisualChoice = "animation" | "carousel";

const VISUALS: Record<VisualChoice, { label: string; hint: string; icon: LucideIcon; fields: VisualFormatFields }> = {
  animation: {
    label: "Animation",
    hint: "Quelques secondes qui bougent",
    icon: Film,
    fields: { visualFormat: "animation", durationMs: DEFAULT_DURATION_MS },
  },
  carousel: {
    label: "Photo / carrousel",
    hint: "Une image ou des slides",
    icon: Images,
    fields: { visualFormat: "carousel", slideCount: DEFAULT_SLIDES },
  },
};

/**
 * Ce que le choix devient : un seul post. Texte seul → post texte ; un visuel, avec ou sans texte →
 * post visuel dont la légende est un vrai texte rédigé, ou seulement une légende courte.
 */
export function generationRequest(visual: VisualChoice | null, text: boolean) {
  if (!visual) return text ? { contentType: "text" as const, fields: undefined } : null;
  return { contentType: "visual" as const, fields: { ...VISUALS[visual].fields, withText: text } };
}

function ChoiceCard({
  label,
  hint,
  icon: Icon,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  icon: LucideIcon;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "26px 14px 22px",
        borderRadius: 16,
        border: `${selected ? 1.5 : 1}px solid ${selected ? accent : color.border}`,
        background: selected ? accentAlpha(0.07) : color.cardBg,
        boxShadow: selected ? `0 0 0 3px ${accentAlpha(0.08)}` : "none",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        transition: "border-color .2s ease, background .2s ease",
      }}
    >
      {selected && (
        <span
          aria-hidden
          style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: 6, display: "grid", placeItems: "center", background: accent, color: "#fff" }}
        >
          <Check size={13} strokeWidth={3} />
        </span>
      )}
      <span
        style={{ width: 64, height: 64, borderRadius: 18, display: "grid", placeItems: "center", background: accentAlpha(0.1), color: "oklch(0.5 0.2 292)" }}
      >
        <Icon size={30} strokeWidth={1.8} />
      </span>
      <span style={{ fontWeight: 700, fontSize: 15, color: color.text }}>{label}</span>
      <span style={{ fontSize: 12, color: color.textMuted }}>{hint}</span>
    </button>
  );
}

/**
 * Un clic sur un créneau du calendrier : on coche un visuel (animation OU photo/carrousel), du
 * texte, ou les deux — c'est toujours un seul post. « Rédiger » génère et ouvre le script. Le sujet
 * vient de la série du créneau (le serveur en hérite).
 */
export default function ScriptFormatChooser({
  entry,
  onClose,
}: {
  entry: Pick<CalendarEntry, "id" | "series" | "contentCategory"> | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [visual, setVisual] = useState<VisualChoice | null>(null);
  const [text, setText] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = generationRequest(visual, text);

  async function generate() {
    if (!entry || !request || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const { script } = await api.generateScriptForEntry(entry.id, request.contentType, undefined, undefined, request.fields);
      router.push(`/scripts/${script.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "La rédaction a échoué, réessaie.");
      setGenerating(false);
    }
  }

  return (
    <Modal open={entry !== null} onClose={() => !generating && onClose()} width={640}>
      <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 20, margin: "0 0 4px" }}>Quel format ?</h2>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: color.textMuted }}>
        {entry?.series ? entry.series.label : "Post libre"}
        {entry ? ` · ${entry.contentCategory.label}` : ""} — un visuel, du texte, ou les deux dans le même post.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {(Object.keys(VISUALS) as VisualChoice[]).map((key) => (
          <ChoiceCard
            key={key}
            {...VISUALS[key]}
            selected={visual === key}
            disabled={generating}
            // Un seul visuel par post : choisir l'un remplace l'autre, recliquer le retire.
            onClick={() => setVisual((current) => (current === key ? null : key))}
          />
        ))}
        <ChoiceCard label="Texte" hint="Un post écrit" icon={Type} selected={text} disabled={generating} onClick={() => setText((t) => !t)} />
      </div>
      {error && <p style={{ margin: "16px 0 0", fontSize: 13, color: color.danger }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 22 }}>
        {!request && <span style={{ fontSize: 13, color: color.textMuted }}>Choisis au moins un format.</span>}
        <Button onClick={generate} disabled={!request || generating}>
          {generating ? "On rédige ton post…" : "Rédiger"}
        </Button>
      </div>
    </Modal>
  );
}
