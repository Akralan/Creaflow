# SPEC — DESIGN HTML PAR-DESSUS L'IMAGE (le post visuel devient un livrable)

> **Statut : cadrage, à valider avant tout code.** Prolonge `docs/SPEC_RESSOURCES_VISUELLES.md`, qui a livré la bibliothèque d'images de marque et la photo mise en scène (Nano Banana). Ce document cadre l'étape d'après : la **maquette** du post.
>
> **Objectif.** Pour un script `contentType: "visual"`, le produit fournit aujourd'hui un storyboard en texte (« ce qu'on voit et le texte affiché », slide par slide) et, au mieux, une photo mise en scène **nue** : pas de titre dessus, pas de texte, pas de logo, pas de slides de carrousel. L'utilisateur doit encore ouvrir Canva pour fabriquer ce qu'il publie. Ce chantier fait faire ce travail à l'agent : il **écrit une maquette en HTML/CSS** par-dessus l'image (ou sans image), le produit l'affiche comme une surface éditable, et l'utilisateur la corrige **à la main ou par instruction à l'agent**, puis télécharge des PNG prêts à publier, une par slide.
>
> **Deux décisions structurantes prises avec l'utilisateur (2026-09-17)** : le design se manipule **à la main ET par l'agent**, sur le même objet ; et on ne construit **pas un Canva** — l'édition manuelle est volontairement limitée (déplacer, redimensionner, retoucher un texte, changer une couleur ou une police), tout le reste passe par l'instruction.

---

## 1. La question produit : c'est quoi un « design » ?

Un **design** est le rendu visuel d'un script visuel : une **slide** par entrée du storyboard, toutes partageant un même **thème** (palette, polices, style de composition). Il appartient au script, comme la photo générée (`scripts.generatedImageId`) ; il est **dérivé** du storyboard, qui reste la source des mots. Ce n'est ni de la matière, ni une ressource de la bibliothèque : c'est un **livrable**, qui n'est jamais indexé ni réutilisé automatiquement d'un post à l'autre.

Ce qui traverse les posts, c'est l'**identité de marque** (couleurs, polices, logo) — un objet nouveau, petit, porté par le profil créateur, et qui n'existe pas aujourd'hui.

```
Script visuel
  ├── storyboard (texte, source des mots)         ← existant
  ├── photo mise en scène (generatedImages)        ← existant, optionnelle
  └── DESIGN (visual_designs)                       ← nouveau
        ├── thème { palette, polices, ambiance }
        ├── base : photo générée | photo de la bibliothèque | aucune
        └── slides [ { planNumber, html } ]         ← 1 slide = 1 document HTML = 1 PNG

Profil créateur
  └── identité de marque { couleurs, polices, logo }   ← nouveau, optionnel
```

---

## 2. Décisions tranchées (récapitulatif)

