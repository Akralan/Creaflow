"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { color } from "@/lib/design/tokens";
import { DESIGN_FONTS } from "@/lib/visualDesign/fonts";
import { DEFAULT_ENTER_MS, ENTER_EFFECTS, EXIT_EFFECTS, MAX_ENTER_MS, MIN_ENTER_MS } from "@/lib/visualDesign/timeline";
import type { DesignImage, DesignImageVariant, TimelineEntry } from "@/lib/apiClient";
import type { LayerInfo } from "./designDom";

const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: color.textMuted, marginBottom: 4 };
const input: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${color.inputBorder}`,
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 13,
  fontFamily: "inherit",
  background: color.cardBg,
  boxSizing: "border-box",
};

function px(value: string | undefined): string {
  return value ? value.replace(/px$/, "") : "";
}

function toHex(value: string | undefined): string {
  if (!value) return "#000000";
  if (/^#([0-9a-f]{6})$/i.test(value)) return value;
  if (/^#([0-9a-f]{3})$/i.test(value)) return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
  if (m) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  return "#000000";
}

/** Photo section of the inspector (docs/SPEC_COMPOSITION_VISUELLE.md §2 "Inspector of an image layer"). */
export interface ImageInspectorProps {
  /** Photos declared on the mockup (to replace the layer's photo). */
  images: DesignImage[];
  cutoutAvailable: boolean;
  /** Cutout in progress for this reference. */
  busyRef: string | null;
  onVariant: (ref: string, variant: DesignImageVariant) => void;
  onReplace: (ref: string) => void;
  onImageStyle: (styles: Record<string, string | null>) => void;
}

/**
 * The minimum needed to touch up a layer by hand (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2
 * "Manual editing"): font, size, weight, color, alignment, background, opacity, order,
 * deletion; for a photo, variant, fit, shape, replacement. Everything else goes through
 * the instruction to the agent.
 */
export default function LayerInspector({
  layer,
  onStyle,
  onMove,
  onDelete,
  animation,
  image,
}: {
  layer: LayerInfo;
  onStyle: (styles: Record<string, string | null>) => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
  /** Present for an image layer that displays a photo of the mockup. */
  image?: ImageInspectorProps;
  /** Animated mockup (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §6): this layer's entry in the
   *  timeline (null = visible throughout) and total duration. Absent for a static mockup. */
  animation?: { entry: TimelineEntry | null; durationMs: number; onChange: (entry: TimelineEntry | null) => void };
}) {
  const isText = layer.type === "text";
  return (
    <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600 }}>
          {layer.type === "text" ? "Text" : layer.type === "image" ? "Image" : "Shape"}
          <span style={{ color: color.textFaint, fontWeight: 400 }}> · {layer.id}</span>
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button title="Bring forward" onClick={() => onMove("up")} style={iconBtn}>
            <ArrowUp size={14} />
          </button>
          <button title="Send backward" onClick={() => onMove("down")} style={iconBtn}>
            <ArrowDown size={14} />
          </button>
          <button title="Delete layer" onClick={onDelete} style={{ ...iconBtn, color: color.danger }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {isText && layer.text && (
        <p style={{ margin: 0, fontSize: 12, color: color.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={layer.text}>
          &ldquo;{layer.text}&rdquo;
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={fieldLabel}>X</div>
          <input style={input} type="number" value={px(layer.style.left)} onChange={(e) => onStyle({ left: `${e.target.value}px`, right: null })} />
        </div>
        <div>
          <div style={fieldLabel}>Y</div>
          <input style={input} type="number" value={px(layer.style.top)} onChange={(e) => onStyle({ top: `${e.target.value}px`, bottom: null })} />
        </div>
        <div>
          <div style={fieldLabel}>Width</div>
          <input style={input} type="number" value={px(layer.style.width)} onChange={(e) => onStyle({ width: `${e.target.value}px` })} />
        </div>
        <div>
          <div style={fieldLabel}>Height</div>
          <input style={input} type="number" value={px(layer.style.height)} onChange={(e) => onStyle({ height: e.target.value ? `${e.target.value}px` : null })} />
        </div>
      </div>
      {isText && (
        <>
          <div>
            <div style={fieldLabel}>Font</div>
            <select style={input} value={layer.style["font-family"] ?? ""} onChange={(e) => onStyle({ "font-family": e.target.value || null })}>
              <option value="">(inherited)</option>
              {DESIGN_FONTS.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={fieldLabel}>Size</div>
              <input style={input} type="number" min={8} max={400} value={px(layer.style["font-size"])} onChange={(e) => onStyle({ "font-size": e.target.value ? `${e.target.value}px` : null })} />
            </div>
            <div>
              <div style={fieldLabel}>Weight</div>
              <select style={input} value={layer.style["font-weight"] ?? ""} onChange={(e) => onStyle({ "font-weight": e.target.value || null })}>
                <option value="">(inherited)</option>
                {["300", "400", "500", "600", "700", "800"].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={fieldLabel}>Text color</div>
              <input style={{ ...input, padding: 2, height: 32 }} type="color" value={toHex(layer.style.color)} onChange={(e) => onStyle({ color: e.target.value })} />
            </div>
            <div>
              <div style={fieldLabel}>Alignment</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => onStyle({ "text-align": a })}
                    style={{ ...iconBtn, flex: 1, fontWeight: layer.style["text-align"] === a ? 700 : 400 }}
                    title={a === "left" ? "Left" : a === "center" ? "Center" : "Right"}
                  >
                    {a === "left" ? "⇤" : a === "center" ? "↔" : "⇥"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={fieldLabel}>Background</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              style={{ ...input, padding: 2, height: 32 }}
              type="color"
              value={toHex(layer.style["background-color"] ?? layer.style.background)}
              onChange={(e) => onStyle({ background: null, "background-color": e.target.value })}
            />
            <button title="No background" onClick={() => onStyle({ background: null, "background-color": null })} style={iconBtn}>
              ∅
            </button>
          </div>
        </div>
        <div>
          <div style={fieldLabel}>Opacity</div>
          <input
            style={{ width: "100%" }}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={layer.style.opacity ? Number(layer.style.opacity) : 1}
            onChange={(e) => onStyle({ opacity: Number(e.target.value) === 1 ? null : e.target.value })}
          />
        </div>
      </div>
      {image && layer.imageRef && <ImageSection layer={layer} imageRef={layer.imageRef} onStyle={onStyle} {...image} />}
      {animation && (
        <AnimationSection layerId={layer.id} entry={animation.entry} durationMs={animation.durationMs} onChange={animation.onChange} />
      )}
      <div>
        <div style={fieldLabel}>Corner radius</div>
        <input style={input} type="number" min={0} max={400} value={px(layer.style["border-radius"])} onChange={(e) => onStyle({ "border-radius": e.target.value ? `${e.target.value}px` : null })} />
      </div>
    </div>
  );
}

function ImageSection({
  layer,
  imageRef,
  images,
  cutoutAvailable,
  busyRef,
  onVariant,
  onReplace,
  onImageStyle,
  onStyle,
}: ImageInspectorProps & { layer: LayerInfo; imageRef: string; onStyle: (styles: Record<string, string | null>) => void }) {
  const current = images.find((i) => i.ref === imageRef) ?? null;
  const variant = current?.variant ?? "original";
  const isRound = (layer.style["clip-path"] ?? "").startsWith("circle(");
  const fit = layer.imageStyle["object-fit"] ?? "cover";
  const busy = busyRef === imageRef;
  return (
    <div style={{ borderTop: `1px solid ${color.divider}`, paddingTop: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {current?.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.thumbnailUrl} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: `1px solid ${color.border}` }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={fieldLabel}>Photo</div>
          <select style={input} value={imageRef} onChange={(e) => e.target.value !== imageRef && onReplace(e.target.value)}>
            {images.map((i) => (
              <option key={i.ref} value={i.ref}>
                {i.ref}
                {i.variant === "cutout" ? " · cutout" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <div style={fieldLabel}>Variant</div>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={{ ...iconBtn, flex: 1, fontWeight: variant === "original" ? 700 : 400 }} disabled={busy} onClick={() => onVariant(imageRef, "original")}>
            Original
          </button>
          <button
            style={{ ...iconBtn, flex: 1, fontWeight: variant === "cutout" ? 700 : 400 }}
            disabled={busy || (!cutoutAvailable && !current?.hasCutout)}
            title={!cutoutAvailable && !current?.hasCutout ? "Cutout not configured on this server" : "Subject cut out, transparent background"}
            onClick={() => onVariant(imageRef, "cutout")}
          >
            {busy ? "Cutting out…" : "Cutout"}
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={fieldLabel}>Fit</div>
          <select style={input} value={fit} onChange={(e) => onImageStyle({ "object-fit": e.target.value })}>
            <option value="cover">Fill (crops)</option>
            <option value="contain">Contain (no crop)</option>
          </select>
        </div>
        <div>
          <div style={fieldLabel}>Shape</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={{ ...iconBtn, flex: 1, fontWeight: isRound ? 400 : 700 }} onClick={() => onStyle({ "clip-path": null })}>
              ▭
            </button>
            <button style={{ ...iconBtn, flex: 1, fontWeight: isRound ? 700 : 400 }} title="Round medallion" onClick={() => onStyle({ "clip-path": "circle(50% at 50% 50%)" })}>
              ◯
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ENTER_LABELS: Record<TimelineEntry["enter"], string> = {
  fade: "Fade",
  "slide-up": "Rise",
  "slide-left": "Slide in from the right",
  "zoom-in": "Zoom",
  typewriter: "Typewriter",
};
const EXIT_LABELS: Record<NonNullable<TimelineEntry["exit"]>, string> = {
  fade: "Fade",
  "slide-down": "Drop",
  "slide-right": "Slide out to the right",
  none: "Stays until the end",
};

function AnimationSection({
  layerId,
  entry,
  durationMs,
  onChange,
}: {
  layerId: string;
  entry: TimelineEntry | null;
  durationMs: number;
  onChange: (entry: TimelineEntry | null) => void;
}) {
  const seconds = (ms: number) => Math.round(ms / 100) / 10;
  if (!entry) {
    return (
      <div style={{ borderTop: `1px solid ${color.divider}`, paddingTop: 10 }}>
        <div style={fieldLabel}>Animation</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: color.textMuted }}>
          <span style={{ flex: 1 }}>Visible from start to end.</span>
          <button style={iconBtn} onClick={() => onChange({ layerId, enter: "fade", startMs: 0, enterMs: DEFAULT_ENTER_MS, exit: null, exitAtMs: null })}>
            Animate
          </button>
        </div>
      </div>
    );
  }
  const update = (patch: Partial<TimelineEntry>) => onChange({ ...entry, ...patch });
  return (
    <div style={{ borderTop: `1px solid ${color.divider}`, paddingTop: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ ...fieldLabel, marginBottom: 0 }}>Animation</div>
        <button style={iconBtn} title="This layer stays visible from start to end" onClick={() => onChange(null)}>
          None
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={fieldLabel}>Entrance</div>
          <select style={input} value={entry.enter} onChange={(e) => update({ enter: e.target.value as TimelineEntry["enter"] })}>
            {ENTER_EFFECTS.map((e) => (
              <option key={e} value={e}>
                {ENTER_LABELS[e]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={fieldLabel}>Appears at (s)</div>
          <input
            style={input}
            type="number"
            min={0}
            max={seconds(durationMs)}
            step={0.1}
            value={seconds(entry.startMs)}
            onChange={(e) => update({ startMs: Math.min(durationMs - MIN_ENTER_MS, Math.max(0, Math.round(Number(e.target.value) * 1000))) })}
          />
        </div>
        <div>
          <div style={fieldLabel}>Entrance duration (ms)</div>
          <input
            style={input}
            type="number"
            min={MIN_ENTER_MS}
            max={MAX_ENTER_MS}
            step={50}
            value={entry.enterMs}
            onChange={(e) => update({ enterMs: Math.min(MAX_ENTER_MS, Math.max(MIN_ENTER_MS, Math.round(Number(e.target.value)))) })}
          />
        </div>
        <div>
          <div style={fieldLabel}>Exit</div>
          <select
            style={input}
            value={entry.exit ?? "none"}
            onChange={(e) => {
              const exit = e.target.value as NonNullable<TimelineEntry["exit"]>;
              if (exit === "none") update({ exit: null, exitAtMs: null });
              else update({ exit, exitAtMs: entry.exitAtMs ?? Math.min(durationMs, entry.startMs + entry.enterMs + 2000) });
            }}
          >
            {EXIT_EFFECTS.map((e) => (
              <option key={e} value={e}>
                {EXIT_LABELS[e]}
              </option>
            ))}
          </select>
        </div>
        {entry.exit && (
          <div>
            <div style={fieldLabel}>Disappears at (s)</div>
            <input
              style={input}
              type="number"
              min={seconds(entry.startMs + entry.enterMs)}
              max={seconds(durationMs)}
              step={0.1}
              value={seconds(entry.exitAtMs ?? durationMs)}
              onChange={(e) => update({ exitAtMs: Math.min(durationMs, Math.max(entry.startMs + entry.enterMs + 1, Math.round(Number(e.target.value) * 1000))) })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: color.inputBg,
  border: `1px solid ${color.inputBorder}`,
  borderRadius: 6,
  padding: "4px 8px",
  cursor: "pointer",
  color: color.textMuted,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
  fontSize: 13,
};
