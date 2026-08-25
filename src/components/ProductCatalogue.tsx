"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/TextField";
import { api, ApiClientError, type Product } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";
import { MAX_PRODUCTS } from "@/lib/validation";
import MaterialPanel from "@/components/MaterialPanel";

/** Override d'audience par sujet (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — null = fallback sur
 *  l'audience de marque (paramètres > Identité). Panneau dépliable, même pattern que "Matière". */
function AudienceOverridePanel({ product, onUpdated }: { product: Product; onUpdated: (product: Product) => void }) {
  const [value, setValue] = useState(product.targetAudience ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { product: updated } = await api.updateProduct(product.id, { targetAudience: value.trim() || null });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <TextAreaField
        label="Audience de ce sujet"
        helper="Laisse vide pour utiliser l'audience de marque définie dans les paramètres."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Qui achète ou lit, ce qui l'intéresse, ce qu'il doit retenir de ce sujet précis"
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button variant="secondary" onClick={save} disabled={saving || value === (product.targetAudience ?? "")}>
          {saving ? "..." : "Enregistrer"}
        </Button>
        {error && <span style={{ fontSize: 12, color: color.danger }}>{error}</span>}
      </div>
    </div>
  );
}

export default function ProductCatalogue({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [expandedAudienceId, setExpandedAudienceId] = useState<string | null>(null);

  useEffect(() => {
    api.getProducts().then(({ products }) => {
      setProducts(products);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) onCountChange?.(products.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, loaded]);

  async function addProduct() {
    setError(null);
    if (!name.trim()) return;
    try {
      const { products: created } = await api.createProducts([
        { name, description: description || undefined, valueProposition: valueProposition || undefined },
      ]);
      setProducts((prev) => [...prev, ...created]);
      setName("");
      setDescription("");
      setValueProposition("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'ajout du produit.");
    }
  }

  async function deleteProduct(id: string) {
    setError(null);
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la suppression.");
    }
  }

  if (!loaded) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: color.textMuted }}>
          {products.length} sujet{products.length > 1 ? "s" : ""} sur {MAX_PRODUCTS}
          {products.length < MAX_PRODUCTS ? ` · vous pouvez en ajouter ${MAX_PRODUCTS - products.length}` : ""}
        </span>
      </div>

      <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
        {products.map((p) => (
          <div
            key={p.id}
            style={{
              border: `1px solid ${color.border}`,
              borderRadius: 14,
              padding: 14,
              background: color.cardBg,
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  flexShrink: 0,
                  borderRadius: 10,
                  background: "repeating-linear-gradient(45deg,#efe9df,#efe9df 6px,#e7e0d4 6px,#e7e0d4 12px)",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                {p.description && <div style={{ fontSize: 13, color: color.textMuted }}>{p.description}</div>}
                {p.valueProposition && (
                  <div style={{ fontSize: 12, color: "oklch(0.52 0.2 292)", marginTop: 2 }}>{p.valueProposition}</div>
                )}
              </div>
              <button
                onClick={() => setExpandedAudienceId((cur) => (cur === p.id ? null : p.id))}
                style={{
                  fontSize: 13,
                  color: color.text3,
                  border: `1px solid ${color.border}`,
                  borderRadius: 8,
                  padding: "6px 10px",
                  background: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {expandedAudienceId === p.id ? "Fermer" : "Audience"}
              </button>
              <button
                onClick={() => setExpandedMaterialId((cur) => (cur === p.id ? null : p.id))}
                style={{
                  fontSize: 13,
                  color: color.text3,
                  border: `1px solid ${color.border}`,
                  borderRadius: 8,
                  padding: "6px 10px",
                  background: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {expandedMaterialId === p.id ? "Fermer" : "Matière"}
              </button>
              <button
                onClick={() => deleteProduct(p.id)}
                style={{
                  fontSize: 13,
                  color: color.danger,
                  border: `1px solid ${color.dangerBorder}`,
                  borderRadius: 8,
                  padding: "6px 10px",
                  background: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Supprimer
              </button>
            </div>
            {expandedAudienceId === p.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${color.border}` }}>
                <AudienceOverridePanel
                  product={p}
                  onUpdated={(updated) => setProducts((prev) => prev.map((prod) => (prod.id === updated.id ? updated : prod)))}
                />
              </div>
            )}
            {expandedMaterialId === p.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${color.border}` }}>
                <MaterialPanel productId={p.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p style={{ color: color.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

      {products.length < MAX_PRODUCTS && (
        <div style={{ border: `1.5px dashed ${color.dashedBorder}`, borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
          <TextField label="Nom du sujet" value={name} onChange={(e) => setName(e.target.value)} placeholder="Collier Aurore" />
          <TextField
            label="Description"
            optional
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Argent 925, chaîne fine 42cm"
          />
          <TextField
            label="Proposition de valeur"
            optional
            value={valueProposition}
            onChange={(e) => setValueProposition(e.target.value)}
            placeholder="Élégance du quotidien"
          />
          <Button variant="secondary" onClick={addProduct} disabled={!name.trim()}>
            + Ajouter ce sujet
          </Button>
        </div>
      )}
    </div>
  );
}
