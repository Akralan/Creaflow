/** Picks the least recently used active angle (never used = priority).
 *  recentAngleIdsDesc: angleId of recent scripts in the same category, from most recent to oldest.
 *  Deterministic: on a tie (several angles never used), returns the first of activeAngles. */
export function selectLeastRecentlyUsedAngle<T extends { id: string }>(
  activeAngles: T[],
  recentAngleIdsDesc: string[]
): T | null {
  if (activeAngles.length === 0) return null;

  const lastUsedRank = new Map<string, number>(); // angleId -> position (0 = most recent)
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
