"use client";

import { useState } from "react";
import { Check, SquarePen, X } from "lucide-react";
import Card from "@/components/ui/Card";
import IconActionButton from "@/components/ui/IconActionButton";
import PublishingDaysPicker from "@/components/PublishingDaysPicker";
import RhythmPicker from "@/components/RhythmPicker";
import { parseStoredRhythm, rhythmLabel, type SeriesRhythm } from "@/lib/seriesRhythm";
import { api, ApiClientError, type AssistantProposal, type StyleProfile } from "@/lib/apiClient";
import { accentAlpha, color } from "@/lib/design/tokens";
import { useContentCategories } from "@/contexts/CategoryLabelsContext";
import { KNOWN_PLATFORMS, platformLabel } from "@/lib/social/types";
import { publishingDaysLabel } from "@/lib/services/calendarService";

const KIND_LABEL: Record<AssistantProposal["kind"], string> = {
  product_create: "New topic",
  product_update: "Edit topic",
  series_create: "New series",
  series_update: "Edit series",
  category_create: "New role",
  category_update: "Edit role",
  angle_create: "New angle",
  angle_update: "Edit angle",
  posting_goal_update: "Platform",
  material_create: "Add to material",
  material_update: "Edit material",
  material_delete: "Remove from material",
  series_archive: "Archive series",
  category_archive: "Archive role",
  angle_archive: "Archive angle",
  category_reweight: "Role rebalancing",
  profile_update: "Brand audience",
  style_profile_update: "Writing style",
  publishing_days_update: "Publishing days",
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
  | "publishingDays"
  | "categoryReweight"
  | "profile"
  | "style"
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
    case "publishing_days_update":
      return "publishingDays";
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
    case "style_profile_update":
      return "style";
  }
}

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

interface ProductDraft {
  name: string;
  description: string;
  valueProposition: string;
  targetAudience: string;
}

interface SeriesDraft {
  label: string;
  description: string;
  /** Absent = rhythm unchanged (proposal from before rhythms existed, or an update that doesn't touch it). */
  rhythm?: SeriesRhythm;
  categoryId: string;
  platforms: string[];
}

interface CategoryDraft {
  label: string;
  description: string;
  weight: number;
  platforms: string[];
  /** `undefined` = untouched by the user: the key is then absent from the JSON sent and
   *  `resolveProposal` keeps the role's current value. Never initialise to `false`
   *  from context, which may not be loaded yet on first render. */
  materialHungry?: boolean;
}

interface AngleDraft {
  label: string;
  description: string;
}

interface PostingGoalDraft {
  platform: string;
  active: boolean;
}

interface PublishingDaysDraft {
  publishingDays: number[];
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
    rhythm: parseStoredRhythm(payload.rhythm) ?? undefined,
    categoryId: typeof payload.categoryId === "string" ? payload.categoryId : "",
    platforms: Array.isArray(payload.platforms) ? (payload.platforms as string[]) : [],
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
    // A proposal from before the "active / off" switch still carries a count per week.
    active:
      typeof payload.active === "boolean"
        ? payload.active
        : typeof payload.targetCountPerWeek === "number" && payload.targetCountPerWeek > 0,
  };
}

