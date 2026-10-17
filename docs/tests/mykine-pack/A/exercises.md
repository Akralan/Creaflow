# Catalogue des exercices

Dernière mise à jour : octobre 2026 — 14 exercices (v0.4)

Source de vérité : `services/api/mykine/exercises.yaml`, chargé en base par `seed.py` dans la table `exercises`. L'app patient télécharge le catalogue avec le programme (`GET /api/v1/s/{code}`) et ne contient aucune valeur en dur.

## Format d'une entrée

```yaml
- id: squat
  name: Squat
  position: standing          # standing | seated | wall
  side: both                  # left | right | both
  angle: kneeFlexion          # voir pose-estimation.md
  inverted: false             # true si l'angle augmente pendant l'effort
  top_threshold: 170
  bottom_target: 100
  feedback:
    green_below: 105          # amplitude atteinte
    orange_below: 125         # amplitude insuffisante
  alignment:                  # contrôle secondaire optionnel
    angle: hipFlexion
    min: 60
```

`top_threshold`, `bottom_target` : seuils du compteur (voir `rep-counter.md`). `feedback` : bornes de la couleur affichée sur le membre pendant la répétition. `alignment` : second angle surveillé, qui passe le feedback en rouge s'il sort de sa plage.

## Catalogue

| id | Nom | Position | Angle suivi | Haut | Cible bas | Côté |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `squat` | Squat | debout | `kneeFlexion` | 170 | 100 | both |
| `lunge_front` | Fente avant | debout | `kneeFlexion` (jambe avant) | 170 | 95 | left / right |
| `lunge_side` | Fente latérale | debout | `kneeFlexion` (jambe fléchie) | 170 | 110 | left / right |
| `wall_sit` | Chaise contre le mur | mur | `kneeFlexion` | — | 90 ± 10, tenue | both |
| `step_up` | Montée sur marche | debout | `kneeFlexion` (jambe sur la marche) | 170 | 95 | left / right |
| `calf_raise` | Montée sur pointes | debout | `ankleFlexion` | 90 | 130 (inverted) | both |
| `knee_ext_seated` | Extension du genou assis | assis | `kneeFlexion` | 90 | 165 (inverted) | left / right |
| `knee_flex_standing` | Flexion du genou debout (talon-fesse) | debout | `kneeFlexion` | 175 | 70 | left / right |
| `hip_abd_standing` | Abduction de hanche debout | debout | `hipFlexion` (plan frontal) | 175 | 145 | left / right |
| `hip_flex_standing` | Flexion de hanche debout (genou levé) | debout | `hipFlexion` | 175 | 95 | left / right |
| `shoulder_abd` | Élévation latérale de l'épaule | debout | `shoulderAbduction` | 20 | 90 (inverted) | left / right |
| `shoulder_flex` | Élévation frontale de l'épaule | debout | `shoulderAbduction` (plan sagittal) | 20 | 90 (inverted) | left / right |
| `shoulder_ext_rot` | Rotation externe de l'épaule, coude au corps | debout | `elbowFlexion` projeté | 90 | 90, déplacement poignet ≥ 15 cm | left / right |
| `elbow_curl` | Flexion du coude | debout | `elbowFlexion` | 165 | 50 | left / right |

Angles en degrés. « inverted » : la cible est un angle plus grand que l'angle de départ ; le compteur travaille sur `180 - angle`.

## Détail des seuils de feedback

| id | Vert si | Orange si | Rouge si |
| :--- | :--- | :--- | :--- |
| `squat` | `kneeFlexion` ≤ 105 | 105 < angle ≤ 125 | `hipFlexion` < 60 (tronc penché) |
| `lunge_front` | ≤ 100 | 100–120 | genou avant dépasse la pointe de pied de plus de 8 % de la longueur du tibia |
| `lunge_side` | ≤ 115 | 115–135 | — |
| `wall_sit` | 80–100 pendant la tenue | 100–115 | > 115 ou < 80 |
| `step_up` | ≤ 100 | 100–120 | — |
| `calf_raise` | ≥ 125 | 110–125 | — |
| `knee_ext_seated` | ≥ 160 | 145–160 | — |
| `knee_flex_standing` | ≤ 75 | 75–95 | `hipFlexion` < 150 (compensation du tronc) |
| `hip_abd_standing` | ≤ 150 | 150–162 | tronc incliné : écart épaules/hanches > 12° |
| `hip_flex_standing` | ≤ 100 | 100–120 | — |
| `shoulder_abd` | ≥ 85 | 65–85 | épaule remontée : épaule plus haute que l'autre de > 6 % |
| `shoulder_flex` | ≥ 85 | 65–85 | — |
| `shoulder_ext_rot` | déplacement ≥ 15 cm | 8–15 cm | coude décollé du tronc |
| `elbow_curl` | ≤ 55 | 55–75 | — |

## Paramètres de prescription

Dans un programme (`program_exercises`), le kiné règle par exercice :

- `target_reps` (1–30) ou `hold_seconds` (5–120) pour `wall_sit`
- `sets` (1–5)
- `side` quand l'exercice est latéralisé
- `days` : jours de la semaine
- `note` : consigne libre affichée avant l'exercice (200 caractères)

Les seuils d'angle ne sont pas modifiables par le kiné en v0.4.

## Hors catalogue

Exercices au sol (pont fessier, gainage, relevé de jambe allongé, abdominaux) : le modèle perd le bassin en position allongée et les angles de hanche et de genou ne sont plus calculables. Ces exercices ne sont pas proposés. Les exercices avec matériel (élastique, haltère) sont acceptés quand le mouvement est l'un des 14 ci-dessus ; le matériel n'est pas détecté.
