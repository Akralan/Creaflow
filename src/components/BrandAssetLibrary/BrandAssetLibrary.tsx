"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiClientError, type BrandAsset } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";
import AssetGrid from "./AssetGrid";
import UploadDropzone from "./UploadDropzone";
import GooglePickerButton from "./GooglePickerButton";

const POLL_INTERVAL_MS = 3000;

/**
 * Brand image library (docs/SPEC_RESSOURCES_VISUELLES.md): import (upload, Google
 * Picker), grid, on-demand cutout (docs/SPEC_COMPOSITION_VISUELLE.md §6). Image generation
 * was removed: photos are used as they are, or cut out, in the mockup.
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

  // Light polling while at least one asset is still being processed — no websocket,
  // consistent with the absence of async infra elsewhere in the repo (§7.2 of the brief).
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
      setError(err instanceof ApiClientError ? err.message : "Photo upload failed.");
    }
  }

  async function handlePickerSelection(fileIds: string[]) {
    setError(null);
    try {
      const { assets: created } = await api.finalizeAssetPicker(fileIds);
      setAssets((prev) => [...created, ...prev]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Import from Google Drive failed.");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await api.deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Deletion failed.");
    }
  }

  async function handleCutout(id: string) {
    setError(null);
    setCutoutBusyId(id);
    try {
      const { asset } = await api.cutoutAsset(id);
      setAssets((prev) => prev.map((a) => (a.id === id ? asset : a)));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't cut out the subject.");
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
        These photos are used as they are in the mockups of your visual posts. &ldquo;Cut out&rdquo; isolates the subject on a transparent background
        {cutoutAvailable ? "" : " (not configured on this server)"}.
      </p>

      {error && <p style={{ color: color.danger, fontSize: 13, margin: 0 }}>{error}</p>}
    </div>
  );
}
