import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exchangeAuthCode,
  fetchFileMedia,
  fetchFileMetadata,
  pingDriveAccess,
  refreshAccessToken,
} from "./client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
});

describe("exchangeAuthCode", () => {
  it("échange le code contre un access token et un refresh token, avec redirect_uri=postmessage", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
    });

    const result = await exchangeAuthCode("auth-code");

    expect(result.accessToken).toBe("at");
    expect(result.refreshToken).toBe("rt");
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const [, options] = fetchMock.mock.calls[0];
    const body = options.body as URLSearchParams;
    expect(body.get("redirect_uri")).toBe("postmessage");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code");
  });

  it("lève une erreur explicite si Google ne renvoie pas de refresh_token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: "at", expires_in: 3600 }) });
    await expect(exchangeAuthCode("auth-code")).rejects.toThrow("Google n'a pas renvoyé de refresh token");
  });

  it("lève une erreur si la requête échoue", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "invalid_grant" });
    await expect(exchangeAuthCode("bad-code")).rejects.toThrow("Échange du code Google Drive échoué");
  });
});

describe("refreshAccessToken", () => {
  it("renvoie un nouvel access token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: "new-at", expires_in: 3600 }) });
    const result = await refreshAccessToken("rt");
    expect(result.accessToken).toBe("new-at");
  });

  it("lève une erreur si le refresh échoue", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => "invalid_grant" });
    await expect(refreshAccessToken("rt")).rejects.toThrow("Rafraîchissement du token Google Drive échoué");
  });
});

describe("fetchFileMetadata", () => {
  it("renvoie les métadonnées du fichier", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ name: "photo.jpg", mimeType: "image/jpeg", md5Checksum: "abc123" }),
    });
    const result = await fetchFileMetadata("file-1", "at");
    expect(result).toEqual({ name: "photo.jpg", mimeType: "image/jpeg", md5Checksum: "abc123" });
  });

  it("lève une erreur si le fichier est introuvable", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchFileMetadata("missing", "at")).rejects.toThrow("Métadonnées Drive introuvables");
  });
});

describe("fetchFileMedia", () => {
  it("renvoie les bytes et le mimeType depuis les en-têtes de réponse", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      // TextEncoder alloue un ArrayBuffer de taille exacte — contrairement à Buffer.from(str).buffer,
      // qui peut exposer un pool interne plus grand que la chaîne encodée.
      arrayBuffer: async () => new TextEncoder().encode("image-bytes").buffer,
      headers: new Map([["content-type", "image/png"]]),
    });
    const result = await fetchFileMedia("file-1", "at");
    expect(result.bytes.toString()).toBe("image-bytes");
    expect(result.mimeType).toBe("image/png");
  });

  it("lève une erreur si la lecture échoue", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    await expect(fetchFileMedia("file-1", "at")).rejects.toThrow("Lecture du fichier Drive");
  });
});

describe("pingDriveAccess", () => {
  it("renvoie true si l'appel réussit", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await expect(pingDriveAccess("at")).resolves.toBe(true);
  });

  it("renvoie false si l'appel échoue", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    await expect(pingDriveAccess("at")).resolves.toBe(false);
  });
});