function toPublishingDaysDraft(payload: Record<string, unknown>): PublishingDaysDraft {
  const raw = Array.isArray(payload.publishingDays) ? payload.publishingDays : [];
  return { publishingDays: raw.filter((d): d is number => typeof d === "number" && d >= 1 && d <= 7) };
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
  // Current value of the targeted role: only used to DISPLAY the checkbox in the right state until
  // the user touches it — never to build the payload sent (see CategoryDraft).
  const currentMaterialHungry = categories.find((c) => c.id === proposal.targetId)?.materialHungry ?? false;
  const [editing, setEditing] = useState(false);
  const [productDraft, setProductDraft] = useState<ProductDraft>(() => toProductDraft(proposal.payload));
  const [seriesDraft, setSeriesDraft] = useState<SeriesDraft>(() => toSeriesDraft(proposal.payload));
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(() => toCategoryDraft(proposal.payload));
  const [angleDraft, setAngleDraft] = useState<AngleDraft>(() => toAngleDraft(proposal.payload));
  const [postingGoalDraft, setPostingGoalDraft] = useState<PostingGoalDraft>(() => toPostingGoalDraft(proposal.payload));
  const [publishingDaysDraft, setPublishingDaysDraft] = useState<PublishingDaysDraft>(() =>
    toPublishingDaysDraft(proposal.payload)
  );
  const [categoryReweightDraft, setCategoryReweightDraft] = useState<CategoryReweightDraft>(() =>
    toCategoryReweightDraft(proposal.payload)
  );
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() => toProfileDraft(proposal.payload));
  // Rules can be unchecked before accepting: it's the only editable field of a style
  // proposal (docs/SPEC_APPRENTISSAGE_STYLE.md §6.3) — the rest is edited afterwards in Settings.
  const [styleDraft, setStyleDraft] = useState<StyleDraft>(() => toStyleDraft(proposal.payload));
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
                : group === "publishingDays"
                  ? publishingDaysDraft
                : group === "categoryReweight"
                  ? { items: categoryReweightDraft.items }
                  : group === "profile"
                    ? profileDraft
                    : group === "style"
                      ? { styleProfile: styleDraft.styleProfile }
                    : group === "material"
                      ? materialDraft
                      : // An archive has nothing to edit: accepting means archiving the target.
                        group === "archive"
                        ? {}
                        : productDraft;
      const fields: Record<string, unknown> | undefined = action === "accept" && editing ? { ...draft } : undefined;
      const { proposals } = await api.resolveAssistantProposal(proposal.id, action, fields);
      onResolved(proposals);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong, please try again.");
    } finally {
      setBusy(false);
    }
  }

  // One role per series (docs/SPEC_SERIES_ET_ROLES.md §1) — exclusive selection.
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
            : group === "publishingDays"
              ? "New publishing days"
            : group === "categoryReweight"
              ? "Role rebalancing"
              : group === "profile"
                ? "Brand audience"
                : group === "style"
                  ? "Update to your style"
                : group === "material"
                  ? materialDraft.title || "Material"
                  : group === "archive"
                    ? typeof proposal.payload.label === "string"
                      ? proposal.payload.label
                      : "Item to archive"
                    : productDraft.name;

  const description =
    group === "series"
      ? seriesDraft.rhythm
        ? `${seriesDraft.description} · ${rhythmLabel(seriesDraft.rhythm)}`
        : seriesDraft.description
      : group === "category"
        ? categoryDraft.description
        : group === "angle"
          ? angleDraft.description
          : group === "postingGoal"
            ? postingGoalDraft.active
              ? "On: one post per publishing day"
              : "Off: no more posts on this platform"
            : group === "publishingDays"
              ? `One post every ${publishingDaysLabel(publishingDaysDraft.publishingDays)}`
            : group === "categoryReweight"
              ? categoryReweightDraft.reasonSummary
              : group === "profile"
                ? profileDraft.targetAudience
                : group === "style"
                  ? styleDraft.changeNotes
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
          {!editing && <div style={{ fontSize: 14, fontWeight: 600 }}>{title || "(unnamed)"}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <IconActionButton icon={SquarePen} variant="neutral" title="Edit before saving" onClick={() => setEditing((e) => !e)} disabled={busy} size={28} />
          <IconActionButton icon={X} variant="danger" title="Reject" onClick={() => resolve("reject")} disabled={busy} size={28} />
          <IconActionButton icon={Check} variant="primary" title="Accept" onClick={() => resolve("accept")} disabled={busy} size={28} />
        </div>
      </div>

      {editing ? (
        group === "series" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <input style={inputStyle} value={seriesDraft.label} onChange={(e) => setSeriesDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Series name" />
            <input style={inputStyle} value={seriesDraft.description} onChange={(e) => setSeriesDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Series identity" />
            <RhythmPicker
              value={seriesDraft.rhythm ?? { days: [3], every: 1, anchor: null }}
              onChange={(rhythm) => setSeriesDraft((d) => ({ ...d, rhythm }))}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {categories.map((c) => (
                <button key={c.id} onClick={() => selectSeriesCategory(c.id)} style={pillStyle(seriesDraft.categoryId === c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            {/* Linked topic: applied on acceptance but not editable here — the link is changed
                from the Direction screen, which has the full topic selector. */}
            {typeof proposal.payload.productName === "string" && (
              <span style={{ fontSize: 11, color: color.textFaint }}>Material drawn from topic: {proposal.payload.productName}</span>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: color.textFaint, marginRight: 2 }}>
                {seriesDraft.platforms.length === 0 ? "All networks" : "Networks:"}
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
            <input style={inputStyle} value={categoryDraft.label} onChange={(e) => setCategoryDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Role label" />
            <input style={inputStyle} value={categoryDraft.description} onChange={(e) => setCategoryDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Instruction for the AI" />
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
                {categoryDraft.platforms.length === 0 ? "All networks" : "Networks:"}
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
              Doesn&apos;t run without documented material
            </label>
          </div>
        ) : group === "angle" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <input style={inputStyle} value={angleDraft.label} onChange={(e) => setAngleDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Angle name" />
            <input style={inputStyle} value={angleDraft.description} onChange={(e) => setAngleDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Treatment instruction" />
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
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPostingGoalDraft((d) => ({ ...d, active: true }))} style={pillStyle(postingGoalDraft.active)}>
                On
              </button>
              <button onClick={() => setPostingGoalDraft((d) => ({ ...d, active: false }))} style={pillStyle(!postingGoalDraft.active)}>
                Off
              </button>
            </div>
          </div>
        ) : group === "publishingDays" ? (
          <PublishingDaysPicker
            value={publishingDaysDraft.publishingDays}
            onChange={(publishingDays) => setPublishingDaysDraft({ publishingDays })}
          />
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
              placeholder="Who buys or reads, what they care about, what they should remember about the brand"
            />
          </div>
        ) : group === "style" ? (
          <StyleRulesPicker draft={styleDraft} onChange={setStyleDraft} />
        ) : group === "material" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <input
              style={inputStyle}
              value={materialDraft.title}
              onChange={(e) => setMaterialDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Document title"
            />
            {/* The text stays editable before saving: it's the last safety net against
                information misreported by the assistant. Empty for a deletion. */}
            {proposal.kind !== "material_delete" && (
              <textarea
                style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                value={materialDraft.text}
                onChange={(e) => setMaterialDraft((d) => ({ ...d, text: e.target.value }))}
                placeholder="Document content"
              />
            )}
            <span style={{ fontSize: 11, color: color.textFaint }}>
              {typeof proposal.payload.productName === "string"
                ? `Topic: ${proposal.payload.productName}`
                : "Brand-level material (no topic)"}
            </span>
          </div>
        ) : group === "archive" ? (
          <p style={{ margin: 0, fontSize: 12, color: color.textMuted }}>
            Nothing to edit: accepting archives the item. It drops out of circulation, but scripts and slots
            already produced keep it.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <input style={inputStyle} value={productDraft.name} onChange={(e) => setProductDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Topic name" />
            <input style={inputStyle} value={productDraft.description} onChange={(e) => setProductDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Description" />
            <input
              style={inputStyle}
              value={productDraft.valueProposition}
              onChange={(e) => setProductDraft((d) => ({ ...d, valueProposition: e.target.value }))}
              placeholder="Value proposition"
            />
            <input
              style={inputStyle}
              value={productDraft.targetAudience}
              onChange={(e) => setProductDraft((d) => ({ ...d, targetAudience: e.target.value }))}
              placeholder="Audience for this topic (empty = brand audience)"
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
      ) : group === "style" ? (
        <div>
          {description && <p style={{ margin: "0 0 6px", fontSize: 13, color: color.textMuted }}>{description}</p>}
          <StyleRulesSummary styleProfile={styleDraft.styleProfile} />
        </div>
      ) : (
        description && <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>{description}</p>
      )}

      {error && <p style={{ margin: "8px 0 0", fontSize: 12, color: color.danger }}>{error}</p>}
    </Card>
  );
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
          The assistant&apos;s proposals will appear here as the conversation goes on.
        </p>
      ) : (
        proposals.map((p) => <ProposalCard key={p.id} proposal={p} onResolved={onProposalsChange} />)
      )}
    </div>
  );
}
