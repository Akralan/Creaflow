"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import Card from "@/components/ui/Card";
import IconActionButton from "@/components/ui/IconActionButton";
import AssistantProposalsPanel from "@/components/AssistantProposalsPanel";
import { heading1Style } from "@/components/ui/TextField";
import { api, ApiClientError, type AssistantProposal, type Connection, type PostMatchCandidate } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";
import { platformLabel } from "@/lib/social/types";

/**
 * Point de déclenchement lazy de la synchronisation des métriques (docs/SPEC_METRIQUES_AUTO.md
 * §7.5) — le fetch se lance au montage de cette page, pas via un cron (aucun n'existe dans ce
 * repo). Affiche aussi les candidats de rattachement en attente de confirmation (§4) et, le cas
 * échéant, la proposition de rééquilibrage des catégories (§6/§7.4, via le mécanisme
 * AssistantProposal existant).
 */
export default function PerformancePage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [candidates, setCandidates] = useState<PostMatchCandidate[]>([]);
  const [needsReconnect, setNeedsReconnect] = useState<Connection[]>([]);
  const [proposals, setProposals] = useState<AssistantProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadState() {
    const [{ candidates }, { connections }, { proposals }] = await Promise.all([
      api.getMatchCandidates(),
      api.getConnections(),
      api.getAssistantChat(),
    ]);
    setCandidates(candidates);
    setNeedsReconnect(connections.filter((c) => c.connected && c.status === "needs_reconnect"));
    setProposals(proposals.filter((p) => p.kind === "category_reweight"));
  }

  useEffect(() => {
    (async () => {
      try {
        await loadState();
        setLoading(false);
        setSyncing(true);
        await api.refreshPerformance();
        await loadState();
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Erreur, réessaie.");
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    })();
  }, []);

  async function resolveCandidate(id: string, action: "confirm" | "dismiss") {
    setError(null);
    try {
      await api.resolveMatchCandidate(id, action);
      setCandidates((cs) => cs.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur, réessaie.");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "32px 36px" }}>
        <h1 style={heading1Style}>Performance</h1>
        <p style={{ color: color.textMuted, fontSize: 14 }}>Chargement…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 760 }}>
      <h1 style={heading1Style}>Performance</h1>
      <p style={{ margin: "6px 0 20px", color: color.textMuted, fontSize: 15 }}>
        Métriques récupérées automatiquement depuis tes comptes connectés — confirme les posts détectés pour qu&apos;ils
        alimentent l&apos;arbitrage éditorial.
      </p>

      {syncing && <p style={{ fontSize: 13, color: color.textFaint, marginBottom: 16 }}>Synchronisation en cours…</p>}
      {error && <p style={{ fontSize: 13, color: color.danger, marginBottom: 16 }}>{error}</p>}

      {needsReconnect.length > 0 && (
        <Card style={{ padding: 16, marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: color.danger }}>
            Connexion expirée pour {needsReconnect.map((c) => platformLabel(c.platform)).join(", ")} — reconnecte
            {needsReconnect.length > 1 ? "-les" : "-le"} depuis{" "}
            <a href="/settings" style={{ color: "inherit" }}>
              les paramètres
            </a>
            .
          </p>
        </Card>
      )}

      {proposals.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Rééquilibrage proposé</h2>
          <AssistantProposalsPanel proposals={proposals} onProposalsChange={setProposals} />
        </div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>À confirmer</h2>
      {candidates.length === 0 ? (
        <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>Aucun post en attente de confirmation.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {candidates.map((c) => (
            <Card key={c.id} style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.scriptTitle}</div>
                <div style={{ fontSize: 12, color: color.textMuted, margin: "2px 0" }}>
                  {platformLabel(c.platform)} · {c.metrics.views} vues · {c.metrics.likes} likes
                </div>
                {c.captionText && (
                  <div
                    style={{
                      fontSize: 12,
                      color: color.textFaint,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.captionText}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <IconActionButton
                  icon={X}
                  variant="danger"
                  title="Ce n'est pas ce post"
                  onClick={() => resolveCandidate(c.id, "dismiss")}
                  size={28}
                />
                <IconActionButton
                  icon={Check}
                  variant="primary"
                  title="C'est ce post"
                  onClick={() => resolveCandidate(c.id, "confirm")}
                  size={28}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
