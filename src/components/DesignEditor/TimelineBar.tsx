"use client";

import { Pause, Play } from "lucide-react";
import { color } from "@/lib/design/tokens";
import { MAX_DURATION_MS, MIN_DURATION_MS } from "@/lib/visualDesign/visualFormat";

/** Barre de temps d'une animation (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §6) : lecture, curseur, durée. */
export default function TimelineBar({
  durationMs,
  playheadMs,
  playing,
  disabled,
  onPlayingChange,
  onSeek,
  onDurationChange,
}: {
  durationMs: number;
  playheadMs: number;
  playing: boolean;
  disabled?: boolean;
  onPlayingChange: (playing: boolean) => void;
  onSeek: (ms: number) => void;
  onDurationChange: (ms: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
      <button
        onClick={() => onPlayingChange(!playing)}
        disabled={disabled}
        title={playing ? "Pause" : "Lecture"}
        style={{
          background: color.inputBg,
          border: `1px solid ${color.inputBorder}`,
          borderRadius: 8,
          padding: "6px 8px",
          cursor: "pointer",
          color: color.textMuted,
          display: "inline-flex",
        }}
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <input
        type="range"
        min={0}
        max={durationMs}
        step={33}
        value={Math.min(durationMs, playheadMs)}
        disabled={disabled}
        onChange={(e) => {
          onPlayingChange(false);
          onSeek(Number(e.target.value));
        }}
        style={{ flex: 1 }}
      />
      <span style={{ fontSize: 12, color: color.textMuted, fontVariantNumeric: "tabular-nums", minWidth: 74 }}>
        {(playheadMs / 1000).toFixed(1)} s / {(durationMs / 1000).toFixed(0)} s
      </span>
      <input
        type="number"
        min={MIN_DURATION_MS / 1000}
        max={MAX_DURATION_MS / 1000}
        value={Math.round(durationMs / 1000)}
        disabled={disabled}
        title="Durée totale (secondes)"
        onChange={(e) => {
          const seconds = Math.min(MAX_DURATION_MS / 1000, Math.max(MIN_DURATION_MS / 1000, Number(e.target.value) || MIN_DURATION_MS / 1000));
          onDurationChange(seconds * 1000);
        }}
        style={{ width: 56, border: `1px solid ${color.inputBorder}`, borderRadius: 8, padding: "5px 6px", fontSize: 12, fontFamily: "inherit", background: color.cardBg }}
      />
    </div>
  );
}
