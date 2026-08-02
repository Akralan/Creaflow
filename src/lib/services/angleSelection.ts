/** Choisit l'angle actif le moins récemment utilisé (jamais utilisé = prioritaire).
 *  recentAngleIdsDesc : angleId des scripts récents de la même catégorie, du plus récent au plus ancien.
 *  Déterministe : à égalité (plusieurs angles jamais utilisés), renvoie le premier de activeAngles. */
export function selectLeastRecentlyUsedAngle<T extends { id: string }>(
  activeAngles: T[],
  recentAngleIdsDesc: string[]
): T | null {
  if (activeAngles.length === 0) return null;

  const lastUsedRank = new Map<string, number>(); // angleId -> position (0 = le plus récent)
  recentAngleIdsDesc.forEach((id, i) => {
    if (!lastUsedRank.has(id)) lastUsedRank.set(id, i);
  });

  let best = activeAngles[0];
  let bestRank = lastUsedRank.get(best.id) ?? Infinity;
  for (const angle of activeAngles.slice(1)) {
    const rank = lastUsedRank.get(angle.id) ?? Infinity;
    if (rank > bestRank) {
      best = angle;
      bestRank = rank;
    }
  }
  return best;
}
