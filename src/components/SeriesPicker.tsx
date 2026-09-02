"use client";

import type { OnboardingSeriesProposal } from "@/lib/apiClient";
import { accent, accentAlpha, color } from "@/lib/design/tokens";

const MODE_LABELS: Record<OnboardingSeriesProposal["mode"], string> = {
  feuilleton: "Feuilleton",
  rendez_vous: "Rendez-vous",
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: 12,
        background: color.chipBg,
        color: color.textMuted,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** Fin d'onboarding : les séries générées s'affichent en cartes cochables — l'utilisateur choisit
 *  celles qu'il garde avant de continuer, au lieu de subir une direction éditoriale imposée. */
export default function SeriesPicker({
  series,
  selectedIds,
  onToggle,
}: {
  series: OnboardingSeriesProposal[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ margin: "2px 0 4px", fontSize: 13, color: color.textMuted, lineHeight: 1.45 }}>
        Voici les séries que j&apos;ai imaginées pour ta ligne éditoriale — elles guideront ton calendrier et la
        génération de contenu. Décoche celles qui ne te parlent pas : seules les séries gardées seront créées.
      </p>
      {series.map((s) => {
        const selected = selectedIds.has(s.id);
        return (
          <button
            key={s.id}
            onClick={() => onToggle(s.id)}
            aria-pressed={selected}
            style={{
              textAlign: "left",
              fontFamily: "inherit",
              cursor: "pointer",
              borderRadius: 12,
              padding: "12px 14px",
              border: selected ? `1.5px solid ${accent}` : `1.5px solid ${color.border}`,
              background: selected ? accentAlpha(0.06) : color.cardBg,
              opacity: selected ? 1 : 0.65,
              transition: "border-color .12s, background .12s, opacity .12s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  background: selected ? accent : "transparent",
                  border: selected ? "none" : `1.5px solid ${color.inputBorder}`,
                }}
              >
                {selected ? "✓" : ""}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: color.text2, flex: 1 }}>{s.label}</span>
              {s.categoryLabel && <Chip>{s.categoryLabel}</Chip>}
              <Chip>{MODE_LABELS[s.mode]}</Chip>
            </div>
            <p style={{ margin: "0 0 0 26px", fontSize: 13, color: color.textMuted, lineHeight: 1.4 }}>
              {s.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
