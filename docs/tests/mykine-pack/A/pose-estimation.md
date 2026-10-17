# Pose estimation

Dernière mise à jour : octobre 2026

## Modèle

MediaPipe Pose (BlazePose), exécuté sur l'appareil via `react-native-fast-tflite`. Deux fichiers embarqués dans `apps/patient/assets/models/` :

| Fichier | Entrée | Points | Usage |
| :--- | :--- | :--- | :--- |
| `pose_landmark_full.tflite` | 256×256 | 33 | Par défaut |
| `pose_landmark_lite.tflite` | 256×256 | 33 | Appareils sous `MIN_FPS_FOR_FULL` |

Le détecteur de personne (`pose_detection.tflite`) tourne une fois au démarrage de l'exercice puis toutes les 30 images ; entre deux détections, la région d'intérêt est recalée sur les points de l'image précédente.

## Performances mesurées

Mesures en conditions réelles, 640×480, éclairage intérieur, un seul sujet dans l'image.

| Appareil | `lite` | `full` |
| :--- | :--- | :--- |
| Pixel 7 | 24 fps | 19 fps |
| Pixel 4a | 15 fps | 9 fps |
| iPhone 11 | 14 fps | 8 fps |

Choix du modèle au lancement (`src/pose/modelSelect.ts`) : une mesure de 3 secondes avec `full` ; si la cadence est inférieure à `MIN_FPS_FOR_FULL = 12`, on active le saut d'images (une image sur deux traitée, `FRAME_SKIP = 2`) ; si elle reste sous `MIN_FPS_FOR_LITE = 8`, on bascule sur `lite`. Le compteur fonctionne correctement à partir de 8 images traitées par seconde pour tous les exercices du catalogue (vitesse d'exécution maximale attendue : 1 répétition toutes les 1,5 s).

## Points utilisés

Indices MediaPipe conservés (les autres sont ignorés) :

| Index | Point |
| :--- | :--- |
| 11, 12 | épaule gauche, droite |
| 13, 14 | coude gauche, droit |
| 15, 16 | poignet gauche, droit |
| 23, 24 | hanche gauche, droite |
| 25, 26 | genou gauche, droit |
| 27, 28 | cheville gauche, droite |
| 31, 32 | pointe de pied gauche, droite |

Un point dont `visibility < VISIBILITY_MIN = 0.6` est marqué absent. Un angle dont l'un des trois points est absent n'est pas calculé pour cette image ; le compteur conserve son état précédent.

## Angles

```ts
// src/pose/angles.ts
export function jointAngle(a: Point, b: Point, c: Point): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  return (Math.acos(dot / mag) * 180) / Math.PI; // 0..180
}
```

Angles calculés en 2D sur les coordonnées image (x, y). La coordonnée z du modèle n'est pas utilisée : trop bruitée sur les appareils testés.

Angles standard, nommés dans `src/pose/angles.ts` :

| Nom | Points (a, b, c) |
| :--- | :--- |
| `kneeFlexion` | hanche, genou, cheville |
| `hipFlexion` | épaule, hanche, genou |
| `elbowFlexion` | épaule, coude, poignet |
| `shoulderAbduction` | hanche, épaule, poignet |
| `ankleFlexion` | genou, cheville, pointe de pied |

Chaque angle existe en version gauche et droite. L'exercice déclare quel côté il suit (`side: "left" | "right" | "both"`).

## Lissage

Moyenne glissante sur 3 images par angle (`SMOOTHING_WINDOW = 3`). Pas de filtre de Kalman : le gain mesuré ne justifiait pas la complexité.

## Cadrage

Avant chaque séance, `src/pose/framing.ts` impose :

- le corps entier visible (points 11-12 et 27-28 présents pendant 2 s) ;
- un angle de prise de vue de trois quarts, `MIN_CAMERA_ANGLE_DEG = 45`, estimé par `shoulderWidth / hipWidth` projeté. De profil, le genou arrière est masqué par le genou avant et le modèle produit des sauts de position.

Le patient voit un gabarit à l'écran et un message tant que les deux conditions ne sont pas remplies.

## Limites connues

- Positions allongées : le bassin (23, 24) perd sa visibilité, les angles de hanche et de genou deviennent inexploitables. Les exercices au sol sont hors catalogue (voir `exercises.md`).
- Occlusion d'un bras par le tronc sur les élévations d'épaule de face : traitée par le cadrage à 45°.
- Deux personnes dans l'image : le détecteur garde la plus grande boîte, sans garantie.
