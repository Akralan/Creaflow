"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { color } from "@/lib/design/tokens";
import { DESIGN_FONTS } from "@/lib/visualDesign/fonts";
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

/**
 * Le minimum utile pour retoucher un calque à la main (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2
 * « Édition manuelle ») : police, taille, graisse, couleur, alignement, fond, opacité, ordre,
 * suppression. Tout le reste passe par l'instruction à l'agent.
 */
export default function LayerInspector({
  layer,
  onStyle,
  onMove,
  onDelete,
}: {
  layer: LayerInfo;
  onStyle: (styles: Record<string, string | null>) => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}) {
  const isText = layer.type === "text";
  return (
    <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600 }}>
          {layer.type === "text" ? "Texte" : layer.type === "image" ? "Image" : "Forme"}
          <span style={{ color: color.textFaint, fontWeight: 400 }}> · {layer.id}</span>
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button title="Passer au-dessus" onClick={() => onMove("up")} style={iconBtn}>
            <ArrowUp size={14} />
          </button>
          <button title="Passer en dessous" onClick={() => onMove("down")} style={iconBtn}>
            <ArrowDown size={14} />
          </button>
          <button title="Supprimer le calque" onClick={onDelete} style={{ ...iconBtn, color: color.danger }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {isText && layer.text && (
        <p style={{ margin: 0, fontSize: 12, color: color.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={layer.text}>
          « {layer.text} »
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
          <div style={fieldLabel}>Largeur</div>
          <input style={input} type="number" value={px(layer.style.width)} onChange={(e) => onStyle({ width: `${e.target.value}px` })} />
        </div>
        <div>
          <div style={fieldLabel}>Hauteur</div>
          <input style={input} type="number" value={px(layer.style.height)} onChange={(e) => onStyle({ height: e.target.value ? `${e.target.value}px` : null })} />
        </div>
      </div>
      {isText && (
        <>
          <div>
            <div style={fieldLabel}>Police</div>
            <select style={input} value={layer.style["font-family"] ?? ""} onChange={(e) => onStyle({ "font-family": e.target.value || null })}>
              <option value="">(héritée)</option>
              {DESIGN_FONTS.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={fieldLabel}>Taille</div>
              <input style={input} type="number" min={8} max={400} value={px(layer.style["font-size"])} onChange={(e) => onStyle({ "font-size": e.target.value ? `${e.target.value}px` : null })} />
            </div>
            <div>
              <div style={fieldLabel}>Graisse</div>
              <select style={input} value={layer.style["font-weight"] ?? ""} onChange={(e) => onStyle({ "font-weight": e.target.value || null })}>
                <option value="">(héritée)</option>
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
              <div style={fieldLabel}>Couleur du texte</div>
              <input style={{ ...input, padding: 2, height: 32 }} type="color" value={toHex(layer.style.color)} onChange={(e) => onStyle({ color: e.target.value })} />
            </div>
            <div>
              <div style={fieldLabel}>Alignement</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => onStyle({ "text-align": a })}
                    style={{ ...iconBtn, flex: 1, fontWeight: layer.style["text-align"] === a ? 700 : 400 }}
                    title={a === "left" ? "Gauche" : a === "center" ? "Centré" : "Droite"}
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
          <div style={fieldLabel}>Fond</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              style={{ ...input, padding: 2, height: 32 }}
              type="color"
              value={toHex(layer.style["background-color"] ?? layer.style.background)}
              onChange={(e) => onStyle({ background: null, "background-color": e.target.value })}
            />
            <button title="Sans fond" onClick={() => onStyle({ background: null, "background-color": null })} style={iconBtn}>
              ∅
            </button>
          </div>
        </div>
        <div>
          <div style={fieldLabel}>Opacité</div>
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
      <div>
        <div style={fieldLabel}>Arrondi</div>
        <input style={input} type="number" min={0} max={400} value={px(layer.style["border-radius"])} onChange={(e) => onStyle({ "border-radius": e.target.value ? `${e.target.value}px` : null })} />
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
