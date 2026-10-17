# Boîtier MyKiné

**Statut : abandonné.** Spécification conservée pour référence.

## Objet

Appareil autonome pour les patients sans smartphone compatible. Il se pose dans le salon, face au patient, et fait tourner la même pose estimation que l'app, avec un écran pour le compteur et le feedback.

## Matériel

| Composant | Référence | Prix (pièces, TTC) |
| :--- | :--- | :--- |
| Carte | Raspberry Pi 5, 4 Go | 62 € |
| Caméra | Raspberry Pi Camera Module 3 (large) | 36 € |
| Écran | 7" tactile officiel, 800×480 | 78 € |
| Alimentation | 27 W USB-C officielle | 14 € |
| Boîtier | impression 3D, PETG, 2 pièces | 4 € |
| Carte SD | 32 Go A2 | 9 € |

Total estimé des pièces : 94 € en version Pi 5 4 Go sans écran tactile (écran remplacé par un retour sur la télévision via HDMI) ; 203 € avec l'écran 7".

## Logiciel

- Raspberry Pi OS Lite 64 bits.
- Pose estimation : MediaPipe Pose en Python, modèle `lite`, 256×256.
- Cadence mesurée : 11 fps sur Pi 5 avec le modèle `lite`, 5 fps avec `full`.
- Même logique de compteur que l'app, portée en Python (`hardware/boitier/repcounter.py`), mêmes seuils tirés de `exercises.yaml`.
- Réseau : Wi-Fi configuré par QR code affiché à l'écran et scanné par le kiné au cabinet avant remise au patient.
- Identification : le code du lien patient saisi une fois par le kiné (`/etc/mykine/code`).
- Envoi des séances : même endpoint `POST /api/v1/s/{code}/sessions`.

## Fonctionnement prévu

1. Le patient allume le boîtier (bouton unique).
2. L'écran affiche le programme du jour.
3. Cadrage : même contrainte d'angle de trois quarts que l'app ; le boîtier étant posé, le patient se déplace jusqu'à ce que le gabarit soit vert.
4. Exercices, compteur, feedback couleur, repos entre séries.
5. Envoi automatique en fin de séance ; mise en file si le Wi-Fi est absent.

## Contraintes identifiées

- Le boîtier ne résout pas la contrainte d'angle : le patient doit se placer correctement, comme avec un téléphone.
- Cadence insuffisante pour le modèle `full` ; le modèle `lite` sur Pi 5 est au niveau d'un Pixel 4a avec saut d'images.
- Logistique : assemblage, test, remise en main propre par le kiné, retour en fin de rééducation, réinitialisation.
- Coût unitaire hors assemblage et marge : 94 à 203 € par patient équipé, à porter par le kiné ou par MyKiné.

## Décision

Abandonné. La cible « patients sans smartphone » est hors périmètre (`VISION.md`). La version web de repli (`patient-flow.md`) couvre les patients avec un téléphone ancien.

## Ce qui est conservé

- `hardware/boitier/repcounter.py` : portage Python du compteur, utilisé par les tests de l'API pour rejouer des séries d'angles.
- Fichiers STL du boîtier dans `hardware/boitier/stl/`.
