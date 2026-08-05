"use client";

import { useState } from "react";
import { Check, SquarePen, X } from "lucide-react";
import Card from "@/components/ui/Card";
import IconActionButton from "@/components/ui/IconActionButton";
import { api, ApiClientError, type AssistantProposal } from "@/lib/apiClient";
import { accentAlpha, color } from "@/lib/design/tokens";
import { useContentCategories } from "@/contexts/CategoryLabelsContext";
import { KNOWN_PLATFORMS, platformLabel } from "@/lib/social/types";

const KIND_LABEL: Record<AssistantProposal["kind"], string> = {
  product_create: "Nouveau produit",
  product_update: "Modifier le produit",
  series_create: "Nouvelle série",
  series_update: "Modifier la série",
  category_create: "Nouvelle catégorie",
  category_update: "Modifier la catégorie",
  angle_create: "Nouvel angle",
  angle_update: "Modifier l'angle",
  posting_goal_update: "Objectif de fréquence",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${color.inputBorder}`,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  background: color.cardBg,
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: active ? 600 : 500,
    color: active ? "oklch(0.48 0.2 292)" : color.textMuted,
    background: active ? accentAlpha(0.12) : color.inputBg,
    border: `1px solid ${active ? "oklch(0.6 0.15 292)" : color.inputBorder}`,
    borderRadius: 20,
    padding: "4px 10px",
    cursor: "pointer",
  };
}

type ProposalGroup = "product" | "series" | "category" | "angle" | "postingGoal";

function proposalGroup(kind: AssistantProposal["kind"]): ProposalGroup {
  switch (kind) {
    case "product_create":
    case "product_update":
      return "product";
    case "series_create":
    case "series_update":
      return "series";
    case "category_create":
    case "category_update":
      return "category";
    case "angle_create":
    case "angle_update":
      return "angle";
    case "posting_goal_update":
      return "postingGoal";
  }
}

interface ProductDraft {
  name: string;
  description: string;
  valueProposition: string;
}

interface SeriesDraft {
  label: string;
  description: string;
  weight: number;
  categoryIds: string[];
  platforms: string[];
}

interface CategoryDraft {
  label: string;
  description: string;
  weight: number;
  platforms: string[];
}

interface AngleDraft {
  label: string;
  description: string;
}

interface PostingGoalDraft {
  platform: string;
  targetCountPerWeek: number;
}

function toProductDraft(payload: Record<string, unknown>): ProductDraft {
  return {
    name: typeof payload.name === "string" ? payload.name : "",
    description: typeof payload.description === "string" ? payload.description : "",
    valueProposition: typeof payload.valueProposition === "string" ? payload.valueProposition : "",
  };
}

function toSeriesDraft(payload: Record<string, unknown>): SeriesDraft {
  return {
    label: typeof payload.label === "string" ? payload.label : "",
    description: typeof payload.description === "string" ? payload.description : "",
    weight: typeof payload.weight === "number" ? payload.weight : 0,
    categoryIds: Array.isArray(payload.categoryIds) ? (payload.categoryIds as string[]) : [],
    platforms: Array.isArray(payload.platforms) ? (payload.platforms as string[]) : [],
  };
}

function toCategoryDraft(payload: Record<string, unknown>): CategoryDraft {
  return {
    label: typeof payload.label === "string" ? payload.label : "",
    description: typeof payload.description === "string" ? payload.description : "",
    weight: typeof payload.weight === "number" ? payload.weight : 0,
    platforms: Array.isArray(payload.platforms) ? (payload.platforms as string[]) : [],
  };
}

function toAngleDraft(payload: Record<string, unknown>): AngleDraft {
  return {
    label: typeof payload.label === "string" ? payload.label : "",
    description: typeof payload.description === "string" ? payload.description : "",
  };
}

function toPostingGoalDraft(payload: Record<string, unknown>): PostingGoalDraft {
  return {
    platform: typeof payload.platform === "string" ? payload.platform : "",
    targetCountPerWeek: typeof payload.targetCountPerWeek === "number" ? payload.targetCountPerWeek : 0,
  };
}

function ProposalCard({
  proposal,
  onResolved,
}: {
  proposal: AssistantProposal;
  onResolved: (proposals: AssistantProposal[]) => void;
}) {
  const categories = useContentCategories();
  const group = proposalGroup(proposal.kind);
  const [editing, setEditing] = useState(false);
  const [productDraft, setProductDraft] = useState<ProductDraft>(() => toProductDraft(proposal.payload));
  const [seriesDraft, setSeriesDraft] = useState<SeriesDraft>(() => toSeriesDraft(proposal.payload));
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(() => toCategoryDraft(proposal.payload));
  const [angleDraft, setAngleDraft] = useState<AngleDraft>(() => toAngleDraft(proposal.payload));
  const [postingGoalDraft, setPostingGoalDraft] = useState<PostingGoalDraft>(() => toPostingGoalDraft(proposal.payload));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(action: "accept" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const draft =
        group === "series"
          ? seriesDraft
          : group === "category"
            ? categoryDraft
            : group === "angle"
              ? angleDraft
              : group === "postingGoal"
                ? postingGoalDraft
                : productDraft;
      const fields: Record<string, unknown> | undefined = action === "accept" && editing ? { ...draft } : undefined;
      const { proposals } = await api.resolveAssistantProposal(proposal.id, action, fields);
      onResolved(proposals);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur, réessaie.");
    } finally {
      setBusy(false);
    }
  }

  function toggleSeriesCategory(categoryId: string) {
    setSeriesDraft((d) => ({
      ...d,
      categoryIds: d.categoryIds.includes(categoryId)
        ? d.categoryIds.filter((id) => id !== categoryId)
        : [...d.categoryIds, categoryId],
    }));
  }

  function toggleSeriesPlatform(platform: string) {
    setSeriesDraft((d) => ({
      ...d,
      platforms: d.platforms.includes(platform) ? d.platforms.filter((p) => p !== platform) : [...d.platforms, platform],
    }));
  }

  function toggleCategoryPlatform(platform: string) {
    setCategoryDraft((d) => ({
      ...d,
      platforms: d.platforms.includes(platform) ? d.platforms.filter((p) => p !== platform) : [...d.platforms, platform],
    }));
  }

  const title =
    group === "series"
      ? seriesDraft.label
      : group === "category"
        ? categoryDraft.label
        : group === "angle"
          ? angleDraft.label
          : group === "postingGoal"
            ? platformLabel(postingGoalDraft.platform)
            : productDraft.name;

  const description =
    group === "series"
      ? seriesDraft.description
      : group === "category"
        ? categoryDraft.description
        : group === "angle"
          ? angleDraft.description
          : group === "postingGoal"
            ? `${postingGoalDraft.targetCountPerWeek}/semaine`
            : productDraft.description;

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: 3 }}>
            {KIND_LABEL[proposal.kind]}
          </div>
          {!editing && <div style={{ fontSize: 14, fontWeight: 600 }}>{title || "(sans nom)"}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <IconActionButton icon={SquarePen} variant="neutral" title="Éditer avant d'enregistrer" onClick={() => setEditing((e) => !e)} disabled={busy} size={28} />
          <IconActionButton icon={X} variant="danger" title="Refuser" onClick={() => resolve("reject")} disabled={busy} size={28} />
          <IconActionButton icon={Check} variant="primary" title="Accepter" onClick={() => resolve("accept")} disabled={busy} size={28} />
        </div>
      </div>

      {editing ? (
        group === "series" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <input style={inputStyle} value={seriesDraft.label} onChange={(e) => setSeriesDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Nom de la série" />
            <input style={inputStyle} value={seriesDraft.description} onChange={(e) => setSeriesDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Identité de la série" />
            <input
              style={{ ...inputStyle, width: 100 }}
              type="number"
              min={0}
              max={100}
              value={seriesDraft.weight}
              onChange={(e) => setSeriesDraft((d) => ({ ...d, weight: Number(e.target.value) }))}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {categories.map((c) => (
                <button key={c.id} onClick={() => toggleSeriesCategory(c.id)} style={pillStyle(seriesDraft.categoryIds.includes(c.id))}>
                  {c.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: color.textFaint, marginRight: 2 }}>
                {seriesDraft.platforms.length === 0 ? "Tous les réseaux" : "Réseaux :"}
              </span>
              {KNOWN_PLATFORMS.map((p) => (
                <button key={p.key} onClick={() => toggleSeriesPlatform(p.key)} style={pillStyle(seriesDraft.platforms.includes(p.key))}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : group === "category" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <input style={inputStyle} value={categoryDraft.label} onChange={(e) => setCategoryDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Libellé de la catégorie" />
            <input style={inputStyle} value={categoryDraft.description} onChange={(e) => setCategoryDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Consigne pour l'IA" />
            <input
              style={{ ...inputStyle, width: 100 }}
              type="number"
              min={5}
              max={90}
              value={categoryDraft.weight}
              onChange={(e) => setCategoryDraft((d) => ({ ...d, weight: Number(e.target.value) }))}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: color.textFaint, marginRight: 2 }}>
                {categoryDraft.platforms.length === 0 ? "Tous les réseaux" : "Réseaux :"}
              </span>
              {KNOWN_PLATFORMS.map((p) => (
                <button key={p.key} onClick={() => toggleCategoryPlatform(p.key)} style={pillStyle(categoryDraft.platforms.includes(p.key))}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : group === "angle" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <input style={inputStyle} value={angleDraft.label} onChange={(e) => setAngleDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Nom de l'angle" />
            <input style={inputStyle} value={angleDraft.description} onChange={(e) => setAngleDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Consigne de traitement" />
          </div>
        ) : group === "postingGoal" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <select
              style={inputStyle}
              value={postingGoalDraft.platform}
              onChange={(e) => setPostingGoalDraft((d) => ({ ...d, platform: e.target.value }))}
            >
              {KNOWN_PLATFORMS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              style={{ ...inputStyle, width: 100 }}
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={postingGoalDraft.targetCountPerWeek}
              onChange={(e) => setPostingGoalDraft((d) => ({ ...d, targetCountPerWeek: Number(e.target.value) }))}
            />
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <input style={inputStyle} value={productDraft.name} onChange={(e) => setProductDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Nom du produit" />
            <input style={inputStyle} value={productDraft.description} onChange={(e) => setProductDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Description" />
            <input
              style={inputStyle}
              value={productDraft.valueProposition}
              onChange={(e) => setProductDraft((d) => ({ ...d, valueProposition: e.target.value }))}
              placeholder="Proposition de valeur"
            />
          </div>
        )
      ) : (
        description && <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>{description}</p>
      )}

      {error && <p style={{ margin: "8px 0 0", fontSize: 12, color: color.danger }}>{error}</p>}
    </Card>
  );
}

export default function AssistantProposalsPanel({
  proposals,
  onProposalsChange,
}: {
  proposals: AssistantProposal[];
  onProposalsChange: (proposals: AssistantProposal[]) => void;
}) {
  return (
    <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
      {proposals.length === 0 ? (
        <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>
          Les propositions de l&apos;assistant apparaîtront ici au fil de la conversation.
        </p>
      ) : (
        proposals.map((p) => <ProposalCard key={p.id} proposal={p} onResolved={onProposalsChange} />)
      )}
    </div>
  );
}
