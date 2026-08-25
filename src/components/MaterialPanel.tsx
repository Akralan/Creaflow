"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import GenerateSeriesFromMaterialModal from "@/components/GenerateSeriesFromMaterialModal";
import MaterialInterviewChat from "@/components/MaterialInterviewChat";
import { api, ApiClientError, type Citation, type SourceMaterial } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

/** Découpe `text` en segments, les passages cités (matchStart/matchLength connus) surlignés — sert
 *  de vue de debug (docs/SPEC_MATIERE_EDITEUR.md §3) : voir ce qui a réellement été repris par l'IA. */
function renderHighlighted(text: string, citations: Citation[]): ReactNode[] {
  const spans = citations
    .filter((c): c is Citation & { matchStart: number; matchLength: number } => c.matchStart != null && c.matchLength != null)
    .map((c) => ({ start: c.matchStart, length: c.matchLength }))
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; length: number }[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.start + last.length) {
      last.length = Math.max(last.start + last.length, s.start + s.length) - last.start;
    } else {
      merged.push({ ...s });
    }
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  merged.forEach((s, i) => {
    if (s.start > cursor) parts.push(text.slice(cursor, s.start));
    parts.push(
      <mark key={i} style={{ background: "oklch(0.88 0.12 90)", borderRadius: 3, padding: "0 1px" }}>
        {text.slice(s.start, s.start + s.length)}
      </mark>
    );
    cursor = s.start + s.length;
  });
  parts.push(text.slice(cursor));
  return parts;
}

/**
 * Résumé orienté potentiel narratif sous chaque document (docs/SPEC_REDACTEUR_EN_CHEF.md §7) —
 * "résumé en cours..." tant que `summary` est null (généré à l'ingestion, backfill paresseux sinon) ;
 * une fois présent, éditable directement (`onBlur`) et l'édition devient la source de vérité, jamais
 * regénérée automatiquement ensuite.
 */
function MaterialSummaryField({ summary, onSave }: { summary: string | null; onSave: (next: string) => void }) {
  const [draft, setDraft] = useState(summary ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Même garde que EditableField (docs/SPEC_MATIERE_EDITEUR.md §4.4) : ne pas écraser une édition en
  // cours si le résumé change ailleurs (backfill qui se termine pendant que l'utilisateur tape).
  useEffect(() => {
    if (document.activeElement !== textareaRef.current) {
      setDraft(summary ?? "");
    }
  }, [summary]);

  if (summary === null) {
    return (
      <div style={{ marginTop: 6, fontSize: 12, fontStyle: "italic", color: color.textFaint }}>
        Résumé en cours...
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== summary) onSave(trimmed);
      }}
      rows={2}
      maxLength={300}
      style={{
        width: "100%",
        marginTop: 6,
        border: `1px solid ${color.inputBorder}`,
        borderRadius: 8,
        padding: "6px 8px",
        fontSize: 12,
        fontStyle: "italic",
        lineHeight: 1.4,
        fontFamily: "inherit",
        background: color.inputBg,
        color: color.textMuted,
        resize: "vertical",
      }}
    />
  );
}

/**
 * Corpus de matière première d'un sujet (docs/SPEC_MATIERE_EDITEUR.md §3) — dépôt gratuit et
 * immédiatement utilisable (coller du texte ou un fichier .md/.txt, §3.2 anti-scope). Le texte brut
 * complet est injecté tel quel à la génération, aucune structuration intermédiaire. La vue dépliée
 * d'un document surligne les passages déjà cités par des générations précédentes.
 * `productId` undefined = matière de niveau marque (pas rattachée à un sujet précis).
 */
