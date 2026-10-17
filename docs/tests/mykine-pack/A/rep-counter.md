# Compteur de répétitions

Dernière mise à jour : octobre 2026

Fichier : `apps/patient/src/pose/repCounter.ts`. Fonction pure, sans dépendance à la caméra : elle reçoit un angle lissé par image et renvoie un état et un compteur. Testée sur des séries enregistrées.

## Machine à états

Quatre états, une seule transition par image :

```
TOP ──(angle < bottomThreshold - H)──▶ DESCENDING ──(angle <= bottomTarget)──▶ BOTTOM
 ▲                                                                              │
 └──────(angle >= topThreshold + H, rep++)── ASCENDING ◀──(angle > bottomTarget + H)┘
```

- `topThreshold` : angle de départ de l'exercice (ex. 170° pour un squat, jambe tendue).
- `bottomTarget` : angle à atteindre pour que la répétition compte (ex. 100° pour un squat).
- `H = HYSTERESIS_DEG = 8` : marge appliquée aux seuils de sortie d'état.

Une répétition est comptée au retour en `TOP`, jamais à l'atteinte du bas. Une descente qui n'atteint pas `bottomTarget` revient en `TOP` sans incrémenter : elle est enregistrée comme `partial`.

## Hystérésis

Sans marge, un angle qui oscille autour du seuil (tremblement en bas de squat, micro-rebond en haut) fait passer l'état plusieurs fois dans les deux sens et compte des répétitions fantômes.

Résultats mesurés sur les 120 répétitions de squat annotées (`fixtures/reps/squat-*.json`) :

| Configuration | Faux positifs | Faux négatifs |
| :--- | :--- | :--- |
| Sans hystérésis | 18 % | 1 % |
| `HYSTERESIS_DEG = 8` | 4 % | 3 % |
| `HYSTERESIS_DEG = 12` | 3 % | 9 % |

La valeur retenue est 8°. Au-delà, les répétitions courtes mais valides ne sont plus comptées.

## Implémentation

```ts
export type RepState = "TOP" | "DESCENDING" | "BOTTOM" | "ASCENDING";

export interface RepCounter {
  state: RepState;
  count: number;
  partials: number;
  minAngle: number; // angle le plus bas atteint dans la répétition en cours
}

export function step(c: RepCounter, angle: number, ex: ExerciseThresholds): RepCounter {
  const H = HYSTERESIS_DEG;
  switch (c.state) {
    case "TOP":
      return angle < ex.bottomThreshold - H ? { ...c, state: "DESCENDING", minAngle: angle } : c;
    case "DESCENDING":
      if (angle <= ex.bottomTarget) return { ...c, state: "BOTTOM", minAngle: Math.min(c.minAngle, angle) };
      if (angle >= ex.topThreshold + H) return { ...c, state: "TOP", partials: c.partials + 1 };
      return { ...c, minAngle: Math.min(c.minAngle, angle) };
    case "BOTTOM":
      return angle > ex.bottomTarget + H ? { ...c, state: "ASCENDING" } : { ...c, minAngle: Math.min(c.minAngle, angle) };
    case "ASCENDING":
      return angle >= ex.topThreshold + H ? { ...c, state: "TOP", count: c.count + 1 } : c;
  }
}
```

`ExerciseThresholds` vient du catalogue (`exercises.md`). Pour les exercices où l'angle augmente pendant l'effort (élévations d'épaule), le catalogue fournit `inverted: true` et le compteur travaille sur `180 - angle`.

## Exercices isométriques

La chaise contre le mur n'a pas de répétitions : `holdSeconds` remplace `bottomTarget`. Le compteur passe en `BOTTOM` quand l'angle est dans la plage cible et accumule le temps tant qu'il y reste ; une sortie de plage de plus de `HOLD_GRACE_MS = 800` termine la tenue.

## Cadence

Entre deux images traitées, aucune interpolation. Avec le saut d'images (`FRAME_SKIP = 2`) sur un appareil à 9 fps, le compteur reçoit 4 à 5 angles par seconde, suffisant pour des répétitions de 1,5 s et plus. En dessous de 4 angles par seconde, l'app affiche « appareil trop lent » et refuse de démarrer l'exercice.

## Sortie par exercice

En fin d'exercice, l'app envoie :

```json
{
  "exercise_id": "squat",
  "reps": 12,
  "partials": 2,
  "target_reps": 12,
  "min_angle_mean": 96.4,
  "angle_series": [[0.0, 171.2], [0.1, 170.8], ...]
}
```

`angle_series` est échantillonnée à 10 Hz, `[t_secondes, angle_degrés]`.