| Sujet | Décision |
| :--- | :--- |
| Ce que produit l'agent | Du **HTML avec styles inline uniquement**, une slide = un document. Pas de DSL maison : le modèle est bien meilleur en HTML/CSS qu'en format inventé, et la contrainte « inline + liste blanche » (§5.1) suffit pour la sûreté et l'éditabilité. |
| Structure imposée | Une slide est un **canevas de taille fixe** (ex. 1080×1350) dont chaque enfant direct est un **calque** : `position: absolute`, attribut `data-layer` unique, type `text` / `image` / `shape`. À l'intérieur d'un calque, flexbox libre. C'est ce qui rend le déplacement à la main possible sans parser le CSS du modèle. |
| Où se fait le rendu | **Dans le navigateur.** Le HTML est affiché dans l'éditeur (canevas mis à l'échelle), et l'export PNG est produit par le même navigateur (`html-to-image` ou équivalent, DOM → SVG `foreignObject` → canvas → PNG). Raison : ce que l'utilisateur voit en éditant et ce qu'il télécharge sont rendus par le **même moteur**. Le rendu serveur par `ImageResponse` de `next/og` (satori) a été écarté : il ne rendrait pas comme le navigateur (sous-ensemble CSS) et rendrait l'édition manuelle incohérente. Chrome headless côté serveur écarté aussi : lourd, inutile puisque le client rend déjà. L'app est desktop-only (`TECH.md` §2), ce qui limite les écarts entre navigateurs. |
| Base de la slide | Trois cas, au choix de l'utilisateur : **photo mise en scène** (pipeline existant), **photo de la bibliothèque** telle quelle, **aucune** (carte typographique, extrait de code, citation). Le modèle ne choisit jamais une URL : il écrit `{{BASE_IMAGE}}` et `{{LOGO}}`, le client substitue par des données servies par une route **same-origin** (pas de CORS avec R2/Drive). Toute autre source d'image est rejetée. |
| Source des mots | Le storyboard. Le modèle en extrait le texte affiché (titre, accroche, points) ; il ne réécrit pas le fond. Si le storyboard change ensuite, le design passe en **`stale`** avec un badge ; « Rafraîchir » relance l'agent, thème verrouillé, en prévenant que les retouches manuelles seront perdues. |
| Édition manuelle (le minimum utile) | Sélectionner un calque ; le déplacer et le redimensionner ; éditer un texte en place ; inspecteur : police (parmi la liste embarquée), taille, graisse, couleur, alignement, fond, opacité, ordre ; supprimer un calque ; **undo/redo** local. Rien d'autre en V1. |
| Édition par l'agent | Champ d'instruction libre (« titre plus gros », « fond plus sombre », « mets le prix en bas à droite »), sur la slide courante ou sur toutes. L'agent reçoit le HTML courant (retouches manuelles comprises), le thème et l'instruction, et renvoie le HTML révisé. |
| Persistance | Le HTML est **la** représentation stockée, quelle que soit l'origine de la modification (agent ou main). Chaque écriture repasse par la liste blanche côté serveur. Une seule version courante par script ; pas d'historique en V1 (l'undo est local à la session d'édition). |
| Polices | Liste fermée, auto-hébergée dans `public/fonts` (licence OFL) : Inter, Space Grotesk, Playfair Display, DM Serif Display, Caveat (manuscrite, artisans), JetBrains Mono (code, devs). Le modèle choisit par nom. Pas de police externe. |
| Formats | Par plateforme, avec surcharge manuelle : Instagram 1080×1350 (défaut) ou 1080×1080 ; TikTok (mode photo) 1080×1920 ; LinkedIn 1080×1350 ; X 1600×900 ; autres 1080×1080. Marges de sécurité de 5 % rappelées au modèle. |
| Identité de marque | `creatorProfiles.brandKit` (jsonb, optionnel) : `{ primaryColor, secondaryColor, accentColor, fontHeading, fontBody, logoAssetId }`. Éditable dans Paramètres. Si absent, l'agent compose une palette à partir de la description IA de l'image de base (`brandAssets.aiDescription`, déjà stockée) et du ton de marque ; bouton « Enregistrer comme identité de marque » sur le design pour la figer. Pas d'analyse de pixels côté serveur. |
| Export | Le client rend chaque slide en PNG à taille native, les envoie au serveur (stockage R2, `visual_designs.slides[].exportKey`), puis les télécharge une à une ou en **zip construit dans le navigateur** (`fflate`). Le stockage sert à l'affichage ailleurs (calendrier, performance) et à l'auto-publication future. |
| Extraits de code (verticale dev) | Calque `text` en `white-space: pre` + JetBrains Mono. Pas de coloration syntaxique en V1 (décision ouverte §10). |
| Verticales | Aucune table, aucun partitionnement (règle permanente de `ARCHITECTURE_VERTICALES.md`). Point d'extension : une **phrase d'orientation** par verticale dans le prompt (dev : cartes de code, avant/après, chiffres ; artisan : photo produit, prix, appel à l'action), à brancher sur le registre existant si c'est déclaratif, sinon en constante. |
| Quota | Création du design et export : non comptés, rate limit 10/min (comme la génération d'image). **Instruction à l'agent = une micro-retouche** (pool existant). Édition manuelle : gratuite. Tarification définitive en décision ouverte. |
| Provider | `callStructured` via `LLM_PROVIDER`, mono-tool. Le modèle texte suffit : il ne voit pas l'image, il lit sa description. |

---

## 3. Parcours utilisateur

1. Dans l'éditeur d'un script visuel, la carte « Visuel » devient une section **Design**. Si aucun design : trois boutons — *Depuis une photo mise en scène* (ouvre le flux existant), *Depuis une photo de la bibliothèque*, *Sans image*. Le format est présélectionné par la plateforme.
2. L'agent compose : une slide par entrée du storyboard, thème commun. Quelques secondes. Les slides apparaissent dans une bande de vignettes, la première au centre.
3. L'utilisateur regarde, puis soit tape une instruction (« mets le titre en haut, plus gros, et le prix en bas à droite »), soit clique sur un calque et le déplace ou le retouche. Les deux gestes se mélangent librement.
4. « Exporter » : le navigateur produit les PNG, les envoie, propose le zip. Le script garde le design ; le calendrier montre la première slide en vignette.
5. S'il modifie le storyboard plus tard : badge « design à rafraîchir ».

---

## 4. Modèle de données

Une table (le design est un objet du cœur, pas d'une verticale) et une colonne :

```
visual_designs
  id                      uuid PK
  user_id                 uuid FK users, cascade
  script_id               uuid FK scripts, cascade, UNIQUE   ← une version courante par script
  base_kind               text  'generated' | 'asset' | 'none'
  base_generated_image_id uuid FK generated_images, set null
  base_asset_id           uuid FK brand_assets, set null
  width, height           integer
  theme                   jsonb { palette: string[], fontHeading, fontBody, mood: string }
  slides                  jsonb [ { planNumber, html, exportKey: string|null } ]
  status                  text  'draft' | 'stale' | 'exported'
  last_instruction        text
  contains_ai_imagery     boolean   ← true si base_kind = 'generated' (AI Act, §8)
  created_at, updated_at  timestamp

creator_profiles.brand_kit   jsonb NULL
```

Pas de FK depuis `scripts` : la jointure part du design (`script_id` unique), ce qui évite une seconde référence circulaire du type `generatedImageId`. `GET /api/scripts/:id` renvoie le design joint (principe « une route par vue »).

---

## 5. Logique serveur

### 5.1 Liste blanche et normalisation (`src/lib/design/htmlSanitizer.ts`, pur, testé)

Appliquée à **toute** écriture de HTML (sortie du modèle comme retouche manuelle). Parse en arbre (petit parseur HTML), puis :

- **Balises** : `div`, `span`, `p`, `h1`–`h4`, `strong`, `em`, `br`, `img`. Tout le reste est retiré (dont `script`, `style`, `iframe`, `svg`, `a`, attributs `on*`).
- **Attributs** : `style`, `data-layer`, `data-type`, `src` (uniquement `{{BASE_IMAGE}}` ou `{{LOGO}}`), `alt`.
- **Propriétés CSS** : mise en page (`display`, `flex-*`, `align-*`, `justify-*`, `gap`, `position`, `top/left/right/bottom`, `width/height`, `padding`, `margin`, `overflow`, `z-index`) ; typographie (`font-family` restreinte à la liste, `font-size`, `font-weight`, `line-height`, `letter-spacing`, `text-align`, `text-transform`, `white-space`, `color`) ; décoration (`background`, `background-color`, `background-image` limité à `linear-gradient(...)` et aux deux placeholders, `background-size/position`, `border`, `border-radius`, `box-shadow`, `opacity`, `transform`). Toute valeur contenant `url(`, `expression(`, `@import` ou un `;` mal formé est rejetée.
- **Invariants de structure** : racine unique de la taille du canevas ; chaque enfant direct est un calque `position: absolute` avec `data-layer` unique et `data-type ∈ {text, image, shape}` ; au plus 12 calques par slide ; HTML ≤ 24 Ko par slide.
- En cas de violation sur une sortie du modèle : nouvel appel avec le rapport d'erreurs (même mécanisme de seconde tentative que `callStructured`). Sur une écriture manuelle : 422 explicite.

### 5.2 Composition (`src/lib/llm/designPrompts.ts`, `src/lib/services/visualDesignService.ts`)

- `createDesignForScript(userId, scriptId, { baseKind, baseAssetId?, format? })` : charge script (titre, `hookVisual`, storyboard, plateforme), profil (ton, `brandKit`), description IA de l'image de base, dimensions ; appelle le tool `design_visual_post` (Annexe A) ; sanitise ; insère.
- `instructDesign(userId, scriptId, { instruction, planNumber? })` : même tool en mode révision, avec le HTML courant ; consomme une micro-retouche (`scriptMicroEditEvents`).
- `patchDesign(userId, scriptId, { slides, theme? })` : écriture manuelle, sanitisée.
- `markDesignStale(scriptId)` : appelé par `patchScriptContent` quand `title`, `hookVisual` ou `storyboard` changent et qu'un design existe.
- `storeDesignExports(userId, scriptId, files[])` : PNG → R2 `designs/{userId}/{designId}/{planNumber}.png`, statut `exported`.

### 5.3 Endpoints

| Route | Rôle |
| :--- | :--- |
| `POST /api/scripts/:id/design` | Création par l'agent. 201 avec le design. |
| `POST /api/scripts/:id/design/instruct` | Révision par l'agent (une slide ou toutes). Micro-retouche. |
| `PATCH /api/scripts/:id/design` | Retouche manuelle (HTML des slides, thème). |
| `POST /api/scripts/:id/design/export` | Réception des PNG rendus par le client (multipart, ≤ 12 fichiers, ≤ 4 Mo chacun). |
| `DELETE /api/scripts/:id/design` | Supprime le design et ses exports. |
| `GET /api/scripts/:id/design/base` | Octets de l'image de base (et `/logo`), same-origin, cache privé. |
| `PATCH /api/profile/brand-kit` | Identité de marque. |

---

## 6. UI (`src/components/DesignEditor/`)

- **`DesignCanvas`** : rend le HTML sanitisé d'une slide dans un conteneur à l'échelle (largeur ~560 px, `transform: scale`), substitue les placeholders. Gère sélection, poignées de déplacement/redimensionnement, double-clic pour l'édition de texte en place (`contenteditable` sur le calque texte). Aucune grille, aucun guide d'alignement en V1 sauf l'aimantation au centre.
- **`LayerInspector`** : les champs listés en §2 pour le calque sélectionné ; les écritures modifient le `style` du calque dans l'arbre, puis `PATCH` (debounce 800 ms).
- **`SlideStrip`** : vignettes des slides, ajout/suppression d'une slide (ajout = duplication de la slide courante, à l'agent ou à la main d'y mettre le contenu).
- **`InstructionBar`** : champ d'instruction + portée (cette slide / toutes) + format + « Rafraîchir » (si `stale`) + « Exporter ».
- **Undo/redo** : pile locale des états HTML, raccourcis clavier.
- **Export** : `html-to-image` sur un clone hors écran à taille native, polices auto-hébergées donc embarquables, images en données same-origin. Zip via `fflate`.
- **Paramètres** : section « Identité de marque » (trois couleurs, deux polices, logo choisi dans la bibliothèque).
- **Calendrier / Performance** : la vignette de la première slide exportée remplace la photo nue quand elle existe.

---

## 7. Ce qui ne change pas

- Le pipeline de photo mise en scène (`generatedImageService.ts`, `geminiImage.ts`) et sa ligne rouge (jamais de transformation du produit, `SPEC_RESSOURCES_VISUELLES.md` §6.1) : la base reste intouchée, le design se superpose.
- La bibliothèque d'images, son captioning, sa recherche sémantique.
- Le contrat du tool `generate_visual_post` : le storyboard garde sa forme, aucun champ « texte à afficher » séparé n'est ajouté (la note d'implémentation de `scriptSchema.ts` sur `hookText` reste valable).
- L'éditeur de blocs et le brief verrouillé.

---

## 8. Risques & garde-fous

| Risque | Garde-fou |
| :--- | :--- |
| HTML rendu dans le DOM de l'app → injection. | Liste blanche serveur à chaque écriture (§5.1), jamais de `innerHTML` d'une chaîne non sanitisée, pas d'attributs d'événement, pas d'URL. Données mono-utilisateur, mais on ne s'y fie pas. |
| L'export ne ressemble pas à l'aperçu (polices, images). | Polices self-hosted, images same-origin, export sur un clone à taille native. Test manuel de fin de chantier sur Chrome et Firefox. |
| Le modèle produit une composition illisible (contraste, texte hors cadre). | Prompt : marges 5 %, hiérarchie typographique, contraste ; plafond de calques. L'utilisateur corrige à la main ou par instruction ; c'est le produit. |
| Retouches manuelles perdues par un « Rafraîchir ». | Confirmation explicite ; l'instruction à l'agent, elle, part toujours du HTML courant et préserve donc les retouches. |
| **AI Act art. 50** : le PNG composé contient une image générée dont le marquage SynthID n'est pas garanti après recomposition dans le navigateur. | L'image générée d'origine reste stockée intouchée ; `contains_ai_imagery` conservé sur le design ; position fournisseur/déployeur toujours à trancher (décision ouverte 3 de `SPEC_RESSOURCES_VISUELLES.md` §8). Pas de mécanisme supplémentaire en V1, mais le flag rend possible un marquage a posteriori. |
| Dérive vers un éditeur graphique complet. | Périmètre manuel fermé par ce document (§2). Toute demande hors liste passe par l'instruction à l'agent. |

---

## 9. Plan d'implémentation par lots

### Lot 0 — Fondations pures (aucune base, aucun LLM)
- `htmlSanitizer.ts` (parseur, liste blanche, invariants de calques), liste des polices et des formats, substitution des placeholders.
- Tests Vitest : balises/attributs/propriétés refusés, `url(` rejeté, calques sans `data-layer`, plafond de taille, HTML valide inchangé.
- Vérification concrète, hors tests : `html-to-image` rend bien une slide avec police embarquée et image en données (page de démonstration jetable).

### Lot 1 — Composition & API
- Migration : `visual_designs`, `creator_profiles.brand_kit`.
- Tool `design_visual_post` + prompts (Annexe A), `visualDesignService.ts`, endpoints §5.3, `markDesignStale` dans `patchScriptContent`, design joint dans `GET /api/scripts/:id`.
- Test mocké : création → HTML sanitisé stocké ; instruction → micro-retouche consommée.

### Lot 2 — Éditeur
- `DesignCanvas`, `LayerInspector`, `SlideStrip`, `InstructionBar`, undo/redo, choix de la base, format. Remplacement de la carte « Visuel ».

### Lot 3 — Export, identité de marque, rafraîchissement
- Export PNG + upload + zip ; badge `stale` + « Rafraîchir » ; section Identité de marque dans Paramètres + « Enregistrer comme identité de marque » ; vignette dans Calendrier/Performance.

### Lot 4 — Documentation
- `TECH.md` (§3, §4, §5), `PRODUCT.md` (§3 Module B, §4 ligne Génération de contenu, §6), `SPEC_RESSOURCES_VISUELLES.md` §1 renvoie ici.

### Validation de fin de chantier (usage réel)
- **Artisan** : script visuel Instagram, carrousel de 4 slides, base = photo de bougie mise en scène. Le design sort avec un titre lisible sur la photo, un prix, un appel à l'action sur la dernière slide ; « mets le prix plus gros » fonctionne ; déplacer le titre à la main puis exporter donne 4 PNG 1080×1350 identiques à l'aperçu.
- **Dev** : script visuel LinkedIn, sans image, une slide avec un extrait de code de 8 lignes. Le code est en monospace, lisible, non tronqué ; l'export est net.

---

## 10. Décisions ouvertes

1. **Tarification** : l'instruction à l'agent comme micro-retouche est un choix de départ ; à revoir si les designs consomment le pool trop vite.
2. **Coloration syntaxique** des extraits de code (`shiki` côté serveur, spans colorés) : utile pour la verticale dev, hors V1.
3. **Carrousel LinkedIn** : LinkedIn attend un PDF, pas des PNG. Assemblage PDF côté client (`jspdf` ou `pdf-lib`) en extension de l'export, après V1.
4. **Gabarits réutilisables** (« refais comme mon post de la semaine dernière ») : l'identité de marque couvre la cohérence globale ; un vrai gabarit par série n'est pas cadré.
5. **Bibliothèque `html-to-image`** vs `modern-screenshot` : à trancher au Lot 0 sur le test de rendu.

## 11. Hors périmètre

- Animation, vidéo, stories animées.
- Retouche de l'image de base elle-même (recadrage, filtres) : c'est le pipeline de mise en scène, pas le design.
- Éditeur de code HTML exposé à l'utilisateur.
- Multi-sélection, groupes, guides d'alignement, formes libres, bibliothèque d'icônes.
- Publication directe (auto-publication, `PRODUCT.md` §6 point 8).

---

## Annexe A — Prompts

### A.1 Tool `design_visual_post`

```
name: design_visual_post
description: Compose la maquette d'un post visuel : un thème commun et une slide HTML par entrée du storyboard.
properties:
  theme: { palette: string[] (3 à 5 couleurs hex, la première dominante), fontHeading: string, fontBody: string, mood: string }
  slides: array of { planNumber: integer, html: string }
    description: "Une entrée par slide du storyboard, dans l'ordre. html = un unique élément racine de la taille exacte du canevas, dont chaque enfant direct est un calque position:absolute avec data-layer (identifiant court unique) et data-type (text | image | shape). Styles inline uniquement."
  rationale: string — "2 phrases : le parti pris de composition et pourquoi il sert l'idée du post."
required: tous
```

### A.2 System prompt

```
Tu es directeur artistique pour les réseaux sociaux. Tu composes des maquettes en HTML avec styles inline, destinées à être rendues telles quelles en image.
Contraintes absolues :
- Canevas : ${width}×${height} px. Racine unique : <div style="position:relative;width:${width}px;height:${height}px;overflow:hidden">.
- Chaque enfant direct de la racine est un CALQUE : position:absolute, top/left/width/height en px, attributs data-layer="l1" (unique) et data-type="text" | "image" | "shape". Au plus ${maxLayers} calques par slide. Flexbox autorisé À L'INTÉRIEUR d'un calque.
- Balises autorisées : div, span, p, h1-h4, strong, em, br, img. Rien d'autre. Pas de <style>, pas de classes, pas d'événements.
- Images : uniquement src="{{BASE_IMAGE}}" ${hasLogo ? 'ou src="{{LOGO}}"' : ''}. Aucune autre URL, aucun url() en CSS. Fonds unis et linear-gradient autorisés.
- Polices : uniquement ${fontList}. Pas d'import.
- Marge de sécurité : rien d'important à moins de 5 % des bords.
- Lisibilité : contraste fort entre texte et fond (voile sombre ou clair sur la photo si nécessaire), une hiérarchie nette (un titre, un sous-texte, éventuellement un détail), jamais plus de 3 tailles de police par slide.
- Les mots viennent du storyboard fourni : tu choisis QUOI afficher et COMMENT, tu n'inventes pas de contenu et tu ne reformules pas le fond.
- Cohérence : même thème, mêmes polices, même logique de placement sur toutes les slides d'un carrousel ; la dernière slide porte l'appel à l'action si le storyboard en a un.
${brandKit ? "- Identité de marque à respecter : " + brandKit : "- Pas d'identité de marque définie : compose une palette à partir de la description de l'image et du ton de la marque."}
${verticalHint}
```

### A.3 Message utilisateur — création

```
=== POST ===
Plateforme : ${platform} · Format : ${width}×${height}
Titre : ${title}
Accroche visuelle : ${hookVisual}
Storyboard :
1. ${storyboard[0].description}
2. …

=== MARQUE ===
Nom : ${brandName} · Ton : ${tone}
${brandKit | "Pas d'identité de marque définie."}

=== IMAGE DE BASE ===
${baseKind === "none" ? "Aucune : composition typographique." : "Description : " + aiDescription + " · Orientation : " + orientation}
```

### A.4 Message utilisateur — révision par instruction

```
=== INSTRUCTION DE L'AUTEUR ===
${instruction}
Portée : ${planNumber ? "slide " + planNumber + " uniquement" : "toutes les slides"}

=== THÈME (à conserver sauf si l'instruction le change) ===
${theme}

=== HTML ACTUEL ===
--- slide 1 ---
${html}
…
Renvoie les slides concernées révisées, les autres inchangées. Conserve les data-layer existants quand le calque subsiste (l'auteur a pu le retoucher à la main).
```
