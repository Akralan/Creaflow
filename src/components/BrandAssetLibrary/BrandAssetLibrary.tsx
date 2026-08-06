"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { api, ApiClientError, type BrandAsset, type GeneratedImage } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";
import AssetGrid from "./AssetGrid";
import UploadDropzone from "./UploadDropzone";
import GooglePickerButton from "./GooglePickerButton";

const POLL_INTERVAL_MS = 3000;

export default function BrandAssetLibrary({
  scriptId,
  onGenerated,
}: {
  /** Si fourni, la génération est rattachée à ce script (fiche script). Omis dans l'écran Settings,
   *  où la bibliothèque n'est qu'un lieu de gestion sans génération contextualisée. */
  scriptId?: string;
  onGenerated?: (image: GeneratedImage) => void;
}) {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => api.getAssets().then(({ assets }) => setAssets(assets)), []);

  useEffect(() => {
    refresh().then(() => setLoaded(true));
  }, [refresh]);

  // Poll léger tant qu'au moins un asset est encore en cours de traitement — pas de websocket,
  // cohérent avec l'absence d'infra async ailleurs dans le repo (§7.2 du cadrage).
  useEffect(() => {
    const hasPending = assets.some((a) => a.status === "pending");
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [assets, refresh]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleFiles(files: File[]) {
    setError(null);
    try {
      const { assets: created } = await api.uploadAssets(files);
      setAssets((prev) => [...created, ...prev]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Échec de l'envoi des photos.");
    }
  }

  async function handlePickerSelection(fileIds: string[]) {
    setError(null);
    try {
      const { assets: created } = await api.finalizeAssetPicker(fileIds);
      setAssets((prev) => [...created, ...prev]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Échec de l'import depuis Google Drive.");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await api.deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Échec de la suppression.");
    }
  }

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const { generatedImage } = await api.generateStagedImage({
        assetIds: selectedIds,
        instruction,
        scriptId,
      });
      onGenerated?.(generatedImage);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Échec de la génération de l'image.");
    } finally {
      setGenerating(false);
    }
  }

  if (!loaded) return null;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <GooglePickerButton onSelected={handlePickerSelection} />
      </div>
      <UploadDropzone onFiles={handleFiles} />

      <AssetGrid assets={assets} selectedIds={selectedIds} onToggle={toggleSelected} onDelete={handleDelete} />

      {error && <p style={{ color: color.danger, fontSize: 13, margin: 0 }}>{error}</p>}

      {onGenerated && (
        <div style={{ borderTop: `1px solid ${color.dividerAlt}`, paddingTop: 16, display: "grid", gap: 10 }}>
          <TextField
            label={`Mise en scène souhaitée${selectedIds.length > 0 ? ` (${selectedIds.length} photo${selectedIds.length > 1 ? "s" : ""} sélectionnée${selectedIds.length > 1 ? "s" : ""})` : ""}`}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Sur un fond en bois clair, lumière naturelle du matin"
          />
          <Button onClick={handleGenerate} disabled={generating || selectedIds.length === 0 || !instruction.trim()}>
            {generating ? "Génération en cours…" : "Générer le visuel"}
          </Button>
        </div>
      )}
    </div>
  );
}
