"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { PlatformBadge } from "@/components/ui/Badge";
import { api, ApiClientError, type ContentType, type Product, type Script } from "@/lib/apiClient";
import { accent, accentAlpha, color, platformMeta, type Platform } from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";
import { useContentCategories } from "@/contexts/CategoryLabelsContext";
import { useContentSeries } from "@/contexts/SeriesContext";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

const CONTENT_TYPE_OPTIONS: Array<{ key: ContentType; label: string }> = [
  { key: "video", label: "Vidéo" },
  { key: "visual", label: "Visuel (image / carrousel)" },
  { key: "text", label: "Texte seul" },
];

export interface GenerateFormProps {
  scheduledDate?: string;
  onGenerated: (script: Script) => void;
}

export default function GenerateForm({ scheduledDate, onGenerated }: GenerateFormProps) {
  const categories = useContentCategories();
  const series = useContentSeries();
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [contentType, setContentType] = useState<ContentType>("video");
  const [categoryId, setCategoryId] = useState<string>("");
  const [seriesId, setSeriesId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [directive, setDirective] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProducts().then(({ products }) => setProducts(products));
  }, []);

  const availableCategories = categories.filter((c) => c.platforms.length === 0 || c.platforms.includes(platform));
  const selectedCategoryId = availableCategories.some((c) => c.id === categoryId)
    ? categoryId
    : availableCategories[0]?.id || "";
  const availableSeries = series.filter(
    (s) =>
      s.categories.some((c) => c.id === selectedCategoryId) &&
      (s.platforms.length === 0 || s.platforms.includes(platform))
  );
  const selectedSeriesId = availableSeries.some((s) => s.id === seriesId) ? seriesId : "";

  async function handleGenerate() {
    if (!selectedCategoryId) return;
    setLoading(true);
    setError(null);
    try {
      const { script } = await api.generateFreeformScript({
        platform,
        contentCategoryId: selectedCategoryId,
        contentType,
        productId: productId || undefined,
        seriesId: selectedSeriesId || undefined,
        scheduledDate,
        directive: directive.trim() || undefined,
      });
      onGenerated(script);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la génération du script.");
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 26 }}>
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

      <div style={{ marginBottom: 26 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: color.text3, marginBottom: 12 }}>
          Catégorie de contenu
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {availableCategories.length === 0 && (
            <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>
              Aucune catégorie de contenu configurée pour cette plateforme.
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

      {availableSeries.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: color.text3, marginBottom: 12 }}>
            Série <span style={{ color: color.textFaint, fontWeight: 400 }}>— optionnel</span>
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setSeriesId("")}
              style={{
                border: `1.5px solid ${selectedSeriesId === "" ? accent : color.border}`,
                background: selectedSeriesId === "" ? accentAlpha(0.07) : color.inputBg,
                borderRadius: 20,
                padding: "9px 16px",
                fontWeight: selectedSeriesId === "" ? 600 : 500,
                color: selectedSeriesId === "" ? "oklch(0.45 0.2 292)" : color.textMuted,
                cursor: "pointer",
              }}
            >
              Aucune série
            </button>
            {availableSeries.map((s) => {
              const active = s.id === selectedSeriesId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSeriesId(s.id)}
                  style={{
                    border: `1.5px solid ${active ? accent : color.border}`,
                    background: active ? accentAlpha(0.07) : color.inputBg,
                    borderRadius: 20,
                    padding: "9px 16px",
                    fontWeight: active ? 600 : 500,
                    color: active ? "oklch(0.45 0.2 292)" : color.textMuted,
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 26 }}>
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

      <div style={{ marginBottom: 30 }}>
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
          <option value="">Aucun sujet — script générique</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 26 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: color.text3, marginBottom: 6 }}>
          Une idée en tête ? <span style={{ color: color.textFaint, fontWeight: 400 }}>— optionnel</span>
        </label>
        <textarea
          value={directive}
          onChange={(e) => setDirective(e.target.value)}
          placeholder="Une piste à interpréter, pas un texte à recopier..."
          rows={2}
          maxLength={500}
          style={{
            width: "100%",
            border: `1px solid ${color.inputBorder}`,
            borderRadius: 11,
            padding: "13px 14px",
            fontSize: 15,
            lineHeight: 1.4,
            fontFamily: "inherit",
            background: color.inputBg,
            color: color.text,
            resize: "vertical",
          }}
        />
      </div>

      {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <Button fullWidth onClick={handleGenerate} disabled={loading || !selectedCategoryId} style={{ padding: 15, fontSize: 16 }}>
        {loading ? "Génération en cours..." : "Générer le script"}
      </Button>
    </div>
  );
}
