"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Info, MoreHorizontal, RotateCcw } from "lucide-react";
import PlatformLogo from "@/components/calendar/PlatformLogo";
import type { Script } from "@/lib/apiClient";
import { color, fontHeading, platformMeta, scriptStatusOptions, statusMeta, type ScriptStatus } from "@/lib/design/tokens";

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

/** Open/closed, closing on outside click and on Esc. */
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

/** The status as a button: the current value, the list on click. */
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
  if (script.contentType === "text") return "Text";
  if (script.visualFormat === "animation") return `Animation · ${Math.round((script.durationMs ?? 8000) / 1000)}s`;
  if (script.visualFormat === "carousel") return `Carousel · ${script.slideCount ?? script.visualDesign?.slides.length ?? "?"} slides`;
  return "Image";
}

/** The post's brief, behind ⓘ: opens on hover on desktop, on tap on phones. */
export function BriefInfo({ script }: { script: Script }) {
  const { open, setOpen, ref } = useDisclosure();
  const rows: Array<[string, React.ReactNode]> = [
    [
      "Network",
      <span key="p" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <PlatformLogo platform={script.platform} size={16} />
        {platformMeta[script.platform]?.label ?? script.platform}
      </span>,
    ],
    ["Format", formatLabel(script)],
    ["Role", script.contentCategory.label],
  ];
  if (script.angle) rows.push(["Angle", script.angle.label]);
  if (script.product) rows.push(["Topic", script.product.name]);
  if (script.eventTitle) rows.push(["Event", script.eventTitle]);

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label="Post brief" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={iconButton}>
        <Info size={18} />
      </button>
      {open && (
        <div style={{ ...panel, width: 300, padding: 16 }}>
          <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 15, marginBottom: 10 }}>The brief</div>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 13 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: "contents" }}>
                <dt style={{ color: color.textFaint }}>{label}</dt>
                <dd style={{ margin: 0, color: color.text, fontWeight: 600, minWidth: 0 }}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

/** Rare actions, tucked away: another idea, plan, deletion. */
export function ActionsMenu({
  canNewIdea,
  busy,
  onNewIdea,
  onDelete,
}: {
  canNewIdea: boolean;
  busy: boolean;
  onNewIdea: () => void;
  onDelete: () => void;
}) {
  const { open, setOpen, ref } = useDisclosure();
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" aria-label="More actions" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={iconButton}>
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
              ✦ Another idea, same brief
            </button>
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
            Delete this post
          </button>
        </div>
      )}
    </div>
  );
}

export function UndoButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" title="Undo the last change" aria-label="Undo the last change" onClick={onClick} style={iconButton}>
      <RotateCcw size={17} />
    </button>
  );
}
