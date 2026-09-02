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
  product_create: "Nouveau sujet",
  product_update: "Modifier le sujet",
  series_create: "Nouvelle série",
  series_update: "Modifier la série",
  category_create: "Nouveau rôle",
  category_update: "Modifier le rôle",
  angle_create: "Nouvel angle",
  angle_update: "Modifier l'angle",
  posting_goal_update: "Objectif de fréquence",
  material_create: "Ajouter à la matière",
  material_update: "Modifier la matière",
  material_delete: "Retirer de la matière",
  series_archive: "Archiver la série",
  category_archive: "Archiver le rôle",
  angle_archive: "Archiver l'angle",
  category_reweight: "Rééquilibrage des rôles",
  profile_update: "Audience de la marque",
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

type ProposalGroup =
  | "product"
  | "series"
  | "category"
  | "angle"
  | "postingGoal"
  | "categoryReweight"
  | "profile"
  | "material"
  | "archive";

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
    case "material_create":
    case "material_update":
    case "material_delete":
      return "material";
    case "series_archive":
    case "category_archive":
    case "angle_archive":
      return "archive";
    case "category_reweight":
      return "categoryReweight";
    case "profile_update":
      return "profile";
  }
}

interface ProductDraft {
  name: string;
  description: string;
  valueProposition: string;
  targetAudience: string;
}

interface SeriesDraft {
  label: string;
  description: string;
  weight: number;
  categoryId: string;
  platforms: string[];
  mode: "feuilleton" | "rendez_vous";
}

interface CategoryDraft {
  label: string;
  description: string;
  weight: number;
  platforms: string[];
  /** `undefined` = non touché par l'utilisateur : la clé est alors absente du JSON envoyé et
   *  `resolveProposal` conserve la valeur actuelle du rôle. Ne jamais initialiser à `false`
   *  d'après le contexte, qui peut ne pas être encore chargé au premier rendu. */
  materialHungry?: boolean;
}

interface AngleDraft {
  label: string;
  description: string;
}

interface PostingGoalDraft {
  platform: string;
  targetCountPerWeek: number;
}

interface CategoryReweightItemDraft {
  targetId: string;
  label: string;
  previousWeight: number;
  proposedWeight: number;
}

interface CategoryReweightDraft {
  items: CategoryReweightItemDraft[];
  reasonSummary: string;
}

interface ProfileDraft {
  targetAudience: string;
}

interface MaterialDraft {
  title: string;
  text: string;
}

function toProductDraft(payload: Record<string, unknown>): ProductDraft {
  return {
    name: typeof payload.name === "string" ? payload.name : "",
    description: typeof payload.description === "string" ? payload.description : "",
    valueProposition: typeof payload.valueProposition === "string" ? payload.valueProposition : "",
    targetAudience: typeof payload.targetAudience === "string" ? payload.targetAudience : "",
  };
}

function toSeriesDraft(payload: Record<string, unknown>): SeriesDraft {
  return {
    label: typeof payload.label === "string" ? payload.label : "",
    description: typeof payload.description === "string" ? payload.description : "",
    weight: typeof payload.weight === "number" ? payload.weight : 0,
    categoryId: typeof payload.categoryId === "string" ? payload.categoryId : "",
    platforms: Array.isArray(payload.platforms) ? (payload.platforms as string[]) : [],
    mode: payload.mode === "feuilleton" ? "feuilleton" : "rendez_vous",
  };
}

