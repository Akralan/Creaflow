"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { PenLine } from "lucide-react";
import PlatformLogo from "@/components/calendar/PlatformLogo";
import { toRenderableHtml } from "@/components/DesignEditor/designDom";
import type { WeekEntry } from "@/lib/apiClient";
import { accent, accentAlpha, fontHeading, fontMono, statusMeta } from "@/lib/design/tokens";
import { platformMeta } from "@/lib/design/tokens";
import styles from "./calendar.module.css";

/** Teintes de la landing (src/components/landing/theme.ts) : le calendrier parle la même langue. */
const ink = {
  heading: "#1b1713",
  body: "#221d19",
  secondary: "#574d45",
  faint: "#8a7f74",
  card: "#fffdfa",
};

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** « MER. 15 OCT. » — les créneaux sont stockés à minuit UTC, on les lit donc en UTC. */
export function dayLabel(iso: string): string {
  return DAY_FORMAT.format(new Date(iso)).replace(/\./g, "").toUpperCase();
}

function platformLabel(platform: string) {
  return platformMeta[platform]?.label ?? platform;
}

function formatBadge(script: NonNullable<WeekEntry["script"]>): string {
  if (script.contentType === "text") return "Texte";
  if (script.visualFormat === "animation") return `Animation · ${Math.round((script.durationMs ?? 8000) / 1000)} s`;
  if (script.visualFormat === "carousel") return `Carrousel · 1/${script.preview?.slideCount ?? script.slideCount ?? "…"}`;
  return "Image";
}

/** Première slide de la maquette, mise à l'échelle de la carte et centrée sur fond sombre. */
function DesignPreview({ scriptId, preview, hasLogo }: { scriptId: string; preview: NonNullable<NonNullable<WeekEntry["script"]>["preview"]>; hasLogo: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = box ? Math.min(box.w / preview.width, box.h / preview.height) : 0;
  const html = toRenderableHtml(preview.html, {
    images: Object.fromEntries(
      preview.images.map((img) => [img.ref, `/api/scripts/${scriptId}/design/images/${img.ref}?v=${img.assetId}:${img.variant}`])
    ),
    logoUrl: hasLogo ? `/api/scripts/${scriptId}/design/logo` : null,
  });

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0, background: "#1b1713", overflow: "hidden" }}>
      {box && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            width: preview.width,
            height: preview.height,
            left: (box.w - preview.width * scale) / 2,
            top: (box.h - preview.height * scale) / 2,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
            background: "#fff",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

function StatusChip({ status }: { status: NonNullable<WeekEntry["script"]>["status"] }) {
  const meta = statusMeta[status];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.fg, background: meta.bg, borderRadius: 999, padding: "3px 8px" }}>
      {meta.label}
    </span>
  );
}

/**
 * Un post encore vide, en verre irisé : la série, le titre de l'épisode prévu par le plan (sinon
 * « Post à venir »), le projet relié, et l'invitation à le rédiger.
 */
function HoloBody({ entry }: { entry: WeekEntry }) {
  const upcoming = entry.upcoming;
  return (
    <div style={{ position: "absolute", inset: 0, padding: 18, display: "flex", flexDirection: "column", zIndex: 1 }}>
      <span style={{ alignSelf: "flex-start", fontSize: 11.5, fontWeight: 600, color: "#4d3778", background: "rgba(255,253,250,0.7)", borderRadius: 999, padding: "4px 9px" }}>
        {entry.series?.label ?? "Post libre"}
      </span>
      <div style={{ marginTop: "auto" }}>
        <p
          className={styles.clamp3}
          style={{ margin: 0, fontFamily: fontHeading, fontWeight: 700, fontSize: upcoming?.title ? 19 : 21, lineHeight: 1.15, letterSpacing: "-0.02em", color: upcoming?.title ? ink.heading : "rgba(34,29,25,0.45)" }}
        >
          {upcoming?.title ?? "Post à venir"}
        </p>
        {upcoming?.project && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12.5, color: ink.secondary }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
            {upcoming.project}
          </div>
        )}
        <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600, color: "#4d3778" }}>Rédiger →</div>
      </div>
    </div>
  );
}

/**
 * Un créneau de la semaine, affiché comme le post qu'il sera (même langage que les cartes de la
 * landing) : la maquette pour un visuel, le début du texte pour un post écrit, une carte en
 * pointillés « à rédiger » pour un créneau vide.
 */
