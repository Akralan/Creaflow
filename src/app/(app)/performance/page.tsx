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
 * Lazy trigger point for metrics syncing (docs/SPEC_METRIQUES_AUTO.md
 * §7.5) — the fetch starts when this page mounts, not via a cron (none exists in this
 * repo). Also shows the matching candidates awaiting confirmation (§4) and, where
 * relevant, the category rebalancing proposal (§6/§7.4, via the existing
 * AssistantProposal mechanism).
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
        setError(err instanceof ApiClientError ? err.message : "Something went wrong, please try again.");
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
      setError(err instanceof ApiClientError ? err.message : "Something went wrong, please try again.");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "32px 36px" }}>
        <h1 style={heading1Style}>Performance</h1>
        <p style={{ color: color.textMuted, fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 760 }}>
      <h1 style={heading1Style}>Performance</h1>
      <p style={{ margin: "6px 0 20px", color: color.textMuted, fontSize: 15 }}>
        Metrics pulled automatically from your connected accounts — confirm the detected posts so they
        feed editorial decisions.
      </p>

      {syncing && <p style={{ fontSize: 13, color: color.textFaint, marginBottom: 16 }}>Syncing…</p>}
      {error && <p style={{ fontSize: 13, color: color.danger, marginBottom: 16 }}>{error}</p>}

      {needsReconnect.length > 0 && (
        <Card style={{ padding: 16, marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: color.danger }}>
            Connection expired for {needsReconnect.map((c) => platformLabel(c.platform)).join(", ")} — reconnect
            {needsReconnect.length > 1 ? " them" : " it"} from{" "}
            <a href="/settings" style={{ color: "inherit" }}>
              settings
            </a>
            .
          </p>
        </Card>
      )}

      {proposals.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Suggested rebalancing</h2>
          <AssistantProposalsPanel proposals={proposals} onProposalsChange={setProposals} />
        </div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>To confirm</h2>
      {candidates.length === 0 ? (
        <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>No posts waiting for confirmation.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {candidates.map((c) => (
            <Card key={c.id} style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.scriptTitle}</div>
                <div style={{ fontSize: 12, color: color.textMuted, margin: "2px 0" }}>
                  {platformLabel(c.platform)} · {c.metrics.views} views · {c.metrics.likes} likes
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
                  title="This isn't the post"
                  onClick={() => resolveCandidate(c.id, "dismiss")}
                  size={28}
                />
                <IconActionButton
                  icon={Check}
                  variant="primary"
                  title="This is the post"
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
