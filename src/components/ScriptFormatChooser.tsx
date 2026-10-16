"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Images, Type, type LucideIcon } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { api, ApiClientError, type CalendarEntry, type ContentType, type VisualFormatFields } from "@/lib/apiClient";
import { DEFAULT_DURATION_MS, DEFAULT_SLIDES } from "@/lib/visualDesign/visualFormat";
import { accent, accentAlpha, color, fontHeading } from "@/lib/design/tokens";

interface FormatChoice {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  contentType: ContentType;
  visual?: VisualFormatFields;
}

const CHOICES: FormatChoice[] = [
  {
    id: "animation",
    label: "Animation",
    hint: "Quelques secondes qui bougent",
    icon: Film,
    contentType: "visual",
    visual: { visualFormat: "animation", durationMs: DEFAULT_DURATION_MS },
  },
  {
    id: "carousel",
    label: "Photo / carrousel",
    hint: "Une image ou des slides",
    icon: Images,
    contentType: "visual",
    visual: { visualFormat: "carousel", slideCount: DEFAULT_SLIDES },
  },
  { id: "text", label: "Texte", hint: "Un post écrit", icon: Type, contentType: "text" },
];

/**
 * Un clic sur un créneau du calendrier : trois formats, un clic, le script est rédigé et s'ouvre.
 * Le sujet vient de la série du créneau (le serveur en hérite) — rien d'autre à choisir.
 */
export default function ScriptFormatChooser({ entry, onClose }: { entry: CalendarEntry | null; onClose: () => void }) {
  const router = useRouter();
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(choice: FormatChoice) {
    if (!entry || generating) return;
    setGenerating(choice.id);
    setError(null);
    try {
      const { script } = await api.generateScriptForEntry(entry.id, choice.contentType, undefined, undefined, choice.visual);
      router.push(`/scripts/${script.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "La rédaction a échoué, réessaie.");
      setGenerating(null);
    }
  }

  return (
    <Modal open={entry !== null} onClose={() => !generating && onClose()} width={620}>
      <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 20, margin: "0 0 4px" }}>
        {generating ? "On rédige ton post…" : "Quel format ?"}
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: color.textMuted }}>
        {entry?.series ? entry.series.label : "Post libre"}
        {entry ? ` · ${entry.contentCategory.label}` : ""}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {CHOICES.map((choice) => {
          const active = generating === choice.id;
          const Icon = choice.icon;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => choose(choice)}
              disabled={generating !== null}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "26px 14px 22px",
                borderRadius: 16,
                border: `${active ? 1.5 : 1}px solid ${active ? accent : color.border}`,
                background: active ? accentAlpha(0.07) : color.cardBg,
                opacity: generating && !active ? 0.45 : 1,
                cursor: generating ? "default" : "pointer",
                fontFamily: "inherit",
                transition: "border-color .2s ease, opacity .2s ease",
              }}
            >
              <span
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  display: "grid",
                  placeItems: "center",
                  background: accentAlpha(0.1),
                  color: "oklch(0.5 0.2 292)",
                  animation: active ? "cf-format-pulse 1.2s ease-in-out infinite" : undefined,
                }}
              >
                <Icon size={30} strokeWidth={1.8} />
              </span>
              <span style={{ fontWeight: 700, fontSize: 15, color: color.text }}>{choice.label}</span>
              <span style={{ fontSize: 12, color: color.textMuted }}>{active ? "Rédaction en cours…" : choice.hint}</span>
            </button>
          );
        })}
      </div>
      <style>{"@keyframes cf-format-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}"}</style>
      {error && <p style={{ margin: "16px 0 0", fontSize: 13, color: color.danger }}>{error}</p>}
    </Modal>
  );
}
