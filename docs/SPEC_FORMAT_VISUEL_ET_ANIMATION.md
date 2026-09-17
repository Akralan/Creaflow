# SPEC — FORMAT DU POST VISUEL : IMAGE, CARROUSEL OU ANIMATION

> **Statut : implémenté (Lots 0 à 4) sur `feature/format-visuel-animation`, migrations `0031` (format + données) et `0032` (ligne de temps), non testé avec une vraie clé LLM ni dans un navigateur réel.** Écarts assumés : les scripts importés reçoivent un format dérivé de leur storyboard (pas de sélecteur à l'import) ; la vignette d'une animation est l'état final de la slide ; le repli WebM n'est pas fait. **À vérifier en priorité** : l'export MP4 (WebCodecs + `mp4-muxer`) sur Chrome, puis la lisibilité du fichier par Instagram/TikTok. Prolonge `docs/SPEC_DESIGN_HTML_SUR_IMAGE.md` (la maquette). Demande du 2026-09-17 : « quand je fais un script image, choisir le nombre de slides ou si c'est une animation », l'animation étant « une seule slide qui est une animation avec texte, d'une durée de 5 à 10 s ».
>
> **Objectif.** Aujourd'hui, un post visuel est un storyboard dont le modèle décide seul le nombre d'entrées, et une maquette statique (une slide = un PNG). Ce chantier donne à l'auteur **le choix du format au moment de générer** — image unique, carrousel de N slides, ou animation — et fait de l'animation un vrai livrable : **une seule slide dont les calques apparaissent, bougent et disparaissent dans le temps**, exportée en **vidéo** prête à publier en Reel, TikTok ou story.
>
> **Ce qui rend ce chantier abordable :** l'animation réutilise tout ce que la maquette a construit. Même HTML, mêmes calques, même liste blanche, même éditeur. On y ajoute une **ligne de temps** (quand chaque calque entre, comment, quand il sort) et un **export vidéo** dans le navigateur.

---

## 1. La question produit : c'est quoi le « format » d'un post visuel ?

Le format est une propriété du **script**, décidée à la génération, avant que le modèle n'écrive le storyboard, parce qu'elle change ce que le storyboard décrit :

| Format | Le storyboard décrit | La maquette produit | Le fichier |
| :--- | :--- | :--- | :--- |
| **Image unique** | 1 entrée : ce qu'on voit et le texte affiché | 1 slide statique | 1 PNG |
| **Carrousel de N** | N entrées, une par slide, dans l'ordre de lecture | N slides statiques, thème commun | N PNG (zip) |
| **Animation** | N entrées = les **moments** successifs du texte (« d'abord le titre, puis le chiffre, puis l'appel à l'action ») | **1 slide** dont les calques sont rattachés à ces moments, avec un début, une entrée et une sortie | 1 MP4 de 5 à 15 s, sans son |

Une animation n'est donc pas un quatrième type de contenu (vidéo / visuel / texte restent) : c'est un post visuel dont la maquette a une dimension temporelle. Le calendrier, les rôles, les séries, le quota ne changent pas.

```
Script visuel
  ├── visualFormat : single | carousel | animation      ← nouveau, choisi à la génération
  ├── slideCount (carrousel) · durationMs (animation)   ← nouveau
  ├── storyboard : 1 entrée | N slides | N moments      ← existant, contraint par le format
  └── maquette (visual_designs)
        ├── slides [1 | N]                                ← existant
        └── timeline [{ layerId, enter, startMs, … }]     ← nouveau, animation seulement
```

---

## 2. Décisions tranchées (récapitulatif)

| Sujet | Décision |
| :--- | :--- |
| Où se choisit le format | Sur les trois portes de génération d'un post visuel : créneau du calendrier (`scripts/new`), génération libre (`GenerateForm`), import. Trois boutons : **Image · Carrousel · Animation** ; un champ « nombre de slides » (2 à 10, défaut 5) pour le carrousel ; un champ « durée » (5 à 15 s, défaut 8) pour l'animation. Défaut : image unique. |
| Où c'est stocké | `scripts.visualFormat` (`single` / `carousel` / `animation`, défaut `single`), `scripts.slideCount` (nullable), `scripts.durationMs` (nullable). Trois colonnes, aucune table. Les scripts existants deviennent `single` si leur storyboard a une entrée, `carousel` sinon (migration de données). |
| Ce que reçoit le rédacteur | Un bloc `=== FORMAT ===` dans le message de génération : « Image unique : le storyboard a exactement 1 entrée » / « Carrousel de N slides : exactement N entrées, la première accroche, la dernière porte l'appel à l'action » / « Animation de D secondes : entre 3 et 6 entrées, chacune est un MOMENT du texte à l'écran, dans l'ordre d'apparition ; le texte total tient en D secondes de lecture ». Le contrat du tool `generate_visual_post` ne change pas ; le nombre d'entrées est vérifié après coup et redemandé une fois s'il est faux (même mécanisme que la liste blanche). |
| Le modèle de l'animation | **Une slide, une ligne de temps.** `visual_designs.timeline` (jsonb) : une entrée par calque animé `{ layerId, enter: effet, startMs, enterMs, exit: effet \| null, exitAtMs \| null }`. Effets d'entrée : `fade`, `slide-up`, `slide-left`, `zoom-in`, `typewriter` (texte seulement). Effets de sortie : `fade`, `slide-down`, `slide-right`, `none`. Un calque absent de la timeline est visible du début à la fin (fond, image de base, logo). `visual_designs.durationMs` fixe la longueur totale. |
| Ce que produit l'agent pour une animation | Le même tool `design_visual_post`, avec une propriété `timeline` en plus quand le format est `animation`. Consignes : chaque moment du storyboard devient un ou plusieurs calques texte rattachés à ce moment ; les moments se succèdent sans se chevaucher plus d'une demi-seconde ; le dernier moment reste à l'écran jusqu'à la fin ; jamais plus de 2 calques qui entrent en même temps. Validation serveur : ids de calques existants, temps dans `[0, durationMs]`, effets dans la liste. |
| Aperçu dans l'éditeur | Le canevas existant + une **barre de temps** sous la slide : lecture / pause, curseur, durée. L'aperçu utilise la Web Animations API sur le DOM déjà rendu (une animation par calque, construite depuis la timeline) — pas de moteur en plus. Le curseur pilote `currentTime` de toutes les animations ; à l'arrêt, le canevas montre l'état à l'instant choisi et reste **éditable à la main** comme aujourd'hui. |
| Édition manuelle de la timeline | Dans l'inspecteur du calque : effet d'entrée, début (s), durée d'entrée (s), effet de sortie, instant de sortie (s). Un bouton « Aucune animation » retire le calque de la timeline. Pas de piste par glisser-déposer en V1. |
| Édition par l'agent | Inchangée : l'instruction (« fais apparaître le prix plus tard », « plus rythmé ») reçoit le HTML **et** la timeline, et renvoie les deux. |
| Export vidéo | **Uniquement sur le bouton « Exporter la vidéo »**, jamais automatique : l'aperçu, les retouches à la main et les instructions à l'agent s'enchaînent sans encodage, et on réexporte après chaque retouche si on veut. **Dans le navigateur, image par image.** À 30 images/s, pour chaque instant : positionner toutes les animations à `t`, rendre la slide en bitmap (`html-to-image` → `ImageBitmap`), l'envoyer à un `VideoEncoder` (WebCodecs, H.264) et muxer en MP4 (`mp4-muxer`, ~10 Ko). 8 s = 240 images ; à ~100-150 ms par rendu, **20 à 40 s d'export**, avec une barre de progression. Le fichier est envoyé sur R2 (`designs/…/animation.mp4`, `slides[0].exportKey`) et téléchargé. Sans son en V1. |
| Navigateurs | WebCodecs H.264 est disponible sur Chrome et Edge ; Firefox et Safari ne sont pas garantis. L'app est desktop-only : l'export vidéo affiche « Export vidéo disponible sur Chrome ou Edge » ailleurs, l'aperçu fonctionne partout. |
| Formats de sortie | Animation : toujours vertical 1080×1920 par défaut (Reel/TikTok/story), carré ou portrait possibles. MP4 H.264, 30 i/s, ~6 Mbit/s. |
| Carrousel : nombre de slides | Le nombre choisi devient le nombre d'entrées du storyboard, donc de slides de la maquette. Dupliquer/supprimer une slide à la main reste possible ensuite (existant). |
| Rétrocompatibilité | Un script visuel sans `visualFormat` explicite se comporte comme aujourd'hui. Une maquette sans `timeline` est statique. Aucune régression sur l'export PNG. |
| Quota | Comme la maquette : création et export non comptés (rate limit), instruction à l'agent = micro-retouche. |

---

## 3. Parcours utilisateur

1. Génération d'un post visuel : sous le choix « Visuel », trois boutons — **Image**, **Carrousel** (avec « 5 slides »), **Animation** (avec « 8 s »). Le storyboard généré respecte le format.
2. Éditeur : la section Design connaît le format. Pour une animation, la création par l'agent produit une slide et sa ligne de temps ; la barre de temps apparaît sous le canevas ; « Lecture » montre le texte entrer et sortir.
3. Retouches : à la main (déplacer un calque, changer son instant d'entrée dans l'inspecteur) ou par instruction (« le titre arrive trop tard »).
4. Export : « Exporter la vidéo » lance le rendu image par image avec une progression, puis télécharge le MP4.

---

## 4. Modèle de données

```
scripts
  + visual_format   text NOT NULL DEFAULT 'single'   ('single' | 'carousel' | 'animation')
  + slide_count     integer NULL                      (carrousel)
  + duration_ms     integer NULL                      (animation)

visual_designs
  + duration_ms     integer NULL                      (copie figée à la composition, éditable)
  + timeline        jsonb NULL  [{ layerId, enter, startMs, enterMs, exit, exitAtMs }]
```

Migration de données : `UPDATE scripts SET visual_format = CASE WHEN jsonb_array_length(storyboard) <= 1 THEN 'single' ELSE 'carousel' END WHERE content_type = 'visual'`.

---

## 5. Logique serveur

### 5.1 Génération (`scriptService.ts`, `prompts.ts`, `generateScript.ts`)
- `ScriptGenerationContext.visualFormat` + `slideCount` + `durationMs` ; bloc `=== FORMAT ===` dans `buildScriptUserMessage` (§2).
- Après génération : si le nombre d'entrées du storyboard ne correspond pas (1 pour `single`, N pour `carousel`, 3-6 pour `animation`), un second appel avec le rappel du format ; si encore faux, on tronque ou on garde (jamais d'échec pour ça).
- Les trois routes de génération acceptent `visualFormat`, `slideCount`, `durationMs` (zod : 2 ≤ N ≤ 10, 5 000 ≤ D ≤ 15 000).

### 5.2 Maquette (`designPrompts.ts`, `visualDesignService.ts`, `timeline.ts`)
- `src/lib/visualDesign/timeline.ts` (pur, testé) : schéma zod de la timeline et `normalizeTimeline(timeline, layerIds, durationMs)`, qui valide (ids existants, bornes, effets, `exitAtMs > startMs + enterMs`) et normalise (tri par `startMs`) en une seule passe.
- Tool `design_visual_post` : propriété `timeline` optionnelle ; le system prompt reçoit un paragraphe « ANIMATION » quand le format l'exige (Annexe A). Prompt de révision : la timeline courante est jointe au HTML.
- `createDesignForScript` : format par défaut `story` pour une animation ; une seule slide même si le storyboard a plusieurs moments ; `durationMs` copié du script.
- `patchDesign` : accepte `timeline` et `durationMs`, revalidés.
- Export : la route `export` accepte aussi `video/mp4` (≤ 40 Mo) pour `slide-1`.

### 5.3 Endpoints
Aucune route nouvelle : les routes de génération et de maquette s'enrichissent des champs ci-dessus.

---

## 6. UI

- **Portes de génération** : sélecteur de format (composant `VisualFormatPicker`), visible seulement quand le type est « Visuel ».
- **`DesignEditor`** : si `timeline` existe — `TimelineBar` (lecture/pause, curseur, durée éditable), `useSlideAnimations(rootEl, timeline, durationMs)` qui construit les animations WAAPI et expose `seek(t)` / `play()` / `pause()`. Le curseur ne modifie jamais le HTML : à l'arrêt, les styles animés sont figés par `pause()` à l'instant courant, et le rendu d'export lit cet état.
- **`LayerInspector`** : section « Animation » (effets, instants) pour une maquette animée.
- **Export** : `exportAnimation.ts` — boucle de rendu, `VideoEncoder` + `mp4-muxer`, progression ; message clair si WebCodecs est absent.
- **Vignette** (bande de slides) : première image de l'animation.

---

## 7. Ce qui ne change pas

- Le type de contenu (`video` / `visual` / `text`) et tout ce qui en dépend.
- Le contrat du tool `generate_visual_post` : mêmes champs, le format contraint seulement le nombre d'entrées.
- La liste blanche HTML : la timeline est un objet séparé, jamais du CSS d'animation dans le HTML (`animation`, `transition` restent interdits).
- L'export PNG des formats image et carrousel.

---

## 8. Risques & garde-fous

| Risque | Garde-fou |
| :--- | :--- |
| Export vidéo lent (rendu DOM image par image). | 30 i/s et 15 s maximum (450 images), progression visible, annulation possible. Si l'usage réel réclame plus long, passer à un rendu canvas des calques (hors V1). |
| WebCodecs absent ou codec H.264 refusé. | Détection avant de commencer ; message « Chrome ou Edge » ; l'aperçu reste disponible. Repli WebM via `MediaRecorder` en décision ouverte. |
| Le modèle rattache un calque inexistant ou des temps hors bornes. | Validation serveur avec rapport renvoyé au modèle (seconde tentative), comme pour le HTML. |
| Le texte de l'animation est trop long pour la durée. | Consigne de lecture (~3 mots/s) dans le prompt de génération ; l'auteur ajuste la durée dans la barre de temps. |
| Une maquette animée existante après un changement de storyboard. | Même mécanisme `stale` que les slides statiques. |

---

## 9. Plan d'implémentation par lots

### Lot 0 — Format à la génération
- Colonnes `scripts.visualFormat` / `slideCount` / `durationMs` + migration (données comprises).
- Bloc `=== FORMAT ===`, vérification du nombre d'entrées, champs zod sur les trois routes, `VisualFormatPicker` sur les trois portes.
- Tests : construction du bloc, vérification/troncature du storyboard.

### Lot 1 — Timeline (serveur)
- `timeline.ts` + tests ; colonnes `visual_designs.durationMs` / `timeline` + migration ; tool et prompts enrichis ; `createDesignForScript` / `instructDesign` / `patchDesign` avec timeline ; format `story` par défaut pour une animation.
- Test mocké : composition d'une animation → timeline validée et stockée.

### Lot 2 — Aperçu et édition
- `useSlideAnimations`, `TimelineBar`, section Animation de l'inspecteur, vignette.

### Lot 3 — Export vidéo
- `exportAnimation.ts` (WebCodecs + `mp4-muxer`), route d'export acceptant `video/mp4`, progression et annulation.

### Lot 4 — Documentation
- `TECH.md`, `PRODUCT.md`, statut de cette spec et de `SPEC_DESIGN_HTML_SUR_IMAGE.md`.

### Validation de fin de chantier (usage réel)
Générer un post visuel « Animation 8 s » sur Instagram : le storyboard a 3 à 6 moments ; la maquette montre le titre entrer, puis le chiffre, puis l'appel à l'action ; l'export produit un MP4 1080×1920 lisible dans le navigateur et acceptable par Instagram. Générer un « Carrousel 4 slides » : exactement 4 slides, export zip de 4 PNG.

---

## 10. Décisions ouvertes

1. **Son** : aucune piste audio en V1. Une musique libre de droits ou une voix-off (déjà dans la feuille de route) viendraient ensuite.
2. **Repli WebM** (MediaRecorder) pour les navigateurs sans WebCodecs : utile si des utilisateurs sont sur Firefox ; Instagram n'accepte pas WebM, donc valeur limitée.
3. **Format par défaut au niveau d'une série** (« cette série est toujours un carrousel de 5 ») : logique, mais hors V1 — le choix se fait à chaque génération.
4. **Animation de l'image de base** (léger zoom « Ken Burns ») : effet `zoom-in` sur le calque image, disponible dès la V1 si le modèle l'utilise ; pas de traitement spécifique.

## 11. Hors périmètre

- Montage multi-scènes, transitions entre plusieurs slides animées (c'est de la vidéo, pas un post visuel).
- Sous-titres, voix, musique.
- Édition de la timeline par glisser-déposer sur une piste.
- Publication directe.

---

## Annexe A — Compléments de prompt

### A.1 Bloc `=== FORMAT ===` (génération du script)

```
Image unique : le storyboard a exactement 1 entrée — ce qu'on voit et le texte affiché.
Carrousel de ${N} slides : exactement ${N} entrées, une par slide, dans l'ordre de lecture ; la première accroche, la dernière porte l'appel à l'action.
Animation de ${D} secondes : entre 3 et 6 entrées ; chaque entrée est un MOMENT du texte à l'écran, dans l'ordre d'apparition, sur une seule image de fond. Le texte de tous les moments réunis doit se lire en ${D} secondes (environ 3 mots par seconde).
```

### A.2 Paragraphe « ANIMATION » du system prompt de maquette

```
Cette maquette est une ANIMATION de ${D} ms sur une seule slide. En plus du HTML, renvoie `timeline` : une entrée par calque qui apparaît ou disparaît, { layerId, enter: "fade" | "slide-up" | "slide-left" | "zoom-in" | "typewriter", startMs, enterMs (300 à 800), exit: "fade" | "slide-down" | "slide-right" | "none", exitAtMs ou null }.
Règles : chaque moment du storyboard devient un ou plusieurs calques texte rattachés à ce moment, dans l'ordre ; les moments se succèdent (un moment sort avant ou au plus 500 ms après l'entrée du suivant) ; le dernier moment reste jusqu'à la fin ; jamais plus de 2 calques qui entrent en même temps ; le fond et l'image de base ne sont pas dans la timeline (visibles tout du long), sauf un léger zoom-in sur l'image si cela sert le rythme.
```

### A.3 Propriété `timeline` du tool `design_visual_post`

```
timeline: array of { layerId: string, enter: string, startMs: integer, enterMs: integer, exit: string | null, exitAtMs: integer | null }
  description: "Uniquement pour une animation. Un calque absent est visible du début à la fin."
```
