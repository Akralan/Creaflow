import { describe, expect, it } from "vitest";
import { getSiteUrl, isIndexable, PRIVATE_ROUTE_PREFIXES, PUBLIC_ROUTES } from "./seo";

describe("isIndexable", () => {
  it("rejects without APP_URL", () => {
    expect(isIndexable({})).toBe(false);
  });

  it("rejects local and demo hosts (OVH, sslip, nip)", () => {
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

  it("rejects an http address even on a real domain", () => {
    expect(isIndexable({ APP_URL: "http://creaflow.fr" })).toBe(false);
  });

  it("accepts a real domain over https", () => {
    expect(isIndexable({ APP_URL: "https://creaflow.fr" })).toBe(true);
    expect(isIndexable({ APP_URL: "https://app.creaflow.fr/" })).toBe(true);
  });

  it("lets SEO_INDEXABLE decide either way", () => {
    expect(isIndexable({ APP_URL: "https://vps-a004fa72.vps.ovh.ca", SEO_INDEXABLE: "true" })).toBe(true);
    expect(isIndexable({ APP_URL: "https://creaflow.fr", SEO_INDEXABLE: "false" })).toBe(false);
    expect(isIndexable({ APP_URL: "https://creaflow.fr", SEO_INDEXABLE: " TRUE " })).toBe(true);
  });

  it("rejects an unreadable APP_URL", () => {
    expect(isIndexable({ APP_URL: "not a url" })).toBe(false);
  });
});

describe("getSiteUrl", () => {
  it("falls back to localhost without APP_URL or with an unreadable value", () => {
    expect(getSiteUrl({}).origin).toBe("http://localhost:3000");
    expect(getSiteUrl({ APP_URL: "whatever" }).origin).toBe("http://localhost:3000");
  });

  it("reads APP_URL", () => {
    expect(getSiteUrl({ APP_URL: "https://creaflow.fr" }).origin).toBe("https://creaflow.fr");
  });
});

describe("routes", () => {
  it("no public route is also a private prefix", () => {
    for (const route of PUBLIC_ROUTES) {
      const blocked = PRIVATE_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix));
      expect(blocked, route).toBe(false);
    }
  });
});
