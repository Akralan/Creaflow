"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api, ApiClientError, type AssistantProposal, type StyleLearningStatus, type StyleProfile, type StyleRule } from "@/lib/apiClient";
import { accentAlpha, color } from "@/lib/design/tokens";
import { KNOWN_PLATFORMS, platformLabel } from "@/lib/social/types";
import AssistantProposalsPanel from "@/components/AssistantProposalsPanel";

/** Seuil d'affichage de la suggestion — même valeur que STYLE_LEARNING_SUGGESTION_THRESHOLD côté serveur. */
const SUGGESTION_THRESHOLD = 5;

function descriptors(styleProfile: StyleProfile) {
  return [`Ton : ${styleProfile.tone}`, styleProfile.sentenceLength, `Emojis : ${styleProfile.emojiUsage}`, `Registre : ${styleProfile.vocabulary}`];
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
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/**
 * Panneau « Style de communication » des Paramètres (docs/SPEC_APPRENTISSAGE_STYLE.md §6.1) :
 * voix détectée, règles apprises éditables à la main, compteur de scripts corrigés, et la
 * proposition d'analyse en attente s'il y en a une.
 */
export default function StyleAnalysisPanel() {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [status, setStatus] = useState<StyleLearningStatus | null>(null);
  const [pendingProposal, setPendingProposal] = useState<AssistantProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newRule, setNewRule] = useState("");
  const [newRulePlatform, setNewRulePlatform] = useState("");
  const [newAvoid, setNewAvoid] = useState("");
  const [newPrefer, setNewPrefer] = useState("");

  const refresh = useCallback(
    () =>
      Promise.all([api.getProfile(), api.listAssistantProposals()])
        .then(([{ profile: p, styleLearning }, { proposals }]) => {
          setProfile(p?.styleProfile ?? null);
          setStatus(styleLearning);
          setPendingProposal(proposals.find((x) => x.kind === "style_profile_update") ?? null);
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
        setNotice("Analyse terminée : une proposition de mise à jour t'attend ci-dessous.");
      } else {
        setNotice("Profil de style créé.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Analyse impossible.");
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
      setError(err instanceof ApiClientError ? err.message : "Enregistrement impossible.");
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
          <div style={{ fontWeight: 600, fontSize: 14 }}>Style d&apos;écriture</div>
          <div style={{ fontSize: 12, color: color.textMuted, marginTop: 2 }}>
            {profile?.evidence?.scriptCount ? `Appris sur ${profile.evidence.scriptCount} scripts` : "Pas encore appris de tes scripts"}
            {status?.lastLearnedAt ? ` · dernière analyse le ${formatDate(status.lastLearnedAt)}` : ""}
            {pending > 0 ? ` · ${pending} script${pending > 1 ? "s" : ""} corrigé${pending > 1 ? "s" : ""} depuis` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {profile && (
            <button onClick={() => runAnalysis(true)} disabled={loading} style={{ ...smallButton, color: color.textMuted, borderColor: color.border }} title="Rejoue aussi les scripts déjà analysés">
              Tout réanalyser
            </button>
          )}
          <button onClick={() => runAnalysis(false)} disabled={loading} style={smallButton}>
            {loading ? "Analyse..." : profile ? "Analyser les corrections" : "Analyser mon style"}
          </button>
        </div>
      </div>

      {pending >= SUGGESTION_THRESHOLD && !pendingProposal && (
        <p style={{ margin: 0, fontSize: 13, color: color.text2 }}>
          Tu as corrigé {pending} scripts depuis la dernière analyse : c&apos;est le bon moment pour mettre ton style à jour.
        </p>
      )}
      {error && <p style={{ margin: 0, fontSize: 12, color: color.danger }}>{error}</p>}
      {notice && <p style={{ margin: 0, fontSize: 12, color: color.textMuted }}>{notice}</p>}

      {pendingProposal && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, marginBottom: 6 }}>Nouvelle analyse à valider</div>
          <AssistantProposalsPanel
            proposals={[pendingProposal]}
            onProposalsChange={() => {
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
            <div style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, marginBottom: 6 }}>Règles apprises de tes corrections</div>
            {rules.length === 0 && <p style={{ margin: "0 0 6px", fontSize: 12, color: color.textFaint }}>Aucune règle pour l&apos;instant.</p>}
            <div style={{ display: "grid", gap: 4 }}>
              {rules.map((rule, i) => (
                <div key={`${rule.text}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{rule.text}</span>
                  {rule.platform && <span style={{ fontSize: 11, color: color.textFaint }}>{platformLabel(rule.platform)}</span>}
                  <button
                    title="Retirer cette règle"
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
              <input style={inlineInput} value={newRule} onChange={(e) => setNewRule(e.target.value)} placeholder="Ajouter une règle (ex. Jamais de question en ouverture)" maxLength={140} />
              <select style={{ ...inlineInput, flex: "0 0 auto", minWidth: 0 }} value={newRulePlatform} onChange={(e) => setNewRulePlatform(e.target.value)}>
                <option value="">Toutes plateformes</option>
                {KNOWN_PLATFORMS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button type="submit" style={smallButton} disabled={rules.length >= 12} title={rules.length >= 12 ? "12 règles maximum" : "Ajouter"}>
                <Plus size={14} style={{ verticalAlign: "-2px" }} />
              </button>
            </form>
          </div>

          <ListEditor label="À bannir" items={avoid} draft={newAvoid} setDraft={setNewAvoid} onChange={(items) => saveLists({ avoid: items })} placeholder="mot ou expression" />
          <ListEditor label="À privilégier" items={prefer} draft={newPrefer} setDraft={setNewPrefer} onChange={(items) => saveLists({ prefer: items })} placeholder="tournure" />
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
          Pas encore d&apos;analyse. Elle se nourrit des scripts que tu finalises (tournés ou publiés) après les avoir corrigés, de ceux
          que tu écris toi-même, et à défaut des légendes d&apos;un compte connecté.
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
              title="Retirer"
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
