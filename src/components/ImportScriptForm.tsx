"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/TextField";
import { PlatformBadge } from "@/components/ui/Badge";
import { api, ApiClientError, type ContentType, type Product, type Script } from "@/lib/apiClient";
import { accent, accentAlpha, color, platformMeta, type Platform } from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";
import { useContentCategories } from "@/contexts/CategoryLabelsContext";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

const CONTENT_TYPE_OPTIONS: Array<{ key: ContentType; label: string }> = [
  { key: "video", label: "Vidéo" },
  { key: "visual", label: "Visuel (image / carrousel)" },
  { key: "text", label: "Texte seul" },
];

export interface ImportScriptFormProps {
  scheduledDate?: string;
  calendarEntryId?: string;
  onImported: (script: Script) => void;
}

/** Écriture ailleurs, suivi ici (docs/SPEC_MATIERE_EDITEUR.md §2) — aucun appel LLM, aucun quota. */
export default function ImportScriptForm({ scheduledDate, calendarEntryId, onImported }: ImportScriptFormProps) {
  const categories = useContentCategories();
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [categoryId, setCategoryId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProducts().then(({ products }) => setProducts(products));
  }, []);

  const availableCategories = categories.filter((c) => c.platforms.length === 0 || c.platforms.includes(platform));
  const selectedCategoryId = availableCategories.some((c) => c.id === categoryId)
    ? categoryId
    : availableCategories[0]?.id || "";

  async function handleImport() {
    if (!selectedCategoryId || !title.trim() || !caption.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { script } = await api.importScript({
        platform,
        contentCategoryId: selectedCategoryId,
        contentType,
        productId: productId || undefined,
        scheduledDate,
        calendarEntryId,
        title: title.trim(),
        caption: caption.trim(),
        hashtags: hashtags
          .split(/[\s,]+/)
          .map((h) => h.trim())
          .filter(Boolean),
        hookText: contentType !== "visual" ? caption.split(/\n/)[0]?.slice(0, 120) || undefined : undefined,
      });
      onImported(script);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'import du script.");
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: color.text3, marginBottom: 12 }}>
          Plateforme cible
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {KNOWN_PLATFORMS.map(({ key: p }) => {
            const active = p === platform;
            return (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                style={{
                  flex: "1 1 140px",
                  border: `1.5px solid ${active ? accent : color.border}`,
                  background: active ? accentAlpha(0.07) : color.inputBg,
                  borderRadius: 12,
                  padding: 14,
                  textAlign: "center",
                  fontWeight: active ? 600 : 500,
                  color: active ? "oklch(0.45 0.2 292)" : color.textMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <PlatformBadge platform={p} />
                {platformMeta[p].label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: color.text3, marginBottom: 12 }}>
          Rôle
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {availableCategories.length === 0 && (
            <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>
              Aucun rôle configuré pour cette plateforme.
            </p>
          )}
          {availableCategories.map((c) => {
            const active = c.id === selectedCategoryId;
            const meta = resolveCategoryMeta(c);
            return (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                style={{
                  flex: 1,
                  minWidth: 120,
                  border: `1.5px solid ${active ? meta.base : color.border}`,
                  background: active ? meta.bg : color.inputBg,
                  borderRadius: 12,
                  padding: 14,
                  textAlign: "center",
                  fontWeight: active ? 600 : 500,
                  color: active ? meta.fg : color.textMuted,
                  cursor: "pointer",
                }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: color.text3, marginBottom: 12 }}>
          Type de contenu
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {CONTENT_TYPE_OPTIONS.map(({ key: ct, label }) => {
            const active = ct === contentType;
            return (
              <button
                key={ct}
                onClick={() => setContentType(ct)}
                style={{
                  flex: "1 1 140px",
                  border: `1.5px solid ${active ? accent : color.border}`,
                  background: active ? accentAlpha(0.07) : color.inputBg,
                  borderRadius: 12,
                  padding: 14,
                  textAlign: "center",
                  fontWeight: active ? 600 : 500,
                  color: active ? "oklch(0.45 0.2 292)" : color.textMuted,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: color.text3, marginBottom: 6 }}>
          Sujet associé <span style={{ color: color.textFaint, fontWeight: 400 }}>— optionnel</span>
        </label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          style={{
            width: "100%",
            border: `1px solid ${color.inputBorder}`,
            borderRadius: 11,
            padding: "13px 14px",
            fontSize: 15,
            fontFamily: "inherit",
            background: color.inputBg,
            color: color.text,
          }}
        >
          <option value="">Aucun sujet</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 18 }}>
        <TextField label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du script" />
      </div>
      <div style={{ marginBottom: 18 }}>
        <TextAreaField
          label="Texte / légende"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Colle ici le texte déjà écrit"
          rows={6}
        />
      </div>
      <div style={{ marginBottom: 26 }}>
        <TextField
          label="Hashtags"
          optional
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          placeholder="#marque #niche (séparés par des espaces)"
        />
      </div>

      {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <Button
        fullWidth
        onClick={handleImport}
        disabled={loading || !selectedCategoryId || !title.trim() || !caption.trim()}
        style={{ padding: 15, fontSize: 16 }}
      >
        {loading ? "Import en cours..." : "Importer ce script"}
      </Button>
    </div>
  );
}