function toCategoryDraft(payload: Record<string, unknown>): CategoryDraft {
  return {
    label: typeof payload.label === "string" ? payload.label : "",
    description: typeof payload.description === "string" ? payload.description : "",
    weight: typeof payload.weight === "number" ? payload.weight : 0,
    platforms: Array.isArray(payload.platforms) ? (payload.platforms as string[]) : [],
    materialHungry: typeof payload.materialHungry === "boolean" ? payload.materialHungry : undefined,
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

function toMaterialDraft(payload: Record<string, unknown>): MaterialDraft {
  return {
    title: typeof payload.title === "string" ? payload.title : "",
    text: typeof payload.text === "string" ? payload.text : "",
  };
}

function toProfileDraft(payload: Record<string, unknown>): ProfileDraft {
  return { targetAudience: typeof payload.targetAudience === "string" ? payload.targetAudience : "" };
}

function toCategoryReweightDraft(payload: Record<string, unknown>): CategoryReweightDraft {
  const rawItems = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  return {
    items: rawItems.map((item) => ({
      targetId: typeof item.targetId === "string" ? item.targetId : "",
      label: typeof item.label === "string" ? item.label : "",
      previousWeight: typeof item.previousWeight === "number" ? item.previousWeight : 0,
      proposedWeight: typeof item.proposedWeight === "number" ? item.proposedWeight : 0,
    })),
    reasonSummary: typeof payload.reasonSummary === "string" ? payload.reasonSummary : "",
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
  // Valeur actuelle du rôle ciblé : sert uniquement à AFFICHER la case dans son bon état tant que
  // l'utilisateur n'y a pas touché — jamais à composer le payload envoyé (cf. CategoryDraft).
  const currentMaterialHungry = categories.find((c) => c.id === proposal.targetId)?.materialHungry ?? false;
  const [editing, setEditing] = useState(false);
  const [productDraft, setProductDraft] = useState<ProductDraft>(() => toProductDraft(proposal.payload));
  const [seriesDraft, setSeriesDraft] = useState<SeriesDraft>(() => toSeriesDraft(proposal.payload));
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(() => toCategoryDraft(proposal.payload));
  const [angleDraft, setAngleDraft] = useState<AngleDraft>(() => toAngleDraft(proposal.payload));
  const [postingGoalDraft, setPostingGoalDraft] = useState<PostingGoalDraft>(() => toPostingGoalDraft(proposal.payload));
  const [categoryReweightDraft, setCategoryReweightDraft] = useState<CategoryReweightDraft>(() =>
    toCategoryReweightDraft(proposal.payload)
  );
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() => toProfileDraft(proposal.payload));
  const [materialDraft, setMaterialDraft] = useState<MaterialDraft>(() => toMaterialDraft(proposal.payload));
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
                : group === "categoryReweight"
                  ? { items: categoryReweightDraft.items }
                  : group === "profile"
                    ? profileDraft
                    : group === "material"
                      ? materialDraft
                      : // Un archivage n'a rien d'éditable : accepter, c'est archiver la cible.
                        group === "archive"
                        ? {}
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

  // Rôle unique par série (docs/SPEC_SERIES_ET_ROLES.md §1) — sélection exclusive.
  function selectSeriesCategory(categoryId: string) {
    setSeriesDraft((d) => ({ ...d, categoryId }));
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
            : group === "categoryReweight"
              ? "Rééquilibrage des rôles"
              : group === "profile"
                ? "Audience de marque"
                : group === "material"
                  ? materialDraft.title || "Matière"
                  : group === "archive"
                    ? typeof proposal.payload.label === "string"
                      ? proposal.payload.label
                      : "Élément à archiver"
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
            : group === "categoryReweight"
              ? categoryReweightDraft.reasonSummary
              : group === "profile"
                ? profileDraft.targetAudience
                : group === "material"
                  ? materialDraft.text
                  : group === "archive"
                    ? typeof proposal.payload.reason === "string"
                      ? proposal.payload.reason
                      : ""
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
                <button key={c.id} onClick={() => selectSeriesCategory(c.id)} style={pillStyle(seriesDraft.categoryId === c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            <select
              style={inputStyle}
              value={seriesDraft.mode}
              onChange={(e) => setSeriesDraft((d) => ({ ...d, mode: e.target.value as SeriesDraft["mode"] }))}
            >
              <option value="rendez_vous">Rendez-vous — épisodes autonomes, même format</option>
              <option value="feuilleton">Feuilleton — les épisodes se suivent</option>
            </select>
            {/* Sujet lié : appliqué à l'acceptation mais non éditable ici — le rattachement se change
                depuis l'écran Direction, qui a le sélecteur de sujet complet. */}
            {typeof proposal.payload.productName === "string" && (
              <span style={{ fontSize: 11, color: color.textFaint }}>Matière tirée du sujet : {proposal.payload.productName}</span>
            )}
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
            <input style={inputStyle} value={categoryDraft.label} onChange={(e) => setCategoryDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Libellé du rôle" />
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
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.textMuted }}>
              <input
                type="checkbox"
                checked={categoryDraft.materialHungry ?? currentMaterialHungry}
                onChange={(e) => setCategoryDraft((d) => ({ ...d, materialHungry: e.target.checked }))}
              />
              Ne tourne pas sans matière documentée
            </label>
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
        ) : group === "categoryReweight" ? (
          <div style={{ display: "grid", gap: 8 }}>
            {categoryReweightDraft.reasonSummary && (
              <p style={{ margin: 0, fontSize: 12, color: color.textMuted }}>{categoryReweightDraft.reasonSummary}</p>
            )}
            {categoryReweightDraft.items.map((item, i) => (
              <div key={item.targetId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: 12, color: color.textFaint }}>{item.previousWeight}% →</span>
                <input
                  style={{ ...inputStyle, width: 64 }}
                  type="number"
                  min={5}
                  max={90}
                  value={item.proposedWeight}
                  onChange={(e) =>
                    setCategoryReweightDraft((d) => ({
                      ...d,
                      items: d.items.map((it, j) => (j === i ? { ...it, proposedWeight: Number(e.target.value) } : it)),
                    }))
                  }
                />
                <span style={{ fontSize: 12, color: color.textFaint }}>%</span>
              </div>
            ))}
          </div>
        ) : group === "profile" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
              value={profileDraft.targetAudience}
              onChange={(e) => setProfileDraft({ targetAudience: e.target.value })}
              placeholder="Qui achète ou lit, ce qui l'intéresse, ce qu'il doit retenir de la marque"
            />
          </div>
        ) : group === "material" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <input
              style={inputStyle}
              value={materialDraft.title}
              onChange={(e) => setMaterialDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Titre du document"
            />
            {/* Le texte reste éditable avant enregistrement : c'est le dernier filet contre une
                information mal rapportée par l'assistant. Vide pour une suppression. */}
            {proposal.kind !== "material_delete" && (
              <textarea
                style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                value={materialDraft.text}
                onChange={(e) => setMaterialDraft((d) => ({ ...d, text: e.target.value }))}
                placeholder="Contenu du document"
              />
            )}
            <span style={{ fontSize: 11, color: color.textFaint }}>
              {typeof proposal.payload.productName === "string"
                ? `Sujet : ${proposal.payload.productName}`
                : "Matière de niveau marque (aucun sujet)"}
            </span>
          </div>
        ) : group === "archive" ? (
          <p style={{ margin: 0, fontSize: 12, color: color.textMuted }}>
            Rien à éditer : accepter archive l&apos;élément. Il disparaît de la circulation, mais les scripts et créneaux
            déjà produits le conservent.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <input style={inputStyle} value={productDraft.name} onChange={(e) => setProductDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Nom du sujet" />
            <input style={inputStyle} value={productDraft.description} onChange={(e) => setProductDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Description" />
            <input
              style={inputStyle}
              value={productDraft.valueProposition}
              onChange={(e) => setProductDraft((d) => ({ ...d, valueProposition: e.target.value }))}
              placeholder="Proposition de valeur"
            />
            <input
              style={inputStyle}
              value={productDraft.targetAudience}
              onChange={(e) => setProductDraft((d) => ({ ...d, targetAudience: e.target.value }))}
              placeholder="Audience de ce sujet (vide = audience de la marque)"
            />
          </div>
        )
      ) : group === "categoryReweight" ? (
        <div>
          {description && <p style={{ margin: "0 0 6px", fontSize: 13, color: color.textMuted }}>{description}</p>}
          <div style={{ display: "grid", gap: 4 }}>
            {categoryReweightDraft.items.map((item) => (
              <div key={item.targetId} style={{ fontSize: 12, color: color.textMuted, display: "flex", justifyContent: "space-between" }}>
                <span>{item.label}</span>
                <span>
                  {item.previousWeight}% → {item.proposedWeight}%
                </span>
              </div>
            ))}
          </div>
        </div>
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
