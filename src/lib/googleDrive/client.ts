const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_ABOUT_ENDPOINT = "https://www.googleapis.com/drive/v3/about";

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET doivent être définis dans l'environnement.");
  }
  return { clientId, clientSecret };
}

export interface ExchangedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Échange le `code` renvoyé par `google.accounts.oauth2.initCodeClient({ux_mode: "popup"})` côté
 * client contre un access token + un refresh token. `redirect_uri: "postmessage"` est la valeur
 * conventionnelle attendue par Google pour ce flow popup (même mécanique que l'ancien
 * `grantOfflineAccess` de gapi auth2) — il n'y a pas de vraie redirection HTTP dans ce cas.
 */
export async function exchangeAuthCode(code: string): Promise<ExchangedTokens> {
  const { clientId, clientSecret } = getCredentials();
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Échange du code Google Drive échoué (${response.status}) : ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!data.refresh_token) {
    // Google ne renvoie un refresh_token qu'au premier consentement (access_type=offline).
    // Sans lui, l'usage différé (§7.3 du cadrage) est impossible — on le traite comme une erreur
    // explicite plutôt que de stocker une connexion inutilisable au-delà de l'heure courante.
    throw new Error(
      "Google n'a pas renvoyé de refresh token — le consentement a peut-être déjà été donné ; révoquer l'accès depuis myaccount.google.com/permissions puis réessayer."
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const { clientId, clientSecret } = getCredentials();
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Rafraîchissement du token Google Drive échoué (${response.status}) : ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

export interface DriveFileMetadata {
  name: string;
  mimeType: string;
  md5Checksum: string;
}

export async function fetchFileMetadata(fileId: string, accessToken: string): Promise<DriveFileMetadata> {
  const response = await fetch(
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?fields=name,mimeType,md5Checksum`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Métadonnées Drive introuvables pour ${fileId} (${response.status}).`);
  }

  return response.json();
}

export async function fetchFileMedia(fileId: string, accessToken: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Lecture du fichier Drive ${fileId} échouée (${response.status}).`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, mimeType: response.headers.get("content-type") || "application/octet-stream" };
}

/** Appel Drive minimal (aucun fileId requis) — sert de sonde de joignabilité avant un pipeline. */
export async function pingDriveAccess(accessToken: string): Promise<boolean> {
  const response = await fetch(`${DRIVE_ABOUT_ENDPOINT}?fields=user`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.ok;
}