export default function WeekPostCard({
  entry,
  authorName,
  hasLogo,
  isPast,
  onOpen,
  onEditSlot,
  kicker,
}: {
  entry: WeekEntry;
  authorName: string;
  hasLogo: boolean;
  isPast: boolean;
  onOpen: () => void;
  onEditSlot: () => void;
  /** Mention avant la date (ex. « Post suivant »), pour la carte qui prolonge la semaine. */
  kicker?: string;
}) {
  const script = entry.script;
  const seriesLabel = entry.series?.label ?? "Post libre";
  const className = `${styles.card} ${!script ? styles.holo : ""} ${isPast ? styles.past : ""}`;

  let body: React.ReactNode;
  if (!script) {
    body = <HoloBody entry={entry} />;
  } else if (script.contentType === "visual" && script.preview) {
    body = (
      <>
        <DesignPreview scriptId={script.id} preview={script.preview} hasLogo={hasLogo} />
        <span className={styles.badge} style={{ background: "rgba(255,253,250,0.92)", color: ink.body }}>
          {formatBadge(script)}
        </span>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "28px 12px 12px",
            background: "linear-gradient(to top, rgba(20,16,12,0.8), rgba(20,16,12,0))",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <StatusChip status={script.status} />
        </div>
      </>
    );
  } else if (script.contentType === "visual") {
    // Maquette pas encore composée : la carte « motion » de la landing, avec le titre.
    body = (
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, oklch(0.32 0.12 292) 0%, oklch(0.2 0.06 292) 100%)" }}>
        <span className={styles.blob} />
        <span className={styles.badge} style={{ background: "rgba(255,253,250,0.14)", color: "#fffdfa" }}>
          {formatBadge(script)}
        </span>
        <p
          className={styles.clamp5}
          style={{ position: "absolute", left: 16, right: 16, top: "50%", transform: "translateY(-50%)", margin: 0, color: "#fffdfa", fontFamily: fontHeading, fontWeight: 700, fontSize: 22, lineHeight: 1.1, letterSpacing: "-0.03em" }}
        >
          {script.title ?? "Sans titre"}
        </p>
        <div style={{ position: "absolute", left: 12, bottom: 12 }}>
          <StatusChip status={script.status} />
        </div>
      </div>
    );
  } else {
    body = (
      <div style={{ position: "absolute", inset: 0, background: ink.card, border: "1px solid rgba(34,29,25,0.08)", borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg, ${accentAlpha(0.6)}, ${accent})`, flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: ink.heading, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {authorName || "Toi"}
            </span>
            <span style={{ display: "block", fontSize: 11, color: ink.faint, fontFamily: fontMono }}>
              {platformLabel(entry.platform)} · texte
            </span>
          </span>
        </div>
        <p className={styles.clamp3} style={{ margin: 0, fontFamily: fontHeading, fontWeight: 700, fontSize: 17, lineHeight: 1.22, letterSpacing: "-0.015em", color: ink.heading }}>
          {script.hookText || script.title || "Sans titre"}
        </p>
        {script.caption && (
          <p className={styles.clamp5} style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: ink.secondary }}>
            {script.caption}
          </p>
        )}
        <div style={{ marginTop: "auto" }}>
          <StatusChip status={script.status} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.slot}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fontMono, fontSize: 11.5, letterSpacing: "0.06em", color: ink.secondary }}>
        <PlatformLogo platform={entry.platform} size={18} />
        {kicker && <span style={{ color: "#4d3778", fontWeight: 700 }}>{kicker.toUpperCase()} ·</span>}
        <span>{dayLabel(entry.scheduledDate)}</span>
      </div>
      <div style={{ position: "relative" }}>
        <button type="button" className={className} onClick={onOpen} aria-label={script ? `Ouvrir « ${script.title ?? "Sans titre"} »` : `Rédiger le post du ${dayLabel(entry.scheduledDate)}`}>
          {body}
        </button>
        {!script && (
          <button
            type="button"
            onClick={onEditSlot}
            title="Modifier ce créneau"
            aria-label="Modifier ce créneau"
            style={{ position: "absolute", top: 10, right: 10, zIndex: 2, width: 30, height: 30, borderRadius: 9, border: "1px solid rgba(255,255,255,0.8)", background: "rgba(255,253,250,0.75)", color: ink.secondary, display: "grid", placeItems: "center", cursor: "pointer" }}
          >
            <PenLine size={14} />
          </button>
        )}
      </div>
      {script && <span style={{ fontSize: 12.5, color: ink.faint, paddingLeft: 2 }}>{seriesLabel}</span>}
    </div>
  );
}

/** Version téléphone : une ligne par post, la date, le réseau et le titre. */
export function WeekPostRow({ entry, isPast, onOpen, kicker }: { entry: WeekEntry; isPast: boolean; onOpen: () => void; kicker?: string }) {
  const script = entry.script;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={script ? undefined : styles.holo}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        padding: "14px 14px",
        borderRadius: 14,
        border: script ? "1px solid rgba(34,29,25,0.08)" : "none",
        ...(script ? { background: ink.card } : {}),
        opacity: isPast ? 0.55 : 1,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      <PlatformLogo platform={entry.platform} size={22} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: fontMono, fontSize: 11, letterSpacing: "0.06em", color: ink.faint }}>
          {kicker ? `${kicker.toUpperCase()} · ` : ""}
          {dayLabel(entry.scheduledDate)}
        </span>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: script || entry.upcoming?.title ? ink.heading : "rgba(34,29,25,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {script ? (script.title ?? "Sans titre") : (entry.upcoming?.title ?? `Post à venir · ${entry.series?.label ?? "Post libre"}`)}
        </span>
        {!script && entry.upcoming?.project && (
          <span style={{ display: "block", fontSize: 12, color: ink.secondary }}>{entry.upcoming.project}</span>
        )}
      </span>
      {script && <StatusChip status={script.status} />}
    </button>
  );
}
