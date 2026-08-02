"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { PlatformBadge } from "@/components/ui/Badge";
import { api, ApiClientError, type ContentType, type Product } from "@/lib/apiClient";
import { accent, accentAlpha, color, platformMeta, type Platform } from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";
import { useContentCategories } from "@/contexts/CategoryLabelsContext";
import { useContentSeries } from "@/contexts/SeriesContext";
import { KNOWN_PLATFORMS } from "@/lib/social/types";
import { heading1Style } from "@/components/ui/TextField";

const CONTENT_TYPE_OPTIONS: Array<{ key: ContentType; label: string }> = [
  { key: "video", label: "Vidéo" },
  { key: "visual", label: "Visuel (image / carrousel)" },
  { key: "text", label: "Texte seul" },
];

function formatScheduledDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const label = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(y, m - 1, d)
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function GenerateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduledDate = searchParams.get("date") || undefined;
  const categories = useContentCategories();
  const series = useContentSeries();
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [contentType, setContentType] = useState<ContentType>("video");
  const [categoryId, setCategoryId] = useState<string>("");
  const [seriesId, setSeriesId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProducts().then(({ products }) => setProducts(products));
  }, []);

  const selectedCategoryId = categoryId || categories[0]?.id || "";
  const availableSeries = series.filter((s) => s.categories.some((c) => c.id === selectedCategoryId));
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
      });
      router.push(`/scripts/${script.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la génération du script.");
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 680 }}>
      <h1 style={heading1Style}>Génération libre</h1>
      <p style={{ margin: "6px 0 30px", color: color.textMuted, fontSize: 15 }}>
        {scheduledDate
          ? `Ce script sera placé au calendrier le ${formatScheduledDate(scheduledDate)}.`
          : "Un script à la demande, sans passer par un créneau du calendrier."}
      </p>

      <Card style={{ padding: 30 }}>
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
            {categories.length === 0 && (
              <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>
                Aucune catégorie de contenu configurée pour l&apos;instant.
              </p>
            )}
            {categories.map((c) => {
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
            Produit associé <span style={{ color: color.textFaint, fontWeight: 400 }}>— optionnel</span>
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
            <option value="">Aucun produit — script générique</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 16 }}>{error}</p>}

        <Button fullWidth onClick={handleGenerate} disabled={loading || !selectedCategoryId} style={{ padding: 15, fontSize: 16 }}>
          {loading ? "Génération en cours..." : "Générer le script"}
        </Button>
      </Card>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={null}>
      <GenerateContent />
    </Suspense>
  );
}
