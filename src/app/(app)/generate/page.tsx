"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { PlatformBadge } from "@/components/ui/Badge";
import { api, ApiClientError, type Product } from "@/lib/apiClient";
import {
  accent,
  accentAlpha,
  color,
  contentCategoryOptions,
  platformMeta,
  platformOptions,
  type ContentCategory,
  type Platform,
} from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";
import { useCategoryLabels } from "@/contexts/CategoryLabelsContext";
import { heading1Style } from "@/components/ui/TextField";

export default function GeneratePage() {
  const router = useRouter();
  const customLabels = useCategoryLabels();
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [category, setCategory] = useState<ContentCategory>("coulisses");
  const [productId, setProductId] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProducts().then(({ products }) => setProducts(products));
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const { script } = await api.generateFreeformScript({
        platform,
        contentCategory: category,
        productId: productId || undefined,
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
        Un script à la demande, sans passer par un créneau du calendrier.
      </p>

      <Card style={{ padding: 30 }}>
        <div style={{ marginBottom: 26 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: color.text3, marginBottom: 12 }}>
            Plateforme cible
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            {platformOptions.map((p) => {
              const active = p === platform;
              return (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  style={{
                    flex: 1,
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
          <div style={{ display: "flex", gap: 10 }}>
            {contentCategoryOptions.map((c) => {
              const active = c === category;
              const meta = resolveCategoryMeta(c, customLabels);
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    flex: 1,
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

        <Button fullWidth onClick={handleGenerate} disabled={loading} style={{ padding: 15, fontSize: 16 }}>
          {loading ? "Génération en cours..." : "Générer le script"}
        </Button>
      </Card>
    </div>
  );
}
