"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api, ApiClientError, type StyleLearningStatus, type StyleProfile, type StyleProposal, type StyleRule } from "@/lib/apiClient";
import { accentAlpha, color } from "@/lib/design/tokens";
import { KNOWN_PLATFORMS, platformLabel } from "@/lib/social/types";
import StyleProposalCard from "@/components/StyleProposalCard";
import { GenerationOrb } from "@/components/GenerationAnimation";

/** Threshold for showing the suggestion — same value as STYLE_LEARNING_SUGGESTION_THRESHOLD on the server. */
const SUGGESTION_THRESHOLD = 5;

function descriptors(styleProfile: StyleProfile) {
  return [`Tone: ${styleProfile.tone}`, styleProfile.sentenceLength, `Emojis: ${styleProfile.emojiUsage}`, `Register: ${styleProfile.vocabulary}`];
}

const chipStyle: React.CSSProperties = {
  background: color.cardBg,
  border: `1px solid ${color.border}`,
  borderRadius: 8,
  padding: "5px 10px",
  fontSize: 13,
};

const smallButton: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "oklch(0.48 0.2 292)",
  background: color.cardBg,
  border: "1px solid oklch(0.6 0.15 292)",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
  flexShrink: 0,
  fontFamily: "inherit",
};

const inlineInput: React.CSSProperties = {
  flex: 1,
  minWidth: 160,
  border: `1px solid ${color.inputBorder}`,
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 13,
  fontFamily: "inherit",
  background: color.cardBg,
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

/**
 * "Communication style" panel in Settings (docs/SPEC_APPRENTISSAGE_STYLE.md §6.1):
 * detected voice, learned rules editable by hand, count of edited scripts, and the
 * pending analysis proposal if there is one.
 */
export default function StyleAnalysisPanel() {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [status, setStatus] = useState<StyleLearningStatus | null>(null);
  const [pendingProposal, setPendingProposal] = useState<StyleProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newRule, setNewRule] = useState("");
  const [newRulePlatform, setNewRulePlatform] = useState("");
  const [newAvoid, setNewAvoid] = useState("");
  const [newPrefer, setNewPrefer] = useState("");

  const refresh = useCallback(
    () =>
      Promise.all([api.getProfile(), api.getStyleProposal()])
        .then(([{ profile: p, styleLearning }, { proposal }]) => {
          setProfile(p?.styleProfile ?? null);
          setStatus(styleLearning);
          setPendingProposal(proposal);
        })
        .catch(() => {}),
    []
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runAnalysis(includeLearned = false) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.triggerStyleAnalysis({ includeLearned });
      if (result.proposalId) {
        setNotice("Analysis done: an update proposal is waiting for you below.");
      } else {
        setNotice("Style profile created.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't run the analysis.");
    } finally {
      setLoading(false);
    }
  }

  async function saveLists(patch: { rules?: StyleRule[]; avoid?: string[]; prefer?: string[] }) {
    setError(null);
    try {
      const { styleProfile } = await api.updateStyleLists(patch);
      setProfile(styleProfile);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save.");
    }
  }

  const rules = profile?.rules ?? [];
  const avoid = profile?.avoid ?? [];
  const prefer = profile?.prefer ?? [];
  const pending = status?.pendingScripts ?? 0;

  return (
    <div style={{ border: `1px solid ${accentAlpha(0.25)}`, background: accentAlpha(0.06), borderRadius: 14, padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Writing style</div>
          <div style={{ fontSize: 12, color: color.textMuted, marginTop: 2 }}>
            {profile?.evidence?.scriptCount ? `Learned from ${profile.evidence.scriptCount} scripts` : "Nothing learned from your scripts yet"}
            {status?.lastLearnedAt ? ` · last analysis on ${formatDate(status.lastLearnedAt)}` : ""}
            {pending > 0 ? ` · ${pending} script${pending > 1 ? "s" : ""} edited since` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {profile && (
            <button onClick={() => runAnalysis(true)} disabled={loading} style={{ ...smallButton, color: color.textMuted, borderColor: color.border }} title="Also replays scripts that were already analyzed">
              Re-analyze everything
            </button>
          )}
          <button onClick={() => runAnalysis(false)} disabled={loading} style={{ ...smallButton, display: "inline-flex", alignItems: "center", gap: 7 }}>
            {loading && <GenerationOrb size={14} />}
            {loading ? "Analyzing..." : profile ? "Analyze edits" : "Analyze my style"}
          </button>
        </div>
      </div>

      {pending >= SUGGESTION_THRESHOLD && !pendingProposal && (
        <p style={{ margin: 0, fontSize: 13, color: color.text2 }}>
          You&apos;ve edited {pending} scripts since the last analysis: a good time to update your style.
        </p>
      )}
      {error && <p style={{ margin: 0, fontSize: 12, color: color.danger }}>{error}</p>}
      {notice && <p style={{ margin: 0, fontSize: 12, color: color.textMuted }}>{notice}</p>}

      {pendingProposal && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, marginBottom: 6 }}>New analysis to approve</div>
          <StyleProposalCard
            key={pendingProposal.id}
            proposal={pendingProposal}
            onResolved={() => {
              void refresh();
            }}
          />
        </div>
      )}

      {profile ? (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {descriptors(profile).map((s) => (
              <span key={s} style={chipStyle}>
                {s}
              </span>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: color.text2 }}>{profile.summary}</p>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, marginBottom: 6 }}>Rules learned from your edits</div>
            {rules.length === 0 && <p style={{ margin: "0 0 6px", fontSize: 12, color: color.textFaint }}>No rules yet.</p>}
            <div style={{ display: "grid", gap: 4 }}>
              {rules.map((rule, i) => (
                <div key={`${rule.text}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{rule.text}</span>
                  {rule.platform && <span style={{ fontSize: 11, color: color.textFaint }}>{platformLabel(rule.platform)}</span>}
                  <button
                    title="Remove this rule"
                    onClick={() => saveLists({ rules: rules.filter((_, j) => j !== i) })}
                    style={{ background: "none", border: "none", cursor: "pointer", color: color.textFaint, padding: 2, display: "flex" }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = newRule.trim();
                if (!text) return;
                saveLists({ rules: [...rules, { text, platform: newRulePlatform || null }] });
                setNewRule("");
                setNewRulePlatform("");
              }}
              style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}
            >
              <input style={inlineInput} value={newRule} onChange={(e) => setNewRule(e.target.value)} placeholder="Add a rule (e.g. Never open with a question)" maxLength={140} />
              <select style={{ ...inlineInput, flex: "0 0 auto", minWidth: 0 }} value={newRulePlatform} onChange={(e) => setNewRulePlatform(e.target.value)}>
                <option value="">All platforms</option>
                {KNOWN_PLATFORMS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button type="submit" style={smallButton} disabled={rules.length >= 12} title={rules.length >= 12 ? "12 rules maximum" : "Add"}>
                <Plus size={14} style={{ verticalAlign: "-2px" }} />
              </button>
            </form>
          </div>

          <ListEditor label="To avoid" items={avoid} draft={newAvoid} setDraft={setNewAvoid} onChange={(items) => saveLists({ avoid: items })} placeholder="word or phrase" />
          <ListEditor label="Preferred" items={prefer} draft={newPrefer} setDraft={setNewPrefer} onChange={(items) => saveLists({ prefer: items })} placeholder="phrasing" />
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
          No analysis yet. It feeds on the scripts you finalize (shot or published) after editing them, on the ones
          you write yourself, and failing that, on the captions of a connected account.
        </p>
      )}
    </div>
  );
}

function ListEditor({
  label,
  items,
  draft,
  setDraft,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  draft: string;
  setDraft: (v: string) => void;
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {items.map((item, i) => (
          <span key={`${item}-${i}`} style={{ ...chipStyle, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            {item}
            <button
              title="Remove"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              style={{ background: "none", border: "none", cursor: "pointer", color: color.textFaint, padding: 0, display: "flex" }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (!text) return;
            onChange([...items, text]);
            setDraft("");
          }}
          style={{ display: "flex", gap: 4 }}
        >
          <input style={{ ...inlineInput, minWidth: 120, fontSize: 12, padding: "4px 8px" }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />
          <button type="submit" style={{ ...smallButton, padding: "4px 8px" }} disabled={items.length >= 15}>
            <Plus size={12} style={{ verticalAlign: "-2px" }} />
          </button>
        </form>
      </div>
    </div>
  );
}
