"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Info, MoreHorizontal, RotateCcw } from "lucide-react";
import PlatformLogo from "@/components/calendar/PlatformLogo";
import type { Script } from "@/lib/apiClient";
import { accent, color, fontHeading, platformMeta, scriptStatusOptions, statusMeta, type ScriptStatus } from "@/lib/design/tokens";

const panel: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  zIndex: 40,
  background: "#fffdfa",
  border: "1px solid rgba(34,29,25,0.1)",
  borderRadius: 14,
  boxShadow: "0 24px 48px -24px rgba(34,29,25,0.35)",
  padding: 6,
  minWidth: 200,
};

export const iconButton: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 11,
  border: "1px solid rgba(34,29,25,0.1)",
  background: "#fffdfa",
  color: "#574d45",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

/** Ouvert/fermé, avec fermeture au clic extérieur et à Échap. */
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const menuItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  textAlign: "left",
  padding: "9px 12px",
  borderRadius: 9,
  border: "none",
  background: "none",
  fontFamily: "inherit",
  fontSize: 14,
  color: color.text,
  cursor: "pointer",
  textDecoration: "none",
};

/** Le statut en un bouton : la valeur courante, la liste au clic. */
export function StatusDropdown({ status, onChange }: { status: ScriptStatus; onChange: (s: ScriptStatus) => void }) {
  const { open, setOpen, ref } = useDisclosure();
  const meta = statusMeta[status];
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, border: "none", background: meta.bg, color: meta.fg, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        {meta.label}
        <ChevronDown size={14} strokeWidth={2.4} />
      </button>
      {open && (
        <div role="listbox" style={{ ...panel, minWidth: 170 }}>
          {scriptStatusOptions.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === status}
              onClick={() => {
                setOpen(false);
                if (s !== status) onChange(s);
              }}
              style={{ ...menuItem, fontWeight: s === status ? 700 : 500 }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusMeta[s].fg }} />
              {statusMeta[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatLabel(script: Script): string {
  if (script.contentType === "text") return "Texte";
  if (script.visualFormat === "animation") return `Animation · ${Math.round((script.durationMs ?? 8000) / 1000)} s`;
  if (script.visualFormat === "carousel") return `Carrousel · ${script.slideCount ?? script.visualDesign?.slides.length ?? "?"} slides`;
  return "Image";
}

/** Le brief du post, derrière ⓘ : ouvert au survol sur ordinateur, au toucher sur téléphone. */
export function BriefInfo({ script }: { script: Script }) {
  const { open, setOpen, ref } = useDisclosure();
  const rows: Array<[string, React.ReactNode]> = [
    [
      "Réseau",
      <span key="p" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <PlatformLogo platform={script.platform} size={16} />
        {platformMeta[script.platform]?.label ?? script.platform}
      </span>,
    ],
    ["Format", formatLabel(script)],
    ["Série", script.series?.label ?? "Post libre"],
    ["Rôle", script.contentCategory.label],
  ];
  if (script.angle) rows.push(["Angle", script.angle.label]);
  if (script.product) rows.push(["Sujet", script.product.name]);
  if (script.eventTitle) rows.push(["Événement", script.eventTitle]);

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label="Brief du post" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={iconButton}>
        <Info size={18} />
      </button>
      {open && (
        <div style={{ ...panel, width: 300, padding: 16 }}>
          <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Le brief</div>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 13 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: "contents" }}>
                <dt style={{ color: color.textFaint }}>{label}</dt>
                <dd style={{ margin: 0, color: color.text, fontWeight: 600, minWidth: 0 }}>{value}</dd>
              </div>
            ))}
          </dl>
          {script.series && (
            <Link href="/direction" style={{ display: "inline-block", marginTop: 14, fontSize: 13, fontWeight: 600, color: accent, textDecoration: "none" }}>
              Voir le plan de la série →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** Actions rares, rangées : autre idée, plan, suppression. */
export function ActionsMenu({
  canNewIdea,
  hasSeries,
  busy,
  onNewIdea,
  onDelete,
}: {
  canNewIdea: boolean;
  hasSeries: boolean;
  busy: boolean;
  onNewIdea: () => void;
  onDelete: () => void;
}) {
  const { open, setOpen, ref } = useDisclosure();
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" aria-label="Plus d'actions" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={iconButton}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div role="menu" style={{ ...panel, minWidth: 230 }}>
          {canNewIdea && (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onNewIdea();
              }}
              style={menuItem}
            >
              ✦ Autre idée, même brief
            </button>
          )}
          {hasSeries && (
            <Link href="/direction" role="menuitem" style={menuItem}>
              ◈ Voir le plan de la série
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            style={{ ...menuItem, color: color.danger }}
          >
            Supprimer ce post
          </button>
        </div>
      )}
    </div>
  );
}

export function UndoButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" title="Annuler la dernière modification" aria-label="Annuler la dernière modification" onClick={onClick} style={iconButton}>
      <RotateCcw size={17} />
    </button>
  );
}
