import { PlatformBadge, CategoryPill } from "@/components/ui/Badge";
import type { Script } from "@/lib/apiClient";
import { color, platformMeta } from "@/lib/design/tokens";

const CONTENT_TYPE_LABEL: Record<string, string> = { video: "Vidéo", visual: "Visuel", text: "Texte" };

/**
 * Le brief du créneau — plateforme, catégorie, angle imposé, série — en en-tête visible du document
 * (docs/SPEC_MATIERE_EDITEUR.md §4.2), lecture seule : catégorie et angle ne sont volontairement pas
 * modifiables depuis l'éditeur, c'est ce qui rend la liberté d'aval compatible avec l'anti-répétition.
 */
export default function BriefHeader({ script }: { script: Script }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          background: "#1c1917",
          color: "#fff",
          borderRadius: 20,
          padding: "5px 12px",
        }}
      >
        <PlatformBadge platform={script.platform} size={16} />
        {platformMeta[script.platform].label}
      </span>
      <CategoryPill category={script.contentCategory} />
      {script.angle && (
        <span
          title={script.angle.description}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "oklch(0.5 0.14 60)",
            background: "oklch(0.6 0.14 60 / 0.12)",
            borderRadius: 20,
            padding: "5px 12px",
          }}
        >
          ↝ {script.angle.label}
        </span>
      )}
      {script.series && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "oklch(0.47 0.2 292)",
            background: "oklch(0.55 0.2 292 / 0.1)",
            borderRadius: 20,
            padding: "6px 12px",
          }}
        >
          ◈ {script.series.label}
        </span>
      )}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: color.textMuted,
          background: color.chipBg,
          borderRadius: 20,
          padding: "5px 12px",
        }}
      >
        {CONTENT_TYPE_LABEL[script.contentType] ?? script.contentType}
      </span>
    </div>
  );
}
