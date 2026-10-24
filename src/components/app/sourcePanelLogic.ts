/**
 * La part pure du panneau « brancher une source » de Business context
 * (docs/SPEC_RATTACHEMENT_SOURCES.md) : le libellé du bouton et le bilan de fin, testables sans DOM.
 */

export interface PanelProduct {
  id: string;
  name: string;
}

/** « Add to CreaFlow », ou « Add to 2 projects » quand les destinations diffèrent. Sans sélection,
 *  le bouton (désactivé) nomme le projet par défaut. */
export function destinationLabel(selection: ReadonlyArray<{ productId: string }>, products: ReadonlyArray<PanelProduct>, defaultProductId: string): string {
  const targets = new Set(selection.map((s) => s.productId));
  if (targets.size === 0) targets.add(defaultProductId);
  if (targets.size > 1) return `Add to ${targets.size} projects`;
  const [only] = [...targets];
  return `Add to ${products.find((p) => p.id === only)?.name ?? "this project"}`;
}

export interface PanelResult {
  sourceId: string;
  productId: string;
  error: string | null;
}

export interface PanelStatus {
  documents: number;
  unread: number;
  events: number;
}

export interface PanelSummary {
  /** Sources branchées sans erreur. */
  added: number;
  failed: number;
  events: number;
  /** Vrai quand plus rien n'est à lire : toutes les sources en succès ont `unread === 0`. */
  finished: boolean;
  /** Le nom du projet rejoint, ou « N projects ». */
  target: string;
}

/** Le bilan affiché pendant et après la lecture. Une source en erreur ne bloque pas la fin. */
export function summarizePanel(results: ReadonlyArray<PanelResult>, statuses: ReadonlyMap<string, PanelStatus>, products: ReadonlyArray<PanelProduct>): PanelSummary {
  const ok = results.filter((r) => !r.error);
  const read = ok.map((r) => statuses.get(r.sourceId));
  const finished = ok.length === 0 || read.every((s) => s !== undefined && s.unread === 0);
  const targets = new Set(ok.map((r) => r.productId));
  const target =
    targets.size === 1 ? (products.find((p) => p.id === [...targets][0])?.name ?? "this project") : `${targets.size} projects`;
  return {
    added: ok.length,
    failed: results.length - ok.length,
    events: read.reduce((n, s) => n + (s?.events ?? 0), 0),
    finished,
    target,
  };
}
