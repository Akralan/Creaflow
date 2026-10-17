"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { api, ApiClientError, type PortraitReader, type Product, type ReaderPortrait } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

const FIELDS: Array<{ key: Exclude<keyof PortraitReader, "label" | "words">; label: string }> = [
  { key: "who", label: "Who" },
  { key: "knows", label: "Already knows" },
  { key: "wants", label: "Comes looking for" },
  { key: "stopsFor", label: "Stops for" },
  { key: "turnsOff", label: "Turned off by" },
];

/**
 * Reader portrait of a topic (docs/SPEC_PROMPT_GENERATION_V3.md §2.2): read by the generation
 * before each post. Read-only by default; "Edit" corrects it by hand (it is then no longer
 * replaced automatically), "Redo the portrait" rebuilds it from the topic and its material.
 */
export default function ReaderPortraitPanel({ product, onUpdated }: { product: Product; onUpdated: (product: Product) => void }) {
  const [editing, setEditing] = useState<PortraitReader[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portrait = product.readerPortrait;

  async function run(action: () => Promise<{ readerPortrait: ReaderPortrait }>) {
    setBusy(true);
    setError(null);
    try {
      const { readerPortrait } = await action();
      onUpdated({ ...product, readerPortrait });
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while saving.");
    } finally {
      setBusy(false);
    }
  }

  function updateReader(index: number, patch: Partial<PortraitReader>) {
    setEditing((cur) => cur && cur.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary }}>Reader portrait</div>

      {!portrait && !editing && (
        <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>
          No portrait yet. It builds itself after you save &ldquo;Who it&apos;s for&rdquo;, or right away with the button below.
        </p>
      )}

      {portrait && !editing &&
        portrait.readers.map((reader, index) => (
          <div key={index} style={{ border: `1px solid ${color.border}`, borderRadius: 10, padding: 10, fontSize: 13, display: "grid", gap: 3 }}>
            <div style={{ fontWeight: 600 }}>
              {reader.label}
              {index === 0 && portrait.readers.length > 1 && <span style={{ color: color.textMuted, fontWeight: 400 }}> · main audience</span>}
            </div>
            {FIELDS.map(({ key, label }) =>
              reader[key] ? (
                <div key={key} style={{ color: color.textSecondary }}>
                  <span style={{ color: color.textMuted }}>{label} : </span>
                  {reader[key]}
                </div>
              ) : null
            )}
            {reader.words.length > 0 && (
              <div style={{ color: color.textSecondary }}>
                <span style={{ color: color.textMuted }}>Their words: </span>
                {reader.words.join(", ")}
              </div>
            )}
          </div>
        ))}

      {editing &&
        editing.map((reader, index) => (
          <div key={index} style={{ border: `1px solid ${color.border}`, borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
            <TextField label="Audience name" value={reader.label} onChange={(e) => updateReader(index, { label: e.target.value })} />
            {FIELDS.map(({ key, label }) => (
              <TextField key={key} label={label} value={reader[key]} onChange={(e) => updateReader(index, { [key]: e.target.value })} />
            ))}
            <TextField
              label="Their words (comma-separated)"
              value={reader.words.join(", ")}
              onChange={(e) => updateReader(index, { words: e.target.value.split(",").map((w) => w.trim()).filter(Boolean) })}
            />
            {editing.length > 1 && (
              <button
                onClick={() => setEditing((cur) => cur && cur.filter((_, i) => i !== index))}
                style={{ justifySelf: "start", fontSize: 12, color: color.danger, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Remove this audience
              </button>
            )}
          </div>
        ))}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {editing ? (
          <>
            <Button
              variant="secondary"
              disabled={busy || editing.some((r) => !r.label.trim() || !r.who.trim())}
              onClick={() => run(() => api.saveReaderPortrait(product.id, editing))}
            >
              {busy ? "..." : "Save portrait"}
            </Button>
            {editing.length < 3 && (
              <Button
                variant="secondary"
                onClick={() => setEditing((cur) => cur && [...cur, { label: "", who: "", knows: "", wants: "", stopsFor: "", turnsOff: "", words: [] }])}
              >
                + Add an audience
              </Button>
            )}
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            {portrait && (
              <Button variant="secondary" onClick={() => setEditing(portrait.readers.map((r) => ({ ...r, words: [...r.words] })))}>
                Edit
              </Button>
            )}
            <Button variant="secondary" onClick={() => run(() => api.regenerateReaderPortrait(product.id))} disabled={busy}>
              {busy ? "Reading…" : portrait ? "Redo the portrait" : "Build the portrait"}
            </Button>
          </>
        )}
        {error && <span style={{ fontSize: 12, color: color.danger }}>{error}</span>}
      </div>
    </div>
  );
}
