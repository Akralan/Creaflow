# SPEC — COMPOSITION VISUELLE : MONTAGE, DÉTOURAGE ET ÉLÉMENTS D'INTERFACE (fin de la génération d'image)

> **Statut : implémenté (Lots 0 à 4) le 2026-10-16 sur `feature/composition-visuelle`, migrations `0033` (ajouts + données, écrite à la main) et `0034` (retraits) générées, pas encore appliquées en base de dev, pas testé en réel.** Écarts assumés : la migration est en deux fichiers (drizzle-kit refuse de générer en une fois ajouts et retraits sans question interactive) ; les variantes sont appliquées aussi par `PATCH` (bascule dans l'inspecteur) et l'ajout d'une photo passe par `POST …/design/images` ; le captioning ne porte pas d'indice « détourable » (décision ouverte 2). À vérifier en priorité : la composition automatique à l'ouverture de la fiche, un détourage réel en bac à sable, et l'export PNG d'une slide avec `clip-path`. Remplace la partie « génération d'image » de `docs/SPEC_RESSOURCES_VISUELLES.md` (§2, §6.2, §8 points 2-3) et prolonge `docs/SPEC_DESIGN_HTML_SUR_IMAGE.md` (la maquette) et `docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md` (le format). Demande du 2026-10-16 : « que la génération d'image change de forme : plutôt la création de script qui puisse ajouter des éléments UI dessus, ou faire des montages multi-images, détourer des produits. Plus de génération d'image. »
>
> **Objectif.** Aujourd'hui le post visuel part d'une **photo mise en scène par l'IA** (Nano Banana) ou d'une photo de la bibliothèque, **une seule**, sur laquelle l'agent pose du texte. Ce chantier **supprime la génération d'image** et fait de la maquette une **composition à partir des vraies photos** de l'utilisateur : plusieurs photos par slide (montage), produits **détourés** posés sur un fond de marque, et un vrai vocabulaire d'**éléments d'interface** (étiquette de prix, badge, bouton, cadre de téléphone ou de navigateur, puces numérotées…). L'agent compose, l'utilisateur retouche à la main ou par instruction — mécanique inchangée.
>
> **Ce qui rend ce chantier abordable :** la maquette HTML, sa liste blanche, l'éditeur et l'export existent. On change ce que la maquette a le droit de contenir (N photos au lieu d'une, une variante détourée, quelques propriétés CSS en plus), pas comment elle est produite, stockée ou rendue. Et on **retire** plus de code qu'on n'en ajoute : tout le pipeline Gemini image, et avec lui la question AI Act de l'image générée.

---

## 1. La question produit : d'où vient l'image d'un post visuel ?

Trois réponses possibles ; la demande tranche pour la troisième.

| Réponse | Ce que le produit fait | Verdict |
| :--- | :--- | :--- |
| L'IA **fabrique** une photo à partir des photos de l'utilisateur | Mise en scène Nano Banana (existant) | **Abandonné.** Résultat peu maîtrisable, coût, image « IA » à marquer (AI Act art. 50), ligne rouge « ne jamais transformer le produit » à surveiller en permanence. |
| L'IA **décrit** une image que l'utilisateur fabrique ailleurs | Storyboard seul (état d'avant 2026-08) | Insuffisant : tout le travail reste à faire dans Canva. |
| L'IA **compose** à partir des vraies photos | Montage, détourage, texte et éléments d'interface par-dessus, dans la maquette HTML | **Retenu.** Les photos restent vraies, donc le produit montré est le produit vendu ; le résultat est entièrement éditable ; c'est le métier d'un graphiste, pas d'un photographe. |

Conséquence sur le modèle : une maquette n'a plus **une base** (`baseKind` : générée / bibliothèque / aucune) mais **une liste de photos** (0 à 6), chacune utilisable **telle quelle** ou **détourée**. Le détourage est une propriété de la photo (calculé une fois, mis en cache), le choix original/détouré est une propriété du calque qui l'affiche.

```
Script visuel
  ├── storyboard (texte)                              ← inchangé
  └── maquette (visual_designs)
        ├── thème, format, slides HTML, timeline      ← inchangé
        └── photos [ { ref, assetId, variant } ]       ← nouveau (remplace base_kind / base_*_id)
              └── <img src="{{IMG:ref}}"> dans les calques image

Bibliothèque (brand_assets)
  └── + détourage en cache (cutout_key)               ← nouveau
```

Ce qui disparaît : la table `generated_images`, `scripts.generatedImageId`, `visual_designs.baseGeneratedImageId` / `baseKind` / `baseAssetId` / `containsAiImagery`, la route `POST /api/assets/generate-image`, le prompt de mise en scène, `GEMINI_IMAGE_MODEL`. **`GEMINI_API_KEY` reste nécessaire** pour le captioning vision des photos (inchangé).

---

## 2. Décisions tranchées (récapitulatif)

| Sujet | Décision |
| :--- | :--- |
| Génération d'image | **Supprimée du code, pas masquée.** Fichiers, routes, colonnes, table, variables d'environnement, section « Mise en scène » de la bibliothèque, boutons « Depuis la photo mise en scène » / « Regénérer ». Le captioning vision (`captionImage`) reste chez Gemini. |
| Photos d'une maquette | `visual_designs.images` (jsonb) : `[{ ref: "p1", assetId, variant: "original" \| "cutout" }]`, **au plus 6**. Le HTML référence une photo par `src="{{IMG:p1}}"` ; `{{LOGO}}` inchangé. Toute autre `src` est refusée par la liste blanche, comme aujourd'hui. Les octets sont servis same-origin par `GET /api/scripts/:id/design/images/:ref` (original ou détouré selon `variant`). |
| Quand la maquette est composée | **Automatiquement, en arrière-plan, juste après la génération du script** (tranché le 2026-10-16 : la fiche du script doit s'ouvrir avec le visuel déjà là, prêt à être retouché). Même mécanisme différé que le captioning (`after()`), avec les photos suggérées (ci-dessous) ou sans photo s'il n'y en a aucune. La fiche affiche « Composition en cours… » et se rafraîchit toute seule. Ne vaut que pour un script né d'une génération (créneau du calendrier, génération libre) ; un script importé ou écrit à la main garde le bouton « Composer ». Une régénération ou « autre idée » ne recompose pas : la maquette passe en `stale`, comme aujourd'hui. Coût assumé : un appel de composition par post visuel généré. |
| Qui choisit les photos | **Suggestion automatique, choix de l'utilisateur.** Photos suggérées : celle trouvée par recherche sémantique à la génération du script (`scripts.brandAssetId`, existant) et celles rattachées au produit du script s'il y en a un, dans la limite de 6. Depuis l'éditeur, « Changer les photos » rouvre le sélecteur multiple (recomposition, thème conservé) et « Ajouter une photo » en ajoute une sans recomposer. L'agent ne fouille pas la bibliothèque lui-même en V1 (décision ouverte §10). |
| Ce que l'agent reçoit | Un bloc `=== PHOTOS ===` : pour chaque photo, sa référence, sa description IA, son orientation, le produit rattaché, et si le détourage est disponible. Il décide quelle photo va où, en entier ou détourée, et peut en laisser de côté. |
| Ce que l'agent renvoie | Le tool `design_visual_post` existant, plus une propriété `images: [{ ref, variant }]` (photos effectivement utilisées et sous quelle forme). Validation serveur : refs connues, variantes dans la liste ; si `cutout` est demandé et que le détourage échoue, la photo repasse en `original` avec un avertissement (jamais d'échec de composition pour ça). |
| Détourage | **Service externe derrière un adaptateur**, même motif que `LLM_PROVIDER` : `BACKGROUND_REMOVAL_PROVIDER=photoroom` + `PHOTOROOM_API_KEY`. Photoroom : `POST https://sdk.photoroom.com/v1/segment`, en-tête `x-api-key`, champ multipart `image_file`, PNG avec transparence en retour, **0,02 $ par image** ; mode bac à sable gratuit avec filigrane (clé préfixée `sandbox_`, 100/jour) pour le dev. Sans variable d'environnement : le détourage est simplement **absent** (le prompt ne le propose pas, la bascule n'apparaît pas), le reste fonctionne. IMG.LY (`@imgly/background-removal`) **écarté** : licence AGPL, incompatible avec le dépôt (Elastic-2.0). Un modèle libre auto-hébergé (BiRefNet, U²-Net) reste possible plus tard comme second adaptateur. |
| Cache du détourage | `brand_assets.cutoutKey` (PNG sur R2, `assets/{userId}/{assetId}-cutout.png`). Calculé **une fois** par photo, à la première demande (agent ou utilisateur), invalidé si le `checksum` change (même règle que le captioning). Avant envoi, l'image est réduite à 2 000 px de grand côté (`sharp`) : moins d'octets, même qualité pour un post 1080 px. La photo d'origine n'est jamais modifiée. |
| Ligne rouge produit | **Maintenue et renforcée.** Détourer n'altère ni couleur, ni matière, ni proportions : le produit montré est le produit photographié. Plus aucun code ne peut produire une image du produit qui n'existe pas (`SPEC_RESSOURCES_VISUELLES.md` §6.1). |
| AI Act art. 50 | **Sans objet** pour les visuels : plus aucune image générée ou modifiée par IA (un détourage est une segmentation, pas une génération ; le texte et les formes sont du HTML). `containsAiImagery` disparaît, ainsi que les décisions ouvertes 2 et 3 de `SPEC_RESSOURCES_VISUELLES.md` §8. Les règles « ne pas retraiter les octets » dans `r2.ts` et `generatedImageService.ts` n'ont plus de raison d'être. |
| Montages | Pas de moteur de mise en page : l'agent compose avec les calques image existants (`object-fit: cover`, `border-radius`, `clip-path`) selon des **motifs nommés dans le prompt** — produit détouré centré sur fond uni avec ombre portée ; deux photos côte à côte (avant/après) ; grille 2×2 ; photo pleine page + vignette détourée en médaillon ; collage décalé. L'utilisateur déplace et redimensionne ensuite comme aujourd'hui. |
| Éléments d'interface | Pas de nouveau type de calque : **un catalogue de composants décrit dans le prompt**, tous exprimables dans la liste blanche (`div` + styles) : étiquette de prix, badge, bouton d'appel à l'action, puce numérotée, encart / carte, bandeau haut ou bas, bulle de citation, séparateur, barre de progression, **cadre de téléphone** et **cadre de navigateur** (verticale dev : captures d'écran). Côté éditeur, un menu **« Ajouter un élément »** insère les mêmes composants à la main, comme calques `shape` ou `text` prêts à retoucher. |
| Liste blanche | Ajouts : `clip-path` (`circle()`, `ellipse()`, `inset()`, `polygon()` en px ou %), `outline`, `outline-offset`, `aspect-ratio`. Attribut `src` : `{{IMG:<ref>}}` à la place de `{{BASE_IMAGE}}`. Tout le reste inchangé (y compris l'interdiction d'`url(`, et `backdrop-filter` écarté : mal rendu par `html-to-image`). |
| Inspecteur d'un calque image | Bascule **original / détouré** (déclenche le détourage si pas en cache, avec attente visible), ajustement (`object-fit` cover / contain), coins arrondis, forme (rectangle / rond), **remplacer la photo**, et le reste de l'inspecteur actuel. |
| Bibliothèque | Chaque photo peut être détourée depuis sa carte (« Détourer », puis vignette de l'état détouré). Pratique pour préparer un catalogue avant de composer. La section « Mise en scène souhaitée » disparaît. |
| Script sans maquette | La vignette « photo mise en scène » sous la section Design disparaît. Rien d'autre ne change dans la fiche script. |
| Quota | Création et export : inchangés (non comptés, rate limit). Instruction à l'agent : micro-retouche, inchangé. Détourage : non compté, rate limit 10/min par utilisateur ; coût réel ≈ 0,02 $ par photo, une fois. |
| Provider LLM | Inchangé : `callStructured` via `LLM_PROVIDER`. Le modèle ne voit toujours pas les images, il lit leurs descriptions. |

---

## 3. Parcours utilisateur

1. L'utilisateur génère un post visuel (créneau du calendrier ou génération libre). Le script s'écrit, puis la maquette se compose en arrière-plan avec les photos suggérées : la fiche s'ouvre sur le script et affiche « Composition en cours… » quelques secondes (plus 2 à 5 s par détourage la première fois), puis le visuel.
2. Résultat typique : slide 1 = le produit détouré au centre sur un fond couleur de marque, étiquette de prix en bas à droite ; slide 2 = deux photos d'atelier côte à côte avec un bandeau titre ; dernière slide = bouton d'appel à l'action. Pour un script importé ou écrit à la main, ou si la composition automatique a échoué : « Choisir des photos » (sélection multiple, suggestions cochées) ou « Sans photo », puis « Composer ».
3. Retouches, directement sur la fiche : double-clic sur un texte pour le corriger, déplacer ou redimensionner un calque, panneau de droite (police, taille, couleur, fond), basculer une photo en détouré, l'arrondir, la remplacer, « Changer les photos », « Ajouter une photo », « Ajouter un élément » ; ou par instruction (« mets le produit plus gros et le prix en haut », « ajoute une deuxième photo en médaillon »). Tout ce qui existe déjà dans l'éditeur reste tel quel.
4. Export PNG / zip / MP4 : inchangé.

---

## 4. Modèle de données

Migration `0033` (schéma + données) :

```
generated_images                         ← table SUPPRIMÉE
scripts.generated_image_id               ← colonne SUPPRIMÉE
visual_designs.base_kind                 ← SUPPRIMÉE
visual_designs.base_generated_image_id   ← SUPPRIMÉE
visual_designs.base_asset_id             ← SUPPRIMÉE
visual_designs.contains_ai_imagery       ← SUPPRIMÉE
visual_designs.images   jsonb NOT NULL DEFAULT '[]'   [{ ref, assetId, variant }]   ← NOUVELLE
brand_assets.cutout_key text NULL                                                    ← NOUVELLE
```

Données existantes (base de dev) :
- maquette avec `base_kind = 'asset'` → `images = [{ ref: "p1", assetId: base_asset_id, variant: "original" }]` et `{{BASE_IMAGE}}` réécrit en `{{IMG:p1}}` dans `slides` (remplacement textuel sur le jsonb) ;
- maquette avec `base_kind = 'generated'`, ou `base_kind = 'asset'` dont la photo a disparu → **ligne supprimée** : son HTML citerait une image qui n'existe plus et la liste blanche refuserait toute retouche (relevé en revue). La fiche retombe sur « Choisir des photos » / « Sans photo ». Perte assumée : il s'agit d'essais de développement ;
- les fichiers `generated/...` sur R2 ne sont pas effacés par la migration (nettoyage manuel, hors code).

Aucune table nouvelle, aucune partition par verticale (`ARCHITECTURE_VERTICALES.md`, règle permanente).

---

## 5. Logique serveur

### 5.1 Retrait (Lot 0)
Suppression de `generatedImageService.ts`, `imageGenPrompts.ts`, `generateStagedImage` dans `geminiImage.ts` (le fichier garde `captionImage`), `POST /api/assets/generate-image`, `api.generateStagedImage` et le type `GeneratedImage` dans `apiClient.ts`, la jointure `generatedImage` dans `GET /api/scripts/:id`, le commentaire AI Act de `r2.ts`. Rate limit et tests associés retirés. `GEMINI_IMAGE_MODEL` retiré de `.env.example` et de la doc.

### 5.2 Photos de la maquette (Lot 1)
- `src/lib/visualDesign/designImages.ts` (pur, testé) : schéma zod de `images` (refs `^p[1-9]$`, uniques, ≤ 6, variantes), `IMAGE_PLACEHOLDER_RE = /\{\{IMG:(p\d)\}\}/`, et `collectImageRefs(html)`.
- `htmlSanitizer.ts` : `src` accepté si `{{IMG:ref}}` avec `ref` déclaré (option `imageRefs: string[]` à la place de `usesBaseImage`), ou `{{LOGO}}` si logo. Nouvelles propriétés CSS (§2).
- `designPrompts.ts` : bloc `=== PHOTOS ===` (Annexe A.1), motifs de montage et catalogue d'éléments dans le system prompt (A.2), propriété `images` du tool (A.3).
- `suggestDesignAssets(userId, script)` (dans `visualDesignService.ts`) : `scripts.brandAssetId` + photos `ready` rattachées au produit du script, ≤ 6, dédoublonnées.
- **Composition automatique** : `scriptService.ts`, après la création d'un script `visual` par génération (créneau et génération libre, pas l'import ni la naissance manuelle), programme dans `after()` un `createDesignForScript` avec les photos suggérées, format par défaut de la plateforme. Toute erreur est journalisée (`logger.warn`) et laisse le script sans maquette : la fiche retombe sur le bouton « Composer ». Jamais bloquant, jamais compté dans le quota.
- `visualDesignService.ts` : `createDesignForScript(userId, scriptId, { assetIds, format })` charge les photos (descriptions, orientation, produit, `cutoutKey`), compose, valide `images`, assure les détourages demandés (§5.3), insère. `instructDesign` joint la liste des photos au message de révision. `patchDesign` accepte `images` (ajout / remplacement / changement de variante) et revalide le HTML contre les refs. `addDesignImage(userId, scriptId, assetId)` renvoie la nouvelle ref.
- Route `GET /api/scripts/:id/design/images/:ref` (remplace `/design/base`) : octets de l'original (`fetchAssetBytes`) ou du détouré (R2) selon `variant`, cache privé 5 min, clé de cache côté client `?v=assetId:variant`.

### 5.3 Détourage (Lot 2)
- `src/lib/imaging/backgroundRemoval.ts` : interface `BackgroundRemover { removeBackground(bytes, mimeType): Promise<Buffer /* PNG */> }`, `getBackgroundRemover()` qui lit `BACKGROUND_REMOVAL_PROVIDER` et renvoie `null` si absent ; `providers/photoroom.ts` (fetch multipart, erreurs 4xx/5xx explicites, délai 30 s).
- `brandAssetService.ts` : `ensureCutout(asset)` — renvoie `cutoutKey` s'il existe et que le checksum n'a pas changé, sinon réduit l'image, appelle le provider, stocke, met à jour la ligne. `isCutoutAvailable()` (provider configuré) exposé à l'UI via `GET /api/assets` (`cutoutAvailable: boolean`) et au prompt.
- Routes : `POST /api/assets/:id/cutout` (bibliothèque et inspecteur ; 201 avec l'asset mis à jour ; 503 explicite si aucun provider ; rate limit 10/min). `fetchAssetBytes` inchangé ; le détouré a sa propre lecture R2.
- Suppression d'un asset : efface aussi `cutoutKey` sur R2 (comme la vignette).

### 5.4 Éléments d'interface (Lot 3)
- `src/lib/visualDesign/uiElements.ts` (pur, testé) : catalogue `{ id, label, html(theme) }` — un calque HTML par composant, construit avec les couleurs et polices du thème, **passé par la liste blanche** dans les tests. Même catalogue pour le prompt (description textuelle, A.2) et pour le menu « Ajouter un élément » (HTML inséré, puis `PATCH` comme toute retouche manuelle).

---

## 6. UI

- **`DesignEditor`** sans maquette : si le script vient d'être généré (moins de ~2 min, `origin = "generated"`), état « Composition en cours… » avec relecture de `GET /api/scripts/:id` toutes les 3 s jusqu'à l'arrivée de la maquette (ou 60 s, puis bascule sur les boutons). Sinon : « Choisir des photos » (modale `AssetGrid` en sélection multiple, suggestions cochées, compteur « 3/6 ») et « Sans photo ». Les boutons liés à la photo mise en scène disparaissent.
- **`DesignEditor`** avec maquette : « Changer les photos » (sélecteur multiple → recomposition, thème conservé, confirmation car les retouches manuelles sont perdues — même mécanisme que « Rafraîchir »).
- **`DesignEditor`** avec maquette : boutons **« Ajouter une photo »** (sélecteur → `addDesignImage` → calque image centré, `object-fit: cover`, 60 % du canevas) et **« Ajouter un élément »** (menu du catalogue → calque inséré, sélectionné). Bande de photos de la maquette (vignettes, variante affichée).
- **`LayerInspector`** pour un calque image : bascule original / détouré (indisponible avec info-bulle si pas de provider), ajustement, coins, forme, remplacer la photo.
- **`designDom.ts`** : `RenderUrls` devient `{ images: Record<ref, url>, logoUrl }` ; `toRenderableHtml` / `fromRenderedHtml` substituent `{{IMG:ref}}`.
- **Bibliothèque** (`AssetGrid`, `BrandAssetLibrary`) : action « Détourer » sur la carte, état (en cours / détouré / échec), aperçu du détouré sur damier. Section « Mise en scène » retirée.
- **Fiche script** : modale « Ressources visuelles » et pied « Photo mise en scène » retirés.
- **Paramètres** : rien de nouveau (l'identité de marque existe).

---

## 7. Ce qui ne change pas

- Le storyboard, le tool `generate_visual_post`, le format (image / carrousel / animation), la timeline et l'export vidéo.
- La bibliothèque : ingestion (upload, Google Picker), captioning, embeddings, recherche sémantique, `scripts.brandAssetId`.
- La structure des slides (canevas, calques `position:absolute`, `data-layer` / `data-type`), l'éditeur (sélection, déplacement, texte en place, undo/redo), l'export PNG / zip, l'identité de marque, le mécanisme `stale`.
- La liste blanche reste le seul garde-fou sur le HTML, appliquée à toute écriture.

---

## 8. Risques & garde-fous

| Risque | Garde-fou |
| :--- | :--- |
| Un détourage raté (bords, ombres) sur une photo mal cadrée. | La bascule original / détouré est à un clic ; la photo d'origine est toujours là. Le prompt réserve le détourage aux photos dont la description indique un sujet net sur fond simple. |
| Dépendance à un service externe payant pour le détourage. | Adaptateur ; absence tolérée (fonction masquée, jamais d'erreur ailleurs) ; cache par photo pour ne payer qu'une fois ; bac à sable gratuit en dev. |
| Le modèle produit un montage encombré (6 photos, 12 calques). | Plafond de 6 photos par maquette, 12 calques par slide (existant), consigne « une photo dominante par slide, les autres en appui ». |
| `clip-path` ou `outline` mal rendus à l'export. | Vérification manuelle en fin de Lot 1 (`html-to-image` sur Chrome) ; si un rendu diverge, la propriété est retirée de la liste blanche plutôt que contournée. |
| Maquettes existantes construites sur une photo générée. | Supprimées par la migration (§4) : la fiche retombe sur « Choisir des photos ». Perte limitée à des données de dev, annoncée ici. |
| Suppression large (table, colonnes, routes) qui casse un appel oublié. | `npm run lint`, `npm test`, `npm run build`, puis grep final sur `generatedImage`, `generate-image`, `BASE_IMAGE`, `baseKind` avant de fermer le Lot 0 / Lot 1. |

---

## 9. Plan d'implémentation par lots

### Lot 0 — Retrait de la génération d'image
- Code, routes, client API, UI (bibliothèque, éditeur, fiche script), `.env.example`, `GEMINI_IMAGE_MODEL`.
- Schéma : table et colonnes supprimées ; `images` et `cutout_key` ajoutées ; migration `0033` écrite **à la main** (conversion des maquettes `asset`, suppression des maquettes `generated` ou sans photo), appliquée en base de dev et vérifiée.
- Tests existants adaptés (`geminiImage.test.ts`, `visualDesignService`, sanitizer). Vérification : lint, tests, build, grep.

### Lot 1 — Plusieurs photos par maquette
- `designImages.ts`, liste blanche (`{{IMG:ref}}`, nouvelles propriétés), prompts (`=== PHOTOS ===`, motifs de montage), tool `images`, service, route `images/:ref`, `designDom.ts`.
- Composition automatique après génération (`after()`), suggestions de photos, état « Composition en cours… » avec relecture.
- UI : sélecteur multiple à la création, « Changer les photos », « Ajouter une photo », bande de photos, inspecteur image (sans la bascule détouré).
- Tests Vitest : refs inconnues refusées, plafond, substitution, composition mockée avec 3 photos → `images` stockées et HTML valide. Vérification manuelle : export PNG d'une slide à 2 photos avec `clip-path: circle()`.

### Lot 2 — Détourage
- `backgroundRemoval.ts` + adaptateur Photoroom (tests avec `fetch` mocké), `ensureCutout`, route `POST /api/assets/:id/cutout`, variante `cutout` dans le tool et la validation (repli `original` sur échec), bascule dans l'inspecteur, action dans la bibliothèque, `docs/SETUP_RESSOURCES_VISUELLES.md` (clé Photoroom, bac à sable).

### Lot 3 — Éléments d'interface
- `uiElements.ts` (catalogue, testé contre la liste blanche), paragraphe du system prompt, menu « Ajouter un élément », cadres téléphone / navigateur, phrase d'orientation par verticale mise à jour (dev : captures dans un cadre, avant/après ; artisan : produit détouré + prix).

### Lot 4 — Documentation
- `TECH.md` (§3 modèle, §4 endpoints, §5.14, §6 rate limits et quotas), `PRODUCT.md` (§3, §4 ligne Génération de contenu, §6 points 10-11), `CLAUDE.md` (variables d'environnement, liste des docs), `SPEC_RESSOURCES_VISUELLES.md` (statut : génération d'image retirée, renvoi ici), `SPEC_DESIGN_HTML_SUR_IMAGE.md` (base → photos), `.env.example`.

### Validation de fin de chantier (usage réel)
- **Artisan** : 3 photos de bougies dans la bibliothèque, rattachées au produit « Bougie Ambre » ; génération d'un script visuel Instagram, carrousel de 4 slides, depuis le calendrier. Attendu : la fiche s'ouvre, « Composition en cours… », puis la maquette apparaît sans clic ; une slide avec le produit détouré centré sur fond uni de la couleur de marque, ombre portée, étiquette de prix ; une slide à deux photos côte à côte ; dernière slide avec un bouton d'appel à l'action. « Mets le produit plus gros » fonctionne ; basculer une photo en original puis exporter donne 4 PNG identiques à l'aperçu.
- **Dev** : 2 captures d'écran, script visuel LinkedIn, image unique. Attendu : les deux captures dans des cadres de navigateur, avant / après, titre en haut ; export net.
- **Sans provider de détourage** : la bascule est absente, la composition fonctionne avec les photos entières.

---

## 10. Décisions ouvertes

1. **Sélection automatique des photos par l'agent** (fouiller la bibliothèque par recherche sémantique slide par slide) : utile quand la bibliothèque grossit ; V1 = l'utilisateur choisit, suggestions précochées.
2. **Indice « détourable » au captioning** (champ `isolatedSubject` dans le tool vision) : rendrait la consigne de détourage plus fiable que la lecture de la description ; demanderait de recaptionner les photos existantes. Hors V1.
3. **Second adaptateur libre** pour le détourage (BiRefNet / U²-Net auto-hébergé) si le coût ou la dépendance posent problème.
4. **Nettoyage R2** des anciens fichiers `generated/` : manuel, hors code.
5. **Ombre portée réaliste sous un produit détouré** (ellipse floue) : composant du catalogue ou laissé au `box-shadow` du calque ? À trancher au Lot 3 sur rendu réel.

## 11. Hors périmètre

- Toute génération ou retouche d'image par IA (inpainting, changement de fond génératif, agrandissement).
- Recadrage libre, filtres, correction de couleur de la photo elle-même.
- Vidéo au-delà de l'animation existante.
- Éditeur graphique complet (multi-sélection, groupes, guides) : la limite de `SPEC_DESIGN_HTML_SUR_IMAGE.md` §2 tient.

---

## Annexe A — Compléments de prompt

### A.1 Bloc `=== PHOTOS ===` (message de création et de révision)

```
=== PHOTOS ===
p1 : Bougie parfumée dans un pot en verre ambré, fond blanc uni, lumière douce · portrait · produit : Bougie Ambre · détourage disponible
p2 : Mains versant de la cire dans des moules, atelier en bois · paysage · détourage non adapté
p3 : Trois bougies alignées sur une étagère, lumière naturelle · paysage
Aucune photo : composition typographique.
```

### A.2 Paragraphe du system prompt (remplace la ligne « Images »)

```
- Photos : uniquement src="{{IMG:p1}}", "{{IMG:p2}}"… parmi les photos listées${hasLogo ? ', et src="{{LOGO}}"' : ""}. Aucune autre URL, aucun url() en CSS. Chaque photo utilisée est déclarée dans `images` avec sa variante : "original" (photo entière, object-fit: cover) ou "cutout" (sujet détouré sur fond transparent — seulement si « détourage disponible » ; à poser sur un fond uni ou un gradient, jamais sur une autre photo chargée).
- Montages, un motif par slide : produit détouré centré sur fond de marque avec ombre portée ; deux photos côte à côte (avant / après) ; grille 2×2 ; photo pleine page + médaillon rond détouré (clip-path: circle()) ; collage décalé avec légère rotation. Une photo dominante par slide, les autres en appui.
- Éléments d'interface (calques shape ou text, div + styles) : étiquette de prix, badge, bouton d'appel à l'action, puce numérotée, encart, bandeau haut ou bas, bulle de citation, séparateur, barre de progression, cadre de téléphone (coins très arrondis, bordure sombre épaisse, encoche), cadre de navigateur (barre haute avec trois points). Utilise-les quand ils servent le message, jamais pour décorer.
```

### A.3 Propriété `images` du tool `design_visual_post`

```
images: array of { ref: string, variant: "original" | "cutout" }
  description: "Les photos effectivement utilisées dans les slides, parmi celles listées, avec leur variante. Une photo non listée ici ne doit pas apparaître dans le HTML."
```
