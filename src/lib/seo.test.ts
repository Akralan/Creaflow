import { describe, expect, it } from "vitest";
import { getSiteUrl, isIndexable, PRIVATE_ROUTE_PREFIXES, PUBLIC_ROUTES } from "./seo";

describe("isIndexable", () => {
  it("refuse sans APP_URL", () => {
    expect(isIndexable({})).toBe(false);
  });

  it("refuse le local et les hôtes de démo (OVH, sslip, nip)", () => {
    for (const url of [
      "http://localhost:3000",
      "https://127.0.0.1",
      "https://vps-a004fa72.vps.ovh.ca",
      "https://vps123.vps.ovh.net",
      "https://51-222-221-182.sslip.io",
      "https://1-2-3-4.nip.io",
      "https://app.localhost",
    ]) {
      expect(isIndexable({ APP_URL: url }), url).toBe(false);
    }
  });

  it("refuse une adresse en http même sur un vrai domaine", () => {
    expect(isIndexable({ APP_URL: "http://creaflow.fr" })).toBe(false);
  });

  it("accepte un vrai domaine en https", () => {
    expect(isIndexable({ APP_URL: "https://creaflow.fr" })).toBe(true);
    expect(isIndexable({ APP_URL: "https://app.creaflow.fr/" })).toBe(true);
  });

  it("laisse SEO_INDEXABLE trancher dans les deux sens", () => {
    expect(isIndexable({ APP_URL: "https://vps-a004fa72.vps.ovh.ca", SEO_INDEXABLE: "true" })).toBe(true);
    expect(isIndexable({ APP_URL: "https://creaflow.fr", SEO_INDEXABLE: "false" })).toBe(false);
    expect(isIndexable({ APP_URL: "https://creaflow.fr", SEO_INDEXABLE: " TRUE " })).toBe(true);
  });

  it("refuse une APP_URL illisible", () => {
    expect(isIndexable({ APP_URL: "pas une url" })).toBe(false);
  });
});

describe("getSiteUrl", () => {
  it("retombe sur localhost sans APP_URL ou avec une valeur illisible", () => {
    expect(getSiteUrl({}).origin).toBe("http://localhost:3000");
    expect(getSiteUrl({ APP_URL: "n'importe quoi" }).origin).toBe("http://localhost:3000");
  });

  it("lit APP_URL", () => {
    expect(getSiteUrl({ APP_URL: "https://creaflow.fr" }).origin).toBe("https://creaflow.fr");
  });
});

describe("routes", () => {
  it("aucune route publique n'est aussi un préfixe privé", () => {
    for (const route of PUBLIC_ROUTES) {
      const blocked = PRIVATE_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix));
      expect(blocked, route).toBe(false);
    }
  });
});
