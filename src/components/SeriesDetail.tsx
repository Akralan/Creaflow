"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SeriesFramingPanel from "@/components/SeriesFramingPanel";
import SeriesReaderPanel from "@/components/SeriesReaderPanel";
import { PlatformBadge } from "@/components/ui/Badge";
import { api, ApiClientError, type ContentSeries, type Product, type Script } from "@/lib/apiClient";
import { color, fontHeading, statusMeta } from "@/lib/design/tokens";

/**
 * Panneau de droite de l'écran Direction : le sujet lié, le lecteur et la forme de la série avec
 * ses prochains épisodes (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4), le cadrage, et les scripts de
 * la série. Le plan en épisodes du rédacteur en chef a disparu avec lui (Lot 4) : le plan d'une
 * série, c'est la ligne de temps de son sujet vue par son lecteur.
 */

const cardStyle: React.CSSProperties = {
  background: color.cardBg,
  border: `1px solid ${color.border}`,
  borderRadius: 14,
  padding: "18px 20px",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: color.textFaint,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export default function SeriesDetail({
  series,
  onSeriesUpdate,
}: {
  series: ContentSeries;
  onSeriesUpdate: (updated: ContentSeries) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [switchingProduct, setSwitchingProduct] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([]);

  useEffect(() => {
    api.getProducts().then(({ products }) => setProducts(products));
  }, []);

  // Scripts de la série — sans cela, un script importé ou écrit à la main n'est plus atteignable
  // depuis Direction.
  useEffect(() => {
    let cancelled = false;
    api
      .getScripts({ seriesId: series.id })
      .then(({ scripts }) => !cancelled && setScripts(scripts))
      .catch(() => !cancelled && setScripts([]));
    return () => {
      cancelled = true;
    };
  }, [series.id]);

  async function switchProduct(productId: string) {
    const nextId = productId || null;
    if (nextId === (series.product?.id ?? null)) return;
    setSwitchingProduct(true);
    setError(null);
    try {
      await api.updateSeriesFields(series.id, { productId: nextId });
      const product = nextId ? (products.find((p) => p.id === nextId) ?? null) : null;
      // Le lecteur se choisissait dans le portrait de l'ancien sujet : il est à rechoisir.
      onSeriesUpdate({ ...series, product: product ? { id: product.id, name: product.name } : null, readerLabel: null, form: null });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors du changement de sujet.");
    } finally {
      setSwitchingProduct(false);
    }
  }

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", marginRight: 2 }}>
          {series.label}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            color: color.textMuted,
            background: color.inputBg,
            border: `1px solid ${color.inputBorder}`,
            borderRadius: 8,
            padding: "5px 10px",
          }}
        >
          Sujet :
          <select
            value={series.product?.id ?? ""}
            onChange={(e) => switchProduct(e.target.value)}
            disabled={switchingProduct}
            title="Le sujet dont cette série raconte la ligne de temps — sans sujet, la série n'a rien à raconter"
            style={{
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              background: "none",
              fontFamily: "inherit",
              color: color.text,
              cursor: switchingProduct ? "default" : "pointer",
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
      </div>

      {error && <p style={{ margin: "0 0 12px", fontSize: 13, color: color.danger }}>{error}</p>}

      {/* Le lecteur, la forme et les prochains épisodes tirés de la ligne de temps (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4). */}
      <SeriesReaderPanel series={series} onSeriesUpdate={onSeriesUpdate} />

      {/* Cadrage de la série par des choix (docs/SPEC_CADRAGE_SERIE.md §5). */}
      <SeriesFramingPanel series={series} onSeriesUpdate={onSeriesUpdate} />

      {scripts.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 14 }}>
          <div style={{ ...sectionLabelStyle, marginBottom: 12 }}>Scripts de cette série · {scripts.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scripts.map((script) => {
              const status = statusMeta[script.status];
              return (
                <div
                  key={script.id}
                  onClick={() => router.push(`/scripts/${script.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: color.inputBg,
                    cursor: "pointer",
                  }}
                >
                  <PlatformBadge platform={script.platform} size={18} />
                  <span style={{ flex: 1, fontSize: 13, color: color.text2, minWidth: 0 }}>{script.title ?? "(sans titre)"}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: status.fg,
                      background: status.bg,
                      borderRadius: 20,
                      padding: "2px 8px",
                    }}
                  >
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
