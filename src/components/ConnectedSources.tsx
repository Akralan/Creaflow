"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type MaterialSource, type SyncReport } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

/**
 * Sources connectées d'un sujet, quel que soit le fournisseur : état de la dernière synchro, bouton
 * de resynchronisation et débranchement. Se rend nul quand le sujet n'a aucune source, donc
 * l'appelant n'a aucune condition à poser. Le nom du fournisseur vient de `connectorLabel`, jamais
 * d'une chaîne en dur ici.
 */
export default function ConnectedSources({ productId }: { productId: string }) {
  const [sources, setSources] = useState<MaterialSource[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, SyncReport>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getMaterialSources(productId)
      .then(({ sources }) => !cancelled && setSources(sources))
      .catch(() => !cancelled && setSources([]));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function sync(id: string) {
    setSyncingId(id);
    setError(null);
    try {
      const { report } = await api.syncMaterialSource(id);
      setReports((prev) => ({ ...prev, [id]: report }));
      const { sources } = await api.getMaterialSources(productId);
      setSources(sources);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Sync failed.");
    } finally {
      setSyncingId(null);
    }
  }

  async function unlink(source: MaterialSource) {
    // Confirmation explicite : débrancher supprime les documents miroir de cette source.
    if (
      !window.confirm(
        `Disconnecting ${source.label} will delete the documents pulled from this source. Continue?`
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api.deleteMaterialSource(source.id);
      setSources((prev) => prev.filter((s) => s.id !== source.id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Disconnecting failed.");
    }
  }

  if (sources.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary, margin: "0 0 8px" }}>
        Connected sources
      </h3>
      <div style={{ display: "grid", gap: 8 }}>
        {sources.map((source) => {
          const report = reports[source.id];
          return (
            <div
              key={source.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${color.border}`,
                background: color.cardBg,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{source.label}</div>
                <div style={{ fontSize: 12, color: color.textFaint, marginTop: 3 }}>
                  {source.lastSyncedAt ? `Synced on ${source.lastSyncedAt.slice(0, 10)}` : "Never synced"}
                  {source.status === "needs_reconnect" && ` · access lost, reconnect ${source.connectorLabel}`}
                </div>
                {/* Dire ce qui a bougé : sans ça l'utilisateur reclique par doute. */}
                {report && (
                  <div style={{ fontSize: 12, color: color.textMuted, marginTop: 4 }}>
                    {report.added} added, {report.updated} updated, {report.unchanged} unchanged
                  </div>
                )}
                {source.lastError && (
                  <div style={{ fontSize: 12, color: color.danger, marginTop: 4 }}>{source.lastError}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Button variant="secondary" onClick={() => sync(source.id)} disabled={syncingId === source.id}>
                  {syncingId === source.id ? "…" : "Resync"}
                </Button>
                <Button variant="ghost" onClick={() => unlink(source)}>
                  Disconnect
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p style={{ color: color.danger, fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
