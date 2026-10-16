"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiClientError, type BrandAsset } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";
import AssetGrid from "./AssetGrid";
import UploadDropzone from "./UploadDropzone";
import GooglePickerButton from "./GooglePickerButton";

const POLL_INTERVAL_MS = 3000;

/**
 * Bibliothèque d'images de marque (docs/SPEC_RESSOURCES_VISUELLES.md) : import (upload, Google
 * Picker), grille, détourage à la demande (docs/SPEC_COMPOSITION_VISUELLE.md §6). La génération
 * d'image a été retirée : les photos servent telles quelles, ou détourées, dans la maquette.
 */
export default function BrandAssetLibrary() {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [cutoutAvailable, setCutoutAvailable] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cutoutBusyId, setCutoutBusyId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(
    () =>
      api.getAssets().then(({ assets, cutoutAvailable }) => {
        setAssets(assets);
        setCutoutAvailable(cutoutAvailable);
      }),
    []
  );

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

  async function handleCutout(id: string) {
    setError(null);
    setCutoutBusyId(id);
    try {
      const { asset } = await api.cutoutAsset(id);
      setAssets((prev) => prev.map((a) => (a.id === id ? asset : a)));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Détourage impossible.");
    } finally {
      setCutoutBusyId(null);
    }
  }

  if (!loaded) return null;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <GooglePickerButton onSelected={handlePickerSelection} />
      </div>
      <UploadDropzone onFiles={handleFiles} />

      <AssetGrid
        assets={assets}
        selectedIds={selectedIds}
        onToggle={toggleSelected}
        onDelete={handleDelete}
        cutout={{ available: cutoutAvailable, busyId: cutoutBusyId, onCutout: handleCutout }}
      />
      <p style={{ margin: 0, fontSize: 12, color: color.textFaint }}>
        Ces photos servent telles quelles dans les maquettes de tes posts visuels. « Détourer » isole le sujet sur fond transparent
        {cutoutAvailable ? "" : " (non configuré sur ce serveur)"}.
      </p>

      {error && <p style={{ color: color.danger, fontSize: 13, margin: 0 }}>{error}</p>}
    </div>
  );
}
