"use client";

import { useState } from "react";
import { Check, SquarePen, X } from "lucide-react";
import Card from "@/components/ui/Card";
import IconActionButton from "@/components/ui/IconActionButton";
import { api, ApiClientError, type StyleProfile, type StyleProposal } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";
import { platformLabel } from "@/lib/social/types";

interface StyleDraft {
  styleProfile: StyleProfile;
  changeNotes: string;
}

function toStyleDraft(payload: Record<string, unknown>): StyleDraft {
  const raw = (payload.styleProfile ?? {}) as Partial<StyleProfile>;
  return {
    styleProfile: {
      tone: raw.tone ?? "",
      sentenceLength: raw.sentenceLength ?? "",
      emojiUsage: raw.emojiUsage ?? "",
      vocabulary: raw.vocabulary ?? "",
      summary: raw.summary ?? "",
      rules: raw.rules ?? [],
      avoid: raw.avoid ?? [],
      prefer: raw.prefer ?? [],
      evidence: raw.evidence,
    },
    changeNotes: typeof payload.changeNotes === "string" ? payload.changeNotes : "",
  };
}

function StyleRulesSummary({ styleProfile }: { styleProfile: StyleProfile }) {
  const rules = styleProfile.rules ?? [];
  return (
    <div style={{ display: "grid", gap: 4, fontSize: 12, color: color.textMuted }}>
      <span>Voice: {styleProfile.summary}</span>
      {rules.length > 0 && (
        <div style={{ display: "grid", gap: 2 }}>
          {rules.map((r, i) => (
            <span key={`${r.text}-${i}`}>
              · {r.text}
              {r.platform ? ` (${platformLabel(r.platform)})` : ""}
            </span>
          ))}
        </div>
      )}
      {(styleProfile.avoid?.length ?? 0) > 0 && <span>To avoid: {styleProfile.avoid!.join(", ")}</span>}
      {(styleProfile.prefer?.length ?? 0) > 0 && <span>Preferred: {styleProfile.prefer!.join(", ")}</span>}
    </div>
  );
}

/** Edit mode of a style proposal: uncheck the rules you don't want to keep. */
function StyleRulesPicker({ draft, onChange }: { draft: StyleDraft; onChange: (d: StyleDraft) => void }) {
  const rules = draft.styleProfile.rules ?? [];
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: color.textFaint }}>Uncheck the rules you don&apos;t want to keep:</span>
      {rules.map((r, i) => (
        <label key={`${r.text}-${i}`} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked
            onChange={() =>
              onChange({
                ...draft,
                styleProfile: { ...draft.styleProfile, rules: rules.filter((_, j) => j !== i) },
              })
            }
          />
          <span>
            {r.text}
            {r.platform ? <span style={{ color: color.textFaint }}> ({platformLabel(r.platform)})</span> : null}
          </span>
        </label>
      ))}
      {rules.length === 0 && <span style={{ fontSize: 12, color: color.textFaint }}>No rules in this proposal.</span>}
    </div>
  );
}

/**
 * A style learning pass waiting for approval (docs/SPEC_APPRENTISSAGE_STYLE.md §6). Rules can be
 * unchecked before accepting: it's the only editable field of the proposal (§6.3) — the rest is edited
 * afterwards in Settings.
 */
export default function StyleProposalCard({ proposal, onResolved }: { proposal: StyleProposal; onResolved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StyleDraft>(() => toStyleDraft(proposal.payload));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(action: "accept" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const fields = action === "accept" && editing ? { styleProfile: draft.styleProfile } : undefined;
      await api.resolveStyleProposal(proposal.id, action, fields);
      onResolved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong, please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: 3 }}>
            Writing style
          </div>
          {!editing && <div style={{ fontSize: 14, fontWeight: 600 }}>Update to your style</div>}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <IconActionButton icon={SquarePen} variant="neutral" title="Edit before saving" onClick={() => setEditing((e) => !e)} disabled={busy} size={28} />
          <IconActionButton icon={X} variant="danger" title="Reject" onClick={() => resolve("reject")} disabled={busy} size={28} />
          <IconActionButton icon={Check} variant="primary" title="Accept" onClick={() => resolve("accept")} disabled={busy} size={28} />
        </div>
      </div>

      {editing ? (
        <StyleRulesPicker draft={draft} onChange={setDraft} />
      ) : (
        <div>
          {draft.changeNotes && <p style={{ margin: "0 0 6px", fontSize: 13, color: color.textMuted }}>{draft.changeNotes}</p>}
          <StyleRulesSummary styleProfile={draft.styleProfile} />
        </div>
      )}

      {error && <p style={{ margin: "8px 0 0", fontSize: 12, color: color.danger }}>{error}</p>}
    </Card>
  );
}
