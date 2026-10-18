# SPEC — L'ANIMATION EN HTML LIBRE (le modèle réalise lui-même l'animation)

> **Statut : écrite et en partie implémentée le 2026-10-18 sur `feature/app-design-tellovo` : lot 0 (banc d'essai) fait, lot 2 en grande partie (l'animation s'écrit, se joue et se range dans un post de l'application) ; export MP4, « demander un changement » / « voir le code » et retrait de l'ancien moteur restent à faire. Écarts et limites en §7.** Décisions prises à deux (Alix et Claude), avec les raisons : CreaFlow sert à parler de CreaFlow. Cette spec **remplace la ligne de temps par calques** de `docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md` §2 pour le format *animation* seulement ; l'image unique et le carrousel gardent leur système.
>
> **Objectif.** Aujourd'hui une animation est un dessin à calques et une ligne de temps à cinq effets (fondu, glissement, zoom, machine à écrire) : le modèle ne peut ni faire tourner un logo, ni faire grandir une barre, ni compter, ni dessiner un trait, et il remplit l'écran de phrases. **Le modèle écrit désormais lui-même une page HTML animée de X secondes**, avec tout ce que le navigateur sait faire (CSS, SVG, un peu de JS), comme le fait Claude Design. On garde un contrôle qui n'écarte que ce qui est dangereux ou cassé.

---

## 1. Décisions (journal)

