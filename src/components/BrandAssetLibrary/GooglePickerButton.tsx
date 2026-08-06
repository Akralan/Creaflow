"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError } from "@/lib/apiClient";

declare global {
  interface Window {
    gapi?: { load: (api: string, callback: () => void) => void };
    google?: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { DOCS_IMAGES: string };
        Feature: { MULTISELECT_ENABLED: string };
        Action: { PICKED: string };
      };
      accounts: {
        oauth2: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode: "popup";
            callback: (response: { code?: string; error?: string }) => void;
          }) => { requestCode: () => void };
        };
      };
    };
  }
}

interface GooglePickerBuilder {
  addView: (viewId: string) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  enableFeature: (feature: string) => GooglePickerBuilder;
  setCallback: (cb: (data: { action: string; docs?: Array<{ id: string }> }) => void) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export default function GooglePickerButton({ onSelected }: { onSelected: (fileIds: string[]) => void }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pickerLoaded = useRef(false);

  useEffect(() => {
    Promise.all([
      loadScriptOnce("https://apis.google.com/js/api.js"),
      loadScriptOnce("https://accounts.google.com/gsi/client"),
    ]).then(() => {
      window.gapi?.load("picker", () => {
        pickerLoaded.current = true;
        setReady(true);
      });
    });
  }, []);

  function openPicker(accessToken: string) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
    if (!window.google || !apiKey) return;
    new window.google.picker.PickerBuilder()
      .addView(window.google.picker.ViewId.DOCS_IMAGES)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setCallback((data) => {
        if (data.action === window.google!.picker.Action.PICKED && data.docs) {
          onSelected(data.docs.map((d) => d.id));
        }
      })
      .build()
      .setVisible(true);
  }

  // Systématiquement re-demandé à chaque clic (y compris "Ajouter des images" une fois déjà
  // connecté) : le widget Picker a besoin d'un access token frais côté navigateur, que seul ce
  // flow peut fournir — mais Google n'affiche généralement plus l'écran de consentement complet
  // une fois l'accès déjà accordé.
  function handleClick() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!window.google || !clientId) {
      setError("Google Picker n'est pas configuré.");
      return;
    }
    setError(null);
    setLoading(true);
    window.google.accounts.oauth2
      .initCodeClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        ux_mode: "popup",
        callback: async (response) => {
          if (!response.code) {
            setLoading(false);
            if (response.error) setError("Connexion Google Drive annulée ou refusée.");
            return;
          }
          try {
            const { accessToken } = await api.connectGoogleDrive(response.code);
            openPicker(accessToken);
          } catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Connexion Google Drive échouée.");
          } finally {
            setLoading(false);
          }
        },
      })
      .requestCode();
  }

  return (
    <div>
      <Button variant="secondary" onClick={handleClick} disabled={!ready || loading}>
        {loading ? "…" : "Importer depuis Google Drive"}
      </Button>
      {error && <p style={{ color: "#b04a3a", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}
