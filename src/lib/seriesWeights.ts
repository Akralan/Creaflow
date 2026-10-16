// Module pur (aucun accès base) : utilisé par le service ET par l'écran Direction, qui affiche les
// pourcentages recalculés pendant qu'on coche et décoche.

/**
 * Le pourcentage d'une série est sa part des créneaux ; le reste part en posts libres. Retirer une
 * série ne doit pas transformer sa part en posts libres : les séries gardées se partagent le total
 * d'avant, au prorata de leur poids. Arrondi à l'entier, l'écart d'arrondi va à la plus lourde.
 */
export function rescaleKeptWeights(
  all: Array<{ id: string; weight: number }>,
  keptIds: string[]
): Array<{ id: string; weight: number }> {
  const kept = all.filter((s) => keptIds.includes(s.id));
  const keptTotal = kept.reduce((sum, s) => sum + s.weight, 0);
  const target = Math.min(100, all.reduce((sum, s) => sum + s.weight, 0));
  if (kept.length === 0 || keptTotal === 0 || keptTotal === target) return kept.map(({ id, weight }) => ({ id, weight }));

  const scaled = kept.map((s) => ({ id: s.id, weight: Math.round((s.weight * target) / keptTotal) }));
  const drift = target - scaled.reduce((sum, s) => sum + s.weight, 0);
  const heaviest = scaled.reduce((max, s) => (s.weight > max.weight ? s : max), scaled[0]);
  heaviest.weight = Math.max(0, heaviest.weight + drift);
  return scaled;
}
