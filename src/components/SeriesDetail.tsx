"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SeriesReaderPanel from "@/components/SeriesReaderPanel";
import { PlatformBadge } from "@/components/ui/Badge";
import { api, ApiClientError, type ContentSeries, type Product, type Script } from "@/lib/apiClient";
import { color, fontHeading, statusMeta } from "@/lib/design/tokens";

/**
 * Right-hand panel of the Direction screen: the linked topic, the reader and the shape of the series with
 * its upcoming episodes (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4), and the series' scripts.
 * Framing by choices (docs/SPEC_CADRAGE_SERIE.md) was removed: the shape replaces it, signature included. The episode plan of the editor-in-chief disappeared with it (Lot 4): a
 * series' plan is the timeline of its topic as seen by its reader.
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

  // The series' scripts — without this, a script imported or written by hand is no longer reachable
  // from Direction.
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
      // The reader was picked from the old topic's portrait: it has to be picked again.
      onSeriesUpdate({ ...series, product: product ? { id: product.id, name: product.name } : null, readerLabel: null, form: null });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while changing the topic.");
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
          Topic:
          <select
            value={series.product?.id ?? ""}
            onChange={(e) => switchProduct(e.target.value)}
            disabled={switchingProduct}
            title="The topic whose timeline this series tells — without a topic, the series has nothing to tell"
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
            <option value="">No topic</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p style={{ margin: "0 0 12px", fontSize: 13, color: color.danger }}>{error}</p>}

      {/* The reader, the shape and the upcoming episodes drawn from the timeline (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4). */}
      <SeriesReaderPanel series={series} onSeriesUpdate={onSeriesUpdate} />


      {scripts.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 14 }}>
          <div style={{ ...sectionLabelStyle, marginBottom: 12 }}>Scripts in this series · {scripts.length}</div>
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
                  <span style={{ flex: 1, fontSize: 13, color: color.text2, minWidth: 0 }}>{script.title ?? "(untitled)"}</span>
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
