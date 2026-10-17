"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Film, Images, Type, type LucideIcon } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import GenerationAnimation, { type GenerationOutput } from "@/components/GenerationAnimation";
import { api, ApiClientError, type CalendarEntry, type VisualFormatFields } from "@/lib/apiClient";
import { DEFAULT_DURATION_MS, MAX_DURATION_MS, MIN_DURATION_MS } from "@/lib/visualDesign/visualFormat";
import { accent, accentAlpha, color, fontHeading } from "@/lib/design/tokens";

type VisualChoice = "animation" | "carousel";

const VISUALS: Record<VisualChoice, { label: string; hint: string; icon: LucideIcon }> = {
  animation: { label: "Animation", hint: "A few seconds in motion", icon: Film },
  carousel: { label: "Photo / carousel", hint: "One image or slides", icon: Images },
};

/** "Number of images" slider: 1 = single image, beyond that a carousel. */
const MAX_IMAGES = 7;
const DEFAULT_IMAGES = 1;
const DEFAULT_SECONDS = Math.round(DEFAULT_DURATION_MS / 1000);

/** Settings of the chosen visual: number of images, or animation duration. */
export interface VisualSettings {
  images: number;
  seconds: number;
}

function visualFields(visual: VisualChoice, settings: VisualSettings): VisualFormatFields {
  if (visual === "animation") return { visualFormat: "animation", durationMs: settings.seconds * 1000 };
  return settings.images <= 1 ? { visualFormat: "single" } : { visualFormat: "carousel", slideCount: settings.images };
}

/**
 * What the choice becomes: a single post. Text only → text post; a visual, with or without text →
 * visual post whose caption is a fully written text, or just a short caption.
 */
export function generationRequest(
  visual: VisualChoice | null,
  text: boolean,
  settings: VisualSettings = { images: DEFAULT_IMAGES, seconds: DEFAULT_SECONDS }
) {
  if (!visual) return text ? { contentType: "text" as const, fields: undefined } : null;
  return { contentType: "visual" as const, fields: { ...visualFields(visual, settings), withText: text } };
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <label style={{ display: "block", marginTop: 18 }}>
      <span style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 8 }}>
        <span>{label}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: accent }}
      />
      <span style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: color.textFaint }}>
        <span>{min}</span>
        <span>{max}</span>
      </span>
    </label>
  );
}

function ChoiceCard({
  label,
  hint,
  icon: Icon,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  icon: LucideIcon;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "26px 14px 22px",
        borderRadius: 16,
        border: `${selected ? 1.5 : 1}px solid ${selected ? accent : color.border}`,
        background: selected ? accentAlpha(0.07) : color.cardBg,
        boxShadow: selected ? `0 0 0 3px ${accentAlpha(0.08)}` : "none",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        transition: "border-color .2s ease, background .2s ease",
      }}
    >
      {selected && (
        <span
          aria-hidden
          style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: 6, display: "grid", placeItems: "center", background: accent, color: "#fff" }}
        >
          <Check size={13} strokeWidth={3} />
        </span>
      )}
      <span
        style={{ width: 64, height: 64, borderRadius: 18, display: "grid", placeItems: "center", background: accentAlpha(0.1), color: "oklch(0.5 0.2 292)" }}
      >
        <Icon size={30} strokeWidth={1.8} />
      </span>
      <span style={{ fontWeight: 700, fontSize: 15, color: color.text }}>{label}</span>
      <span style={{ fontSize: 12, color: color.textMuted }}>{hint}</span>
    </button>
  );
}

/**
 * A click on a calendar slot: tick a visual (animation OR photo/carousel), some
 * text, or both — it's always a single post. "Write" generates and opens the script. The topic
 * comes from the slot's series (the server inherits it).
 */
export default function ScriptFormatChooser({
  entry,
  onClose,
}: {
  entry: Pick<CalendarEntry, "id" | "series" | "contentCategory"> | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [visual, setVisual] = useState<VisualChoice | null>(null);
  const [text, setText] = useState(true);
  const [images, setImages] = useState(DEFAULT_IMAGES);
  const [seconds, setSeconds] = useState(DEFAULT_SECONDS);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = generationRequest(visual, text, { images, seconds });
  const output: GenerationOutput =
    visual === "animation" ? { kind: "animation" } : visual === "carousel" ? { kind: "images", count: images } : { kind: "text" };

  async function generate() {
    if (!entry || !request || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const { script } = await api.generateScriptForEntry(entry.id, request.contentType, undefined, undefined, request.fields);
      router.push(`/scripts/${script.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Writing failed, please try again.");
      setGenerating(false);
    }
  }

  return (
    <Modal open={entry !== null} onClose={() => !generating && onClose()} width={640}>
      <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 20, margin: "0 0 4px" }}>
        {generating ? "Tellovo is writing your post" : "Which format?"}
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: color.textMuted }}>
        {entry?.series ? entry.series.label : "Free post"}
        {entry ? ` · ${entry.contentCategory.label}` : ""} — a visual, some text, or both in the same post.
      </p>
      {generating ? (
        <GenerationAnimation output={output} />
      ) : (
        <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {(Object.keys(VISUALS) as VisualChoice[]).map((key) => (
          <ChoiceCard
            key={key}
            {...VISUALS[key]}
            selected={visual === key}
            disabled={generating}
            // One visual per post: choosing one replaces the other, clicking again removes it.
            onClick={() => setVisual((current) => (current === key ? null : key))}
          />
        ))}
        <ChoiceCard label="Text" hint="A written post" icon={Type} selected={text} disabled={generating} onClick={() => setText((t) => !t)} />
      </div>
      {visual === "carousel" && (
        <Slider
          label={images <= 1 ? "1 image" : `${images} images · carousel`}
          value={images}
          min={1}
          max={MAX_IMAGES}
          onChange={setImages}
          disabled={generating}
        />
      )}
      {visual === "animation" && (
        <Slider
          label={`Duration · ${seconds} seconds`}
          value={seconds}
          min={MIN_DURATION_MS / 1000}
          max={MAX_DURATION_MS / 1000}
          onChange={setSeconds}
          disabled={generating}
        />
      )}
        </>
      )}
      {error && <p style={{ margin: "16px 0 0", fontSize: 13, color: color.danger }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 22 }}>
        {!request && <span style={{ fontSize: 13, color: color.textMuted }}>Pick at least one format.</span>}
        <Button onClick={generate} disabled={!request || generating}>
          {generating ? "Writing your post…" : "Write"}
        </Button>
      </div>
    </Modal>
  );
}
