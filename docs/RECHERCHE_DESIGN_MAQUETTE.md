# Recherche — règles de design pour la maquette

> **Note de recherche du 2026-10-17**, base du futur chantier maquette (« qualité Claude Design », surtout l'animation). Rien n'est implémenté. Les sources marquées « non vérifié » n'ont été lues qu'à travers des tiers.

## Sources lues

- Skill `frontend-design` d'Anthropic, lu en entier : https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md
- Skill `canvas-design`, lu sous forme de résumé : https://raw.githubusercontent.com/anthropics/skills/main/skills/canvas-design/SKILL.md
- Références des types d'artefacts Claude « design » et « slides », issues d'une fuite (dépôt `asgeirtj/system_prompts_leaks`, dossier `Anthropic/artifact-types/`) : `craft.md`, `layout.md`, `styles.md`, `format.md` (section Motion). Authenticité non garantie.
- Prompt de v0, section « Design Guidelines » (dépôt `x1xhlol/system-prompts-and-models-of-ai-tools`).
- Jetons de mouvement Material 3 (docs Android) : https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Motion.md
- Carbon (IBM), Motion : https://carbondesignsystem.com/elements/motion/overview/
- NN/g, durée des animations : https://www.nngroup.com/articles/animation-duration/
- WCAG 2.1, critères 1.4.3, 1.4.11 et 2.2.2 : https://www.w3.org/TR/WCAG21/
- Practical Typography, longueur de ligne et interlignage.
- Grille de 8 points : https://spec.fm/specifics/8-pt-grid
- Netflix Timed Text Style Guide (vitesse de lecture).
- Les 12 principes de l'animation (Wikipédia).
- Non vérifié : Brysbaert 2019 (vitesse de lecture, via résumé) ; marges de sécurité Meta/Instagram (via des sites tiers, chiffres divergents).
- Non lus : Apple HIG Motion, material.io, Refactoring UI, l'aide officielle de Meta, les guides LinkedIn et X.

## Règles (chiffrées et vérifiables par le code quand c'est possible)

**Typographie**
1. Au plus 2 familles de polices par maquette ; si deux, nettement contrastées.
2. Une échelle de 3 à 4 tailles sur toute la maquette ; ratio ≥ 1,25 entre deux tailles voisines ; minimum ≈ 28 px sur 1080 px de large.
3. Interlignage : titres 1,05 à 1,15 avec un `letter-spacing` négatif ; texte courant 1,3 à 1,45.
4. Longueur de ligne : moins de 80 caractères pour le texte, 20 à 35 pour un titre.
5. Pas les tics d'IA :
   - un seul mot coloré ou en italique dans un titre ;
   - un sur-titre en capitales espacées au-dessus de chaque titre ;
   - les « A · B · C » ;
   - une flèche « → » sur les boutons ;
   - une numérotation 01/02/03 sans vraie séquence.

**Composition**
6. Marges de sécurité par format :
   - carré ou 4:5 : au moins 7 % ;
   - 9:16 : haut ≥ 14 %, bas ≥ 35 %, côtés ≥ 6 % (chiffres non vérifiés à la source).
7. Espacements en multiples de 8 px.
8. Une idée et un seul élément marquant par slide ; le reste reste calme.
9. Au plus 4 à 6 calques visibles par slide ; aucun remplissage.
10. Aucun texte qui se chevauche ou qui déborde.
11. Dans un carrousel, le titre est au même endroit d'une slide à l'autre (±8 px).

**Couleur**
12. 3 à 5 couleurs avec un rôle chacune : fond, texte, primaire, 0 à 2 accents.
13. Contraste du texte ≥ 4,5:1, ou ≥ 3:1 au-delà de 24 px. Boutons et badges ≥ 3:1 par rapport à leur fond.
14. Au plus un dégradé ; une ombre douce, jamais sur le texte ; une rotation sur une photo au plus.
15. Éviter les palettes typiques de l'IA :
    - crème avec un accent terracotta ;
    - quasi-noir avec un vert acide ;
    - violet dominant.

**Photos**
16. `object-fit:cover`, ou `contain` pour une capture d'écran. Le texte se pose sur une zone calme ou sur un voile mesuré.

**Animation**
17. Entrées de 200 à 500 ms en ease-out (decelerate). Sorties plus courtes, 150 à 300 ms, en ease-in (accelerate).
18. Décalage de 60 à 120 ms entre éléments d'un même groupe. Aucune source ne donne ce chiffre : c'est une interprétation.
19. Un seul point focal en mouvement à la fois ; au plus 2 entrées qui se chevauchent.
20. Une seule famille de mouvement par vidéo.
21. Temps de lecture : chaque moment reste lisible au moins `max(1500 ms, caractères / 15 × 1000)`.
22. La fin, avec l'appel à l'action, est tenue au moins 1,5 à 2 s.
23. Machine à écrire seulement sur une ligne de 30 caractères au plus. C'est une estimation.

## Ce que le code actuel contredit

- La marge de 5 % est identique pour tous les formats, et trop faible pour le 9:16.
- La limite de « 3 tailles » s'applique par slide et non à la maquette ; il n'y a ni échelle, ni minimum, ni interlignage, ni longueur de ligne.
- La palette du prompt (3 à 5 couleurs) ne concorde pas avec celle du schéma Zod (2 à 6), et les couleurs n'ont pas de rôle.
- Le « contraste fort » n'est ni chiffré ni contrôlé.
- Inter est dans `fonts.ts`, alors qu'il fait partie des polices galvaudées selon les deux sources Claude.
- L'ambiance (`mood`) est un champ libre : il n'y a ni direction artistique, ni passe de plan, ni passe d'auto-critique.
- La liste des tics à éviter est absente.
- Tout est en `position:absolute` avec une hauteur fixe, d'où débordements et espacements au hasard. Le deck Claude n'épingle que le fond, les badges et les pieds de slide, et laisse le texte dans le flux.
- Le « cadre de téléphone » avec encoche est de la fausse interface, que Claude interdit.
- Animation :
  - entrées jusqu'à 800 ms, trop lentes ;
  - un seul easing, codé en dur ;
  - ni décalage ni temps de lecture ;
  - chevauchement de deux textes autorisé ;
  - cinq effets mélangeables sans règle ;
  - le zoom part de 0,85, ce qui fait un saut ;
  - le « léger zoom » sur une photo n'est en fait qu'un fondu ;
  - la machine à écrire est un `clip-path` qui découvre la boîte en colonnes, pas lettre par lettre.

## Recommandations d'architecture, par impact

1. **Directions artistiques prédéfinies** (6 à 10) choisies par le modèle : chacune fixe une paire de polices, des rôles de couleur, une échelle de tailles, des marges, un style de photo et un langage de mouvement.
2. **Gabarits de mise en page par format** : zones nommées calculées par le code, avec le texte en flux à l'intérieur.
3. **Contrôles automatiques** renvoyés au second appel, et corrections triviales faites directement par le code.
4. **Ligne de temps calculée par le code** à partir d'une intention (ordre des moments, calque focal, style de mouvement).
5. **Moteur d'animation enrichi** :
   - lent zoom continu sur la photo de fond ;
   - découpage d'un titre par mots, avec décalage ;
   - deux easings, un pour l'entrée et un pour la sortie ;
   - zoom à partir de 0,96 ;
   - vraie machine à écrire, lettre par lettre.
6. **Auto-critique visuelle** : rendu PNG côté serveur, critique, puis une passe de correction.
7. **Passe de plan** avant le HTML : direction choisie, croquis, justification.
8. **Nettoyage des polices et des éléments d'interface.**
9. **Mémoire des maquettes déjà proposées**, pour varier d'un post à l'autre.