export default function MaterialPanel({ productId }: { productId?: string }) {
  const router = useRouter();
  const [materials, setMaterials] = useState<SourceMaterial[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [tab, setTab] = useState<"paste" | "interview">("paste");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [citationsByMaterial, setCitationsByMaterial] = useState<Record<string, Citation[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!loaded) {
    api.getMaterials(productId).then(({ materials }) => {
      setMaterials(materials);
      setLoaded(true);
    });
  }

  async function addMaterial() {
    setError(null);
    if (!rawText.trim()) return;
    setSaving(true);
    try {
      const { material } = await api.addPastedMaterial({ productId, rawText });
      setMaterials((prev) => [material, ...prev]);
      setRawText("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'ajout de la matière.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);
    setUploading(true);
    const failed: string[] = [];
    try {
      for (const file of list) {
        try {
          const { material } = await api.uploadMaterialFile(file, productId);
          setMaterials((prev) => [material, ...prev]);
        } catch {
          failed.push(file.name);
        }
      }
      if (failed.length > 0) {
        setError(`Échec de l'import pour : ${failed.join(", ")}`);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveSummary(id: string, summary: string) {
    setError(null);
    try {
      const { material } = await api.updateMaterialSummary(id, summary);
      setMaterials((prev) => prev.map((m) => (m.id === id ? material : m)));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement du résumé.");
    }
  }

  async function removeMaterial(id: string) {
    setError(null);
    try {
      await api.deleteMaterial(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la suppression.");
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!citationsByMaterial[id]) {
      try {
        const { citations } = await api.getMaterialCitations(id);
        setCitationsByMaterial((prev) => ({ ...prev, [id]: citations }));
      } catch {
        // La vue reste utilisable sans surlignage si la requête échoue — pas bloquant.
        setCitationsByMaterial((prev) => ({ ...prev, [id]: [] }));
      }
    }
  }

  if (!loaded) return null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 2, background: color.chipBg, borderRadius: 10, padding: 3, width: "fit-content", marginBottom: 4 }}>
        {(["paste", "interview"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontSize: 13,
              fontWeight: tab === t ? 600 : 500,
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: tab === t ? color.cardBg : "transparent",
              color: tab === t ? color.text : color.textFaint,
            }}
          >
            {t === "paste" ? "Coller" : "Interviewer"}
          </button>
        ))}
      </div>

      {tab === "interview" ? (
        <MaterialInterviewChat productId={productId} />
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
            Colle ici tout ce qui peut nourrir les scripts sur ce sujet : anecdotes, chiffres, décisions, retours
            clients... Le texte est injecté tel quel à la génération — plus il y a de matière, moins l&apos;IA invente.
          </p>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Colle un texte (journal de bord, notes, anciens posts...)"
            rows={4}
            style={{
              width: "100%",
              border: `1px solid ${color.inputBorder}`,
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
              fontFamily: "inherit",
              background: color.inputBg,
              color: color.text,
              resize: "vertical",
            }}
          />
          {error && <p style={{ color: color.danger, fontSize: 13, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={addMaterial} disabled={!rawText.trim() || saving}>
              {saving ? "Ajout..." : "+ Ajouter cette matière"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.length) handleFileUpload(e.target.files);
              }}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? "Import..." : "Importer des fichiers .md/.txt"}
            </Button>
          </div>

          {materials.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: color.textSecondary }}>
                  Documents déposés ({materials.length})
                </div>
                <button
                  onClick={() => setShowSeriesModal(true)}
                  style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.5 0.2 292)", border: "none", background: "none", cursor: "pointer" }}
                >
                  Générer une série depuis cette matière →
                </button>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {materials.map((m) => {
                  const expanded = expandedId === m.id;
                  const citations = citationsByMaterial[m.id] ?? [];
                  const matchedCount = citations.filter((c) => c.matchStart != null).length;
                  return (
                    <div
                      key={m.id}
                      style={{ border: `1px solid ${color.border}`, borderRadius: 10, padding: 10, background: color.cardBg }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <button
                          onClick={() => toggleExpand(m.id)}
                          style={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "none", cursor: "pointer", padding: 0 }}
                        >
                          {m.title && <div style={{ fontWeight: 600, fontSize: 13, color: color.text, marginBottom: 2 }}>{m.title}</div>}
                          {!expanded && (
                            <div style={{ fontSize: 13, color: color.text2 }}>
                              {m.rawText.length > 200 ? `${m.rawText.slice(0, 200)}…` : m.rawText}
                            </div>
                          )}
                          {matchedCount > 0 && !expanded && (
                            <div style={{ fontSize: 11, color: color.textFaint, marginTop: 4 }}>
                              {matchedCount} passage{matchedCount > 1 ? "s" : ""} déjà cité{matchedCount > 1 ? "s" : ""} — voir le détail
                            </div>
                          )}
                        </button>
                        <button
                          onClick={() => removeMaterial(m.id)}
                          style={{ fontSize: 12, color: color.danger, border: "none", background: "none", cursor: "pointer", flexShrink: 0 }}
                        >
                          Supprimer
                        </button>
                      </div>
                      <MaterialSummaryField summary={m.summary} onSave={(next) => saveSummary(m.id, next)} />
                      {expanded && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${color.divider}` }}>
                          <div style={{ fontSize: 13, lineHeight: 1.5, color: color.text2, whiteSpace: "pre-wrap" }}>
                            {renderHighlighted(m.rawText, citations)}
                          </div>
                          {citations.some((c) => c.matchStart == null) && (
                            <div style={{ marginTop: 10, fontSize: 12, color: color.textFaint }}>
                              Citations rapportées non localisées dans le texte :
                              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                                {citations
                                  .filter((c) => c.matchStart == null)
                                  .map((c) => (
                                    <li key={c.id}>&laquo;&nbsp;{c.excerpt}&nbsp;&raquo;</li>
                                  ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <GenerateSeriesFromMaterialModal
        open={showSeriesModal}
        onClose={() => setShowSeriesModal(false)}
        productId={productId}
        onDone={() => {
          setShowSeriesModal(false);
          router.push("/calendar");
        }}
      />
    </div>
  );
}
