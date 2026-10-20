/**
 * À qui un événement est-il racontable, et dans quels mots (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §3).
 *
 * Module PUR. Il porte l'inversion qui a coûté trois posts illisibles : jusqu'ici un événement sans
 * public était offert à TOUTES les séries, et le trieur à qui on demandait « pour qui ? » apprenait
 * dans la description de son outil que répondre « personne » voulait dire « tout le monde ».
 * Désormais « personne » veut dire personne.
 *
 * Trois exceptions, et seulement trois, parce qu'inverser un défaut sans elles ferait disparaître de
 * la matière légitime : une série sans lecteur, un sujet sans portrait, et ce que l'auteur a écrit
 * lui-même.
 */

export interface AudienceAngle {
  audience: string;
  /** Ce que ce fait change pour ce public, dans ses mots. Jamais vide. */
  whatItChanges: string;
}

export interface TellableEvent {
  audienceAngles: unknown;
  origin: "reader" | "user";
  qualifiedAt: Date | null;
}

/**
 * Lecture tolérante d'un `material_events.audience_angles`. Un angle qui nomme un public absent du
 * portrait est retiré : le modèle peut inventer une étiquette, le code ne le suit pas.
 */
export function parseAudienceAngles(raw: unknown, portraitLabels: string[]): AudienceAngle[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(portraitLabels);
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { audience, whatItChanges } = item as { audience?: unknown; whatItChanges?: unknown };
    if (typeof audience !== "string" || !known.has(audience)) return [];
    if (typeof whatItChanges !== "string" || !whatItChanges.trim()) return [];
    return [{ audience, whatItChanges: whatItChanges.trim() }];
  });
}

/** Les étiquettes retenues, dans l'ordre, sans doublon — c'est ce que la colonne `audiences` garde. */
export function audiencesOf(angles: AudienceAngle[]): string[] {
  return [...new Set(angles.map((a) => a.audience))];
}

export function tellableTo(event: TellableEvent, readerLabel: string | null, portraitLabels: string[]): boolean {
  if (!readerLabel) return true;
  if (portraitLabels.length === 0) return true;
  if (event.origin === "user") return true;
  if (event.qualifiedAt === null) return false;
  return parseAudienceAngles(event.audienceAngles, portraitLabels).some((a) => a.audience === readerLabel);
}

/** La ligne à poser devant le rédacteur, à côté des faits. Null quand il n'y en a pas. */
export function angleFor(event: TellableEvent, readerLabel: string | null, portraitLabels: string[]): string | null {
  if (!readerLabel) return null;
  return parseAudienceAngles(event.audienceAngles, portraitLabels).find((a) => a.audience === readerLabel)?.whatItChanges ?? null;
}