| # | Décision | Pourquoi | Écarté |
| :--- | :--- | :--- | :--- |
| A1 | **Le modèle écrit une page HTML animée complète** (HTML, CSS, `@keyframes`, SVG, JS si besoin) de la taille et de la durée choisies. | La base « calques + cinq effets » plafonne la qualité : le motion design demande des mouvements continus, des tracés, des chiffres qui montent, de la matière visuelle. La liberté fait la qualité. | Ajouter des effets un par un à la ligne de temps. |
| A2 | **Elle s'exécute dans un `iframe` enfermé** : `sandbox="allow-scripts"` seulement (pas d'accès à l'app, aux cookies ni à la session, pas de navigation, pas de fenêtre), et une règle de sécurité du contenu (CSP) `default-src 'none'` qui bloque tout réseau. Images et polices sont **intégrées dans la page** (`data:`). | Du code écrit par un modèle ne doit jamais toucher l'application. L'enfermement rend le JS acceptable. | Une liste blanche de balises comme pour les calques ; du JS dans la page de l'app. |
| A3 | **Le JS est autorisé**, sous un contrat de temps (A4). | C'est ce qui rend « tout » possible : compteur qui monte, tracé, calcul. | HTML + CSS seulement. |
| A4 | **Contrat de temps : l'animation est une fonction du temps.** Tout mouvement passe par des animations CSS (`@keyframes`) ou Web Animations créées au chargement (`animation-fill-mode: both`), que le lecteur sait placer à n'importe quel instant ; ce qui dépend du JS passe par une fonction `window.seek(ms)` **pure** (même instant, même image). Interdits : minuteurs (`setTimeout`, `setInterval`, `requestAnimationFrame`), `Math.random`, `Date`, `performance`. | L'export vidéo se fait image par image : il faut pouvoir demander « l'image à 3,4 s » et obtenir toujours la même. C'est le principe de Remotion (le mouvement vient du numéro d'image, pas de l'horloge). | Laisser le JS libre et capturer en temps réel (images perdues, non reproductible). |
| A5 | **Le contrôle a trois couches** : (1) lecture du code avant affichage (réseau, accès à l'extérieur, stockage, minuteurs, taille) ; (2) enfermement de A2, qui tient même si la lecture rate quelque chose ; (3) **essai de rendu** : on joue l'animation dans un navigateur, on regarde le début, le milieu et la fin, et on refuse une page vide, qui plante, qui déborde ou dont la fin n'est pas tenue. Un refus renvoie un rapport au modèle (une nouvelle tentative). | Le but est « pas de trucs bizarres », pas de limiter la création. | Une liste blanche ; ne rien contrôler. |
| A6 | **Le prompt est réécrit de zéro** autour des règles de motion design du §3 (peu de texte, un élément dominant, premier cadre = accroche, la preuve se montre, la fin est tenue), plus une étape de réflexion avant le code : le concept, puis les temps. | Le prompt actuel demande des « moments de texte » : il produit des diapositives qui défilent. | Retoucher le prompt existant. |
| A7 | **Le texte à l'écran est dans la langue du post** ; aucun chiffre, nom ni affirmation qui ne soit pas dans le post. | Cohérence avec les règles de langue (`docs/SPEC_LANGUE_DES_POSTS.md`) et de fidélité. | « All visible text is in English » (le prompt actuel). |
| A8 | **Le visuel vient du contenu.** Un post sur une latence donne une barre qui grandit jusqu'à 600 ms ; un post sur 33 points de suivi donne des points qui apparaissent sur une silhouette ; un post sans chiffre donne un schéma, pas un chiffre inventé. | « Le plus de choses possible animées, très peu de texte » : c'est la demande d'Alix, et ce qui distingue un motion design d'un diaporama. | Un gros chiffre systématique. |
| A9 | **L'édition d'une animation se fait par instruction** (« demander un changement » : le modèle réécrit la page) et par « voir le code ». L'éditeur de calques ne sert plus pour ce format. | On ne retouche pas du HTML libre calque par calque. | Un éditeur graphique de page libre. |
| A10 | **L'export MP4 se fait dans l'iframe**, image par image comme aujourd'hui : notre code de capture est injecté **avant** celui du modèle, puis pilote `seek(t)`. | Réutilise l'encodeur actuel (WebCodecs) ; reste reproductible. | Capture d'écran en temps réel ; rendu côté serveur (Chromium sur le VPS). |
| A11 | **Une animation reste une micro-retouche pour le quota** (`design_instruction`), jamais une semaine. | Décision E16 de `docs/SPEC_APP_DESIGN_TELLOVO.md`. | Un quota dédié. |
| A12 | **On commence par un banc d'essai** hors de l'application : prompt, iframe, contrôle, trois animations MyKiné à regarder. L'éditeur, l'export et la branche sur l'écran de la semaine viennent après validation. | Si l'animation n'est pas belle, le reste ne sert à rien. | Tout brancher d'abord. |

---

## 2. Le contrat de la page

Le modèle rend un **fragment** (le contenu d'une scène `#stage` de la taille du canevas, avec ses `<style>`, ses éléments, son `<script>` éventuel) ; **nous fabriquons le document autour** (`player.ts`) : la CSP en tête, les polices, la scène, puis notre lecteur.

- **Taille** : celle du format (`1080×1920` pour une story, déjà utilisée), en px absolus.
- **Durée** : `durationMs` (5 à 15 s). La fin est **tenue** au moins 1,5 s ; la lecture boucle.
- **Mouvement** : CSS `@keyframes` ou `element.animate(...)` **au chargement**, `animation-fill-mode: both`, `animation-play-state` jamais piloté à la main. Un mouvement continu (tourner, pulser, flotter) est permis : `infinite` ou `n` itérations.
- **JS** : uniquement pour construire des éléments au chargement et pour `window.seek(ms)` quand une valeur dépend du temps (compteur, tracé calculé). `seek` est pur.
- **Polices** : celles de la liste fermée (`src/lib/visualDesign/fonts.ts`), intégrées à la page.
- **Images** : `{{IMG:p1}}`… remplacés par des `data:` ; sinon formes, SVG, dégradés.
- **Rien d'externe** : aucune URL `http(s)`, aucun `@import`, aucune balise `link`, `meta`, `base`, `iframe`, `object`, `embed`, `form`, ni `audio`/`video`.

Le lecteur expose `window.__player` : `duration`, `seek(ms)` (place **toutes** les animations CSS et Web Animations de la page à `ms`, puis appelle `window.seek(ms)` du modèle), `play()` / `pause()` (lecture en boucle pilotée par `seek`).

---

## 3. Ce qui fait un bon motion design (recherche du 2026-10-18)

Sources : le web ne donne pas de manuel chiffré du motion design social ; les articles se recoupent, mais ce sont surtout des guides de praticiens et des blogs marketing. Les durées de [web.dev](https://web.dev/articles/choosing-the-right-easing) et [NN/g](https://www.nngroup.com/articles/animation-duration/) concernent des interfaces, pas la vidéo. Un seul travail de recherche, sur les mini-animations : [« What Makes a Data-GIF Understandable? »](https://ar5iv.labs.arxiv.org/html/2008.07227). Les chiffres ci-dessous sont donc des **conventions de départ, à régler à l'œil**, et c'est le banc d'essai qui les règle.

**Structure**
1. **Une animation = une idée** : une accroche, une preuve, une clôture. Chaque mouvement a un travail : révéler, comparer, souligner, conclure ([Hera](https://hera.video/blog/motion-graphics-for-youtube-shorts-and-reels)).
2. **Le premier cadre est déjà l'accroche**, visible dès 0 ms, compréhensible sans le son, avec du mouvement ; pas de logo ni de fondu d'ouverture ([Scale Creative](https://tiny.write.as/thescalecreative/making-videos-for-social-media-heres-how-to-hook-viewers-in-under-3-seconds)).
3. **Un changement visible toutes les 1,5 à 3 s.**
4. **La fin est tenue** 1,5 à 2 s avec le message clé : les spectateurs rejouent (74 % dans l'étude des data-GIF, qui durent moins de 15 s pour 79 % d'entre elles) et lisent l'image finale.

**Texte**
5. **Très peu de mots** : environ 10 mots en tout, hors signature. Un temps = un chiffre, un objet ou 4 mots au plus, jamais une phrase. Hera conseille de réduire le texte d'environ 30 % et de le lire « à bout de bras ».
6. **Le texte étiquette, l'image démontre** : on anime des formes, des tracés, des schémas, des chiffres.
7. **Gros** : un chiffre clé ≥ 200 px, une étiquette ≥ 44 px sur 1080 de large ; contraste ≥ 4,5:1 ; sans empattement de préférence ([SVGator](https://www.svgator.com/blog/kinetic-typography-a-guide-to-text-in-motion/)).
8. **Temps de lecture** : un texte reste lisible au moins `max(1,2 s, 0,3 s par mot)`.

**Mouvement**
9. **Un seul élément dominant qui bouge à la fois.** Si tout bouge, rien ne ressort. Le plus important entre en premier ; le reste suit en décalé de 60 à 120 ms.
10. **Entrées en ease-out** (`cubic-bezier(.16,1,.3,1)`), 300 à 700 ms ; sorties plus courtes, en ease-in ; jamais de mouvement linéaire sauf une rotation continue. Léger dépassement (overshoot) pour une apparition qui doit « claquer » ; rebond seulement sur 800 à 1200 ms.
11. **Une seule famille de mouvement** par animation ; l'ambiance continue (tourner, pulser, flotter) est discrète et sert l'idée.
12. **On n'anime que `transform` et `opacity`** (et `stroke-dashoffset` pour tracer) : ce qui reste fluide et se laisse figer à un instant.

**Composition (story 1080×1920)**
13. Contenu important dans la zone centrale : marge haute ≥ 14 %, basse ≥ 35 % (cache par l'interface des réseaux), côtés ≥ 6 % (chiffres de `docs/RECHERCHE_DESIGN_MAQUETTE.md`, non vérifiés à la source).
14. 3 à 5 couleurs, chacune avec un rôle ; jamais de palette « typique IA ».

---

## 4. Le contrôle (A5)

**Avant affichage — lecture du code** (`verify.ts`, pur, testé) : taille ≤ 60 Ko ; balises interdites (voir §2) ; aucune URL externe (sauf l'espace de noms `xmlns`), `@import`, `javascript:`, `url()` hors `data:` et `#ancre` ; JS : pas de `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `Worker`, `eval`, `new Function`, `import()`, `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB`, `parent`, `top`, `opener`, `location`, `history`, `postMessage`, minuteurs, `Math.random`, `Date`, `performance`.

**À l'exécution — essai de rendu** : l'animation est jouée dans l'iframe ; on relève le nombre d'animations, la fin de la plus longue, les erreurs JS, et trois images (début, milieu, fin). Refus si : erreur de script ; aucune animation ni `seek` ; première et dernière images identiques (rien ne bouge) ; première image vide ; une animation finie qui dépasse la durée ; fin non tenue (la dernière image doit rester stable sur les 1,5 dernières secondes).

**Si refus** : une seconde tentative avec le rapport ; sinon l'erreur est dite à la personne (« L'animation n'a pas pu être composée ») et journalisée avec sa cause.

---

## 5. Découpage

| Lot | Contenu | Se vérifie par |
| :--- | :--- | :--- |
| 0 | **Banc d'essai** : `verify.ts`, `player.ts`, prompt, appel au modèle avec une tentative de rattrapage, script `scripts/animation-bench.ts` ; trois animations MyKiné. | Regarder les images et les pages jouées. |
| 1 | Régler le prompt sur les essais (matière MyKiné et un post sans chiffre). | Revue d'Alix. |
| 2 | Brancher : format *animation* de « Add a visual » → page libre ; stockage (`visual_designs`, colonne `html`) ; lecteur dans l'éditeur (lecture, curseur, durée) ; essai de rendu côté navigateur. | Essai réel dans l'app. |
| 3 | Export MP4 dans l'iframe (capture image par image). | Fichier lu par Instagram / LinkedIn. |
| 4 | « Demander un changement » et « voir le code ». | Essai réel. |
| 5 | Retrait de la ligne de temps et de l'éditeur de calques pour l'animation (données existantes lues en repli). | Tests, lint. |

---

## 6. Risques et limites connues

- **Fidélité de l'export** : la capture image par image (`html-to-image`) ne rend pas tout (certains flous, filtres SVG, modes de fusion, `<canvas>`). Le prompt liste ce qui passe ; l'essai de rendu rattrape le reste ; à mesurer au lot 3.
- **Coût** : une animation écrit beaucoup de code (plusieurs milliers de tokens) et un essai de rendu ; une micro-retouche pour le quota.
- **Polices** : intégrées en `data:` dans chaque page (≈ 60 à 150 Ko par police) ; on n'intègre que celles utilisées.
- **Photos de la bibliothèque** : intégrées en `data:` réduit ; non testé au lot 0 (banc d'essai typographique et schématique).
- **Hors périmètre** : le son, la 3D, les vidéos en entrée.

---

## 7. État au 2026-10-18 : ce qui existe, ce que le banc d'essai a montré

**Fait**
- `src/lib/animationHtml/` : `verify.ts` (lecture du code, couche 1), `player.ts` (document enfermé : CSP, polices en `data:`, lecteur `window.__player` avec `seek`, `play`, `pause`, `probe` et des messages `cf-play`, `cf-pause`, `cf-seek`, `cf-probe`), `numbers.ts` (les chiffres à l'écran viennent du post), `fonts.ts` (les six polices de la liste fermée lues depuis `src/assets/fonts/design`, ≈ 250 Ko, `scripts/fetch-design-fonts.mjs`).
- `src/lib/llm/animationHtml.ts` : le prompt (réflexion avant le code : l'idée, comment la *montrer*, les temps), l'écriture, la **revue du modèle sur ses propres images** (`callStructured` accepte `images`, OpenAI seulement), `reviseAnimationHtml` (correction ciblée), repli sur la page la moins mauvaise (`leftover`) plutôt que rien.
- **L'essai de rendu** est dans le lecteur lui-même (`probe`) : textes qui se chevauchent, coupés par le bord, trop petits (< 26 px), gros texte hors de la zone sûre, erreurs de script, figures étrangères au post (`numbers.ts`) ; chaque constat porte ses coordonnées pour que le modèle corrige au pixel.
- Application : table `post_animations` (migration `0050`), `postAnimationService.ts`, `/api/posts/animation` (GET, POST, PUT, DELETE), `AnimationPlayer` (iframe enfermé, lecture en boucle, pause), choix « Animation » dans « Add a visual » de la bulle d'outils. Après l'écriture, **le navigateur joue la page et lance l'essai de rendu ; ce qui est refusé repart au modèle, deux fois au plus**.
- Banc d'essai : `scripts/animation-bench.ts` (trois posts MyKiné), `scripts/mykine-animations.ts` (range les animations de quatre posts du compte de test dans la base de dev), `scripts/animation-bench-lib.ts`. Résultats : `docs/tests/animation-html/`.

**Ce que les essais ont montré**
- Le modèle trouve de bonnes idées visuelles (une silhouette dont un point sur trois s'éteint ; une courbe qui franchit trois fois un seuil) mais **réalise mal la mise en page** : textes qui se chevauchent, noir sur fond sombre, première image presque vide, tracés SVG peints en noir, chiffres inventés (« 12 squats », « 13/20 »), gros texte dans la zone cachée par les réseaux. D'où : prompt plus strict, essai de rendu mesuré, retour au modèle avec les coordonnées.
- **Un seul tour de correction ne suffit pas toujours** : le modèle corrige un chevauchement et en crée un autre. Le banc fait trois reprises et garde la moins mauvaise page ; l'application en fait deux et dit ce qui reste (`animationNote`).
- La revue du modèle sur ses images corrige peu de chose ; l'essai de rendu mesuré est ce qui fait le travail.
- Un appel au modèle peut rester suspendu plusieurs minutes (aléatoire) : délai de 3 minutes sur le client OpenAI (`providers/openai.ts`).
- Chiffres autorisés en plus de ceux du post : 0 à 3 (étiquettes de comptage).

**Pas encore fait**
- Export MP4 depuis l'iframe (lot 3) ; « demander un changement » et « voir le code » (lot 4) ; retrait de la ligne de temps et de l'éditeur de calques pour l'animation (lot 5).
- Photos de la bibliothèque dans l'animation (`{{IMG:p1}}`) : le lecteur sait les intégrer, aucun appel ne les fournit encore.
- L'animation se range sur le premier script du post (LinkedIn) et la version X la lit, comme un visuel statique.
