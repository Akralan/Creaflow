"use client";

import Link from "next/link";
import { useContentCategories } from "@/contexts/CategoryLabelsContext";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";
import { color } from "@/lib/design/tokens";

/**
 * Mix éditorial en lecture seule (docs/SPEC_SERIES_ET_ROLES.md §5.1) : la part de chaque rôle dans
 * le calendrier. Le poids des rôles sort du parcours principal — il évolue par l'IA à l'onboarding,
 * les propositions de rééquilibrage à partir des métriques, et l'assistant ; l'édition manuelle
 * reste possible dans Paramètres › Avancé.
 */
export default function EditorialMixStrip() {
  const categories = useContentCategories();
  const active = categories.filter((c) => !c.archived);
  if (active.length === 0) return null;

  const total = active.reduce((sum, c) => sum + c.weight, 0) || 1;
  const parts = active
    .map((c) => ({ ...resolveCategoryMeta(c), id: c.id, share: c.weight / total }))
    .sort((a, b) => b.share - a.share);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Mix éditorial</div>
        <Link href="/settings?tab=categories" style={{ fontSize: 12, color: color.textMuted, textDecoration: "underline" }}>
          Régler manuellement
        </Link>
      </div>
      <div
        role="img"
        aria-label={parts.map((p) => `${p.label} ${Math.round(p.share * 100)} %`).join(", ")}
        style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: color.inputBg }}
      >
        {parts.map((p) => (
          <div key={p.id} title={`${p.label} · ${Math.round(p.share * 100)} %`} style={{ width: `${p.share * 100}%`, background: p.fg }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8 }}>
        {parts.map((p) => (
          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: color.text2 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: p.fg, display: "inline-block" }} />
            {p.label}
            <span style={{ color: color.textMuted }}>{Math.round(p.share * 100)} %</span>
          </span>
        ))}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: color.textMuted }}>
        Les posts libres (hors série) sont répartis entre ces rôles. Ce mix évolue à partir de tes performances.
      </p>
    </div>
  );
}
