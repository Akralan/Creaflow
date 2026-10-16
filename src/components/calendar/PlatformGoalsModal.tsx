"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import PlatformLogo from "@/components/calendar/PlatformLogo";
import { api, ApiClientError, type PostingGoal } from "@/lib/apiClient";
import { color, fontHeading, platformMeta } from "@/lib/design/tokens";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

/**
 * L'objectif de la semaine, derrière une icône : les réseaux actifs (un post par jour de
 * publication sur chacun) et l'avancement de la semaine affichée. On active ou coupe un réseau ;
 * le rythme se règle par les jours, dans les paramètres.
 */
export default function PlatformGoalsModal({
  goals,
  publishedThisWeek,
  onClose,
  onSaved,
}: {
  goals: PostingGoal[];
  publishedThisWeek: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(KNOWN_PLATFORMS.map((p) => [p.key, (goals.find((g) => g.platform === p.key)?.targetCountPerWeek ?? 0) > 0]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await Promise.all(KNOWN_PLATFORMS.map((p) => api.savePostingGoal(p.key, drafts[p.key])));
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Enregistrement impossible.");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={() => !saving && onClose()} width={440}>
      <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 20, margin: "0 0 4px" }}>Objectif de la semaine</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: color.textMuted }}>
        Un post par jour de publication, sur chaque réseau actif. Les jours se changent dans les paramètres.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {KNOWN_PLATFORMS.map(({ key, label }) => {
          const active = drafts[key];
          const goal = goals.find((g) => g.platform === key);
          const target = goal?.targetCountPerWeek ?? 0;
          const done = publishedThisWeek[key] ?? 0;
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <PlatformLogo platform={key} size={20} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</span>
              {active && target > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: color.textSecondary }}>
                  {done}/{target} publiés
                </span>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={active}
                aria-label={`${label} : ${active ? "actif" : "coupé"}`}
                onClick={() => setDrafts((d) => ({ ...d, [key]: !d[key] }))}
                style={{ width: 38, height: 22, borderRadius: 22, border: "none", padding: 0, cursor: "pointer", position: "relative", background: active ? platformMeta[key]?.badgeBg ?? "oklch(0.5 0.2 292)" : color.border, transition: "background .15s" }}
              >
                <span style={{ position: "absolute", top: 3, left: active ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
              </button>
            </div>
          );
        })}
      </div>
      {error && <p style={{ color: color.danger, fontSize: 13, margin: "16px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Annuler
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "..." : "Enregistrer"}
        </Button>
      </div>
    </Modal>
  );
}
