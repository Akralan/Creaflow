"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

/**
 * Les boutons « Continuer avec … » de /login, un par fournisseur d'identité configuré.
 *
 * La liste vient du serveur (`/api/auth/oauth/providers`) et non d'une constante ici : un
 * fournisseur dont les variables d'environnement manquent ne doit pas être proposé, sans quoi le
 * bouton mènerait à une erreur. Rien ne s'affiche si aucun n'est configuré — le parcours
 * email/mot de passe reste alors entièrement fonctionnel.
 */

/** Marques dessinées à la main : pas de dépendance d'icônes pour cinq logos, et un SVG inline
 *  hérite de `currentColor`, donc suit le thème. */
const ICONS: Record<string, React.ReactNode> = {
  github: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  ),
  notion: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M2.4 1.6 10.9.9c1-.1 1.3 0 1.9.4l2 1.4c.4.3.6.4.6.8v9.6c0 .6-.2.9-1 1l-8.7.5c-.6 0-.9-.1-1.2-.5L1.8 11c-.3-.4-.4-.7-.4-1.1V2.6c0-.5.2-.9 1-1Zm8.2 1.1L2.9 3.2c-.4 0-.5.3-.3.5l1.5 1.1c.2.2.5.3.9.2l7.4-.4c.2 0 .1-.2 0-.3l-1.3-.9c-.2-.2-.4-.2-.5-.2ZM3.9 6.3v7.5c0 .4.2.5.6.5l8-.5c.4 0 .5-.2.5-.6V5.9c0-.3-.1-.5-.5-.5l-8.1.4c-.4 0-.5.2-.5.5Zm7.4.6c0 .2 0 .4-.2.4l-.4.1v5.4c-.3.2-.6.3-.9.3-.4 0-.5-.1-.8-.5L7 9.4v3l.8.2s0 .4-.5.4l-1.5.1c0-.2 0-.4.3-.5l.4-.1V7.9l-.5-.1c0-.2.1-.5.5-.6l1.6-.1 2.2 3.4V7.5l-.7-.1c0-.3.2-.5.5-.5l1.2-.1Z" />
    </svg>
  ),
  linear: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M.6 9.5a7.5 7.5 0 0 0 5.9 5.9L.6 9.5Zm-.5-2 8.4 8.4c.5 0 1-.1 1.4-.2L.3 6.1c-.1.4-.2.9-.2 1.4Zm.8-2.8 10.4 10.4c.4-.2.7-.4 1-.6L1.5 3.7c-.2.3-.4.6-.6 1Zm1.5-2 11 11a8 8 0 0 0 .7-.8L3.2 2.1c-.3.2-.6.4-.8.6ZM15.9 8A8 8 0 0 0 8 .1L15.9 8Z" />
    </svg>
  ),
};

export default function OAuthProviderButtons() {
  const [providers, setProviders] = useState<Array<{ id: string; displayName: string }>>([]);

  useEffect(() => {
    // Silencieux en cas d'échec : l'absence de fournisseur ne doit jamais casser la page de
    // connexion, dont le parcours email/mot de passe se suffit.
    api
      .getOAuthProviders()
      .then(({ providers }) => setProviders(providers))
      .catch(() => {});
  }, []);

  if (providers.length === 0) return null;

  return (
    <>
      <div style={{ display: "grid", gap: 10 }}>
        {providers.map((provider) => (
          <a
            key={provider.id}
            href={
              // GitHub garde sa route historique : son URL de callback est déposée sur github.com
              // et ne peut pas changer.
              provider.id === "github" ? "/api/auth/github/start" : `/api/auth/oauth/${provider.id}/start`
            }
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 12,
              border: `1px solid ${color.border}`,
              background: color.cardBg,
              color: color.textSecondary,
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {ICONS[provider.id] ?? null}
            Continuer avec {provider.displayName}
          </a>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
        <div style={{ flex: 1, height: 1, background: color.border }} />
        <span style={{ fontSize: 12, color: color.textFaint }}>ou</span>
        <div style={{ flex: 1, height: 1, background: color.border }} />
      </div>
    </>
  );
}
