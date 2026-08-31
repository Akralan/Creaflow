"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PlatformBadge, CategoryPill } from "@/components/ui/Badge";
import { api, ApiClientError, type CalendarEntry, type ContentType, type Product } from "@/lib/apiClient";
import { color, fontHeading, platformMeta } from "@/lib/design/tokens";
import { defaultContentTypeForPlatform } from "@/lib/llm/prompts";

/**
 * Naissance paresseuse (docs/SPEC_MATIERE_EDITEUR.md §4.1/§4.5) : la page s'ouvre depuis un créneau
 * du calendrier avec le brief déjà connu, mais aucune ligne Script n'existe encore. Deux issues :
 * générer le premier jet (flux existant), ou écrire directement — la ligne Script naît au premier
 * contenu significatif, jamais à l'ouverture d'une page vide.
 */
function NewScriptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarEntryId = searchParams.get("calendarEntryId");
  const contentTypeParam = searchParams.get("contentType") as ContentType | null;

  const [entry, setEntry] = useState<CalendarEntry | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [directive, setDirective] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const createdRef = useRef(false);

  useEffect(() => {
    api.getProducts().then(({ products }) => setProducts(products));
  }, []);

  useEffect(() => {
    if (!calendarEntryId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    api
      .getCalendarEntry(calendarEntryId)
      .then(({ entry }) => setEntry(entry))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Créneau introuvable."))
      .finally(() => setLoading(false));
  }, [calendarEntryId]);

  async function handleGenerate() {
    if (!calendarEntryId) return;
    setGenerating(true);
    setError(null);
    try {
      const { script } = await api.generateScriptForEntry(
        calendarEntryId,
        contentTypeParam ?? undefined,
        productId || undefined,
        directive.trim() || undefined
      );
      router.replace(`/scripts/${script.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la génération.");
      setGenerating(false);
    }
  }

  async function handleFirstContent() {
    if (!calendarEntryId || !entry || creating || createdRef.current) return;
    if (!title.trim() && !caption.trim()) return;
    createdRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const resolvedContentType = contentTypeParam ?? defaultContentTypeForPlatform(entry.platform);
      const { script } = await api.importScript({
        platform: entry.platform,
        contentCategoryId: entry.contentCategory.id,
        contentType: resolvedContentType,
        productId: productId || undefined,
        seriesId: entry.series?.id,
        calendarEntryId,
        title: title.trim() || undefined,
        caption: caption.trim() || undefined,
        hashtags: [],
      });
      router.replace(`/scripts/${script.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la création.");
      setCreating(false);
      createdRef.current = false;
    }
  }

  if (loading) return null;

  if (!calendarEntryId || !entry) {
    return (
      <div style={{ padding: "32px 36px" }}>
        <p style={{ color: color.danger }}>{error || "Créneau introuvable."}</p>
        <Button variant="secondary" onClick={() => router.push("/calendar")}>
          ← Retour au calendrier
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 720 }}>
      <button
        onClick={() => router.push("/calendar")}
        style={{ background: "none", border: "none", color: color.textMuted, fontFamily: "inherit", fontSize: 14, cursor: "pointer", marginBottom: 18, padding: 0 }}
      >
        ← Retour au calendrier
      </button>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, background: "#1c1917", color: "#fff", borderRadius: 20, padding: "5px 12px" }}>
          <PlatformBadge platform={entry.platform} size={16} />
          {platformMeta[entry.platform].label}
        </span>
        <CategoryPill category={entry.contentCategory} />
        {entry.series && (
          <span style={{ fontSize: 13, fontWeight: 600, color: "oklch(0.47 0.2 292)", background: "oklch(0.55 0.2 292 / 0.1)", borderRadius: 20, padding: "6px 12px" }}>
            ◈ {entry.series.label}
          </span>
        )}
      </div>

      <h1 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 26, margin: "0 0 24px" }}>Nouveau script</h1>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.text3, marginBottom: 6 }}>
          Sujet <span style={{ color: color.textFaint, fontWeight: 400 }}>— optionnel, mais nourrit la génération avec le corpus de ce sujet</span>
        </label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          style={{
            width: "100%",
            border: `1px solid ${color.inputBorder}`,
            borderRadius: 11,
            padding: "11px 14px",
            fontSize: 14,
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

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.text3, marginBottom: 6 }}>
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
            padding: "10px 14px",
            fontSize: 14,
            lineHeight: 1.45,
            fontFamily: "inherit",
            background: color.inputBg,
            color: color.text2,
            resize: "vertical",
          }}
        />
      </div>

      <Card style={{ padding: 24, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Générer un premier jet</div>
          <div style={{ fontSize: 13, color: color.textMuted }}>L&apos;IA propose un brouillon complet à partir de ton brief et de ta matière.</div>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? "..." : "Générer"}
        </Button>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0", color: color.textFaint, fontSize: 12 }}>
        <div style={{ flex: 1, height: 1, background: color.divider }} />
        ou écris directement
        <div style={{ flex: 1, height: 1, background: color.divider }} />
      </div>

      {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <Card style={{ padding: 22 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleFirstContent}
          placeholder="Titre du script"
          style={{
            width: "100%",
            fontFamily: fontHeading,
            fontWeight: 700,
            fontSize: 20,
            border: "none",
            outline: "none",
            background: "none",
            color: color.text,
            marginBottom: 14,
            padding: 0,
          }}
        />
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={handleFirstContent}
          placeholder="Commence à écrire..."
          rows={8}
          style={{
            width: "100%",
            border: `1px solid ${color.inputBorder}`,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 14,
            lineHeight: 1.5,
            fontFamily: "inherit",
            background: color.inputBg,
            color: color.text2,
            resize: "vertical",
          }}
          disabled={creating}
        />
      </Card>
    </div>
  );
}

export default function NewScriptPage() {
  return (
    <Suspense fallback={null}>
      <NewScriptContent />
    </Suspense>
  );
}
