import { describe, expect, it } from "vitest";
import { destinationLabel, summarizePanel } from "./sourcePanelLogic";

const products = [
  { id: "cf", name: "CreaFlow" },
  { id: "mk", name: "MyKiné" },
];

describe("destinationLabel", () => {
  it("nomme le projet par défaut quand rien n'est coché", () => {
    expect(destinationLabel([], products, "cf")).toBe("Add to CreaFlow");
  });

  it("nomme le seul projet visé", () => {
    expect(destinationLabel([{ productId: "mk" }, { productId: "mk" }], products, "cf")).toBe("Add to MyKiné");
  });

  it("compte les projets quand les destinations diffèrent", () => {
    expect(destinationLabel([{ productId: "cf" }, { productId: "mk" }], products, "cf")).toBe("Add to 2 projects");
  });
});

describe("summarizePanel", () => {
  const results = [
    { sourceId: "s1", productId: "cf", error: null },
    { sourceId: "s2", productId: "cf", error: null },
    { sourceId: "s3", productId: "cf", error: "Notion said no" },
  ];

  it("n'est pas fini tant qu'une source en succès a des documents à lire", () => {
    const statuses = new Map([
      ["s1", { documents: 3, unread: 0, events: 12 }],
      ["s2", { documents: 2, unread: 1, events: 4 }],
    ]);
    const s = summarizePanel(results, statuses, products);
    expect(s.finished).toBe(false);
    expect(s.events).toBe(16);
    expect(s.added).toBe(2);
    expect(s.failed).toBe(1);
  });

  it("est fini quand tout est lu, une source en erreur ne bloque pas", () => {
    const statuses = new Map([
      ["s1", { documents: 3, unread: 0, events: 12 }],
      ["s2", { documents: 2, unread: 0, events: 9 }],
    ]);
    const s = summarizePanel(results, statuses, products);
    expect(s.finished).toBe(true);
    expect(s.events).toBe(21);
    expect(s.target).toBe("CreaFlow");
  });

  it("sans état encore reçu, pas fini ; sans aucune source en succès, fini", () => {
    expect(summarizePanel(results, new Map(), products).finished).toBe(false);
    expect(summarizePanel([results[2]], new Map(), products).finished).toBe(true);
  });

  it("nomme le nombre de projets quand les sources en rejoignent plusieurs", () => {
    const two = [
      { sourceId: "a", productId: "cf", error: null },
      { sourceId: "b", productId: "mk", error: null },
    ];
    expect(summarizePanel(two, new Map(), products).target).toBe("2 projects");
  });
});
