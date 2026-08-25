# CADRAGE — MATIÈRE PREMIÈRE & ÉDITEUR DE SCRIPT

> **Statut : implémenté** (chantiers 0 à 5, §7). Fusionné dans `PRODUCT.md` (§1.1, §3 Modules A/B, §4) et `TECH.md` (§1, §3, §4, §5.1/§5.8-§5.12, §6). Conservé comme archive de cadrage — ne plus mettre à jour, ce sont `PRODUCT.md`/`TECH.md` qui reflètent le code actuel.
>
> Décisions tranchées pour la livraison, détail dans `TECH.md` : `Product`→"sujet" renommé côté UI uniquement, `MIN_PRODUCTS=1` (§3.3) ; `contentCategoryId` reste obligatoire à l'import, y compris pour `origin="manual"` (§8.2, tranché à l'implémentation) ; typologie `MaterialUnit` fermée + soupape `autre` (§3.4) ; pool micro-retouches chiffré par défaut à x5/x4 le quota scripts, à recaler à l'usage (§4.6, `TECH.md` §10) ; comptage LRU dérivé du CASCADE, aucune logique d'état (§3.5/§8.4) ; aiguillage matière×catégorie au générateur de calendrier, jamais de retouche d'un calendrier déjà généré (§5.3/§8.7) ; interview-chat une session par sujet (§3.7/§8.8). Le test fondateur de suivi (§2, "les 5 posts dorment-ils deux semaines ?") et la validation transverse à modèle égal (§7) restent à observer en usage réel — ils ne se tranchent pas au code.

---

## 1. Pourquoi c'est le chantier prioritaire

### 1.1 Le constat d'usage

Premier script généré pour un profil personal branding (posts texte LinkedIn/X) : générique, imprécis, avec des informations inventées. Décrochage immédiat — dès le premier script. Trois reproches formulés, qui sont un seul problème vu sous trois angles :

| Reproche | Cause réelle |
| :--- | :--- |
| **Générique** | Le générateur est affamé : un `Product` = un nom + une description + une proposition de valeur. Pour un post, il faut dix fois cette matière. |
| **Inventé** | Un modèle nourri d'une phrase et sommé de produire un post n'a que deux options — rester vague ou broder. Il fait les deux. La règle « ne jamais inventer d'info non fournie » existe dans le prompt de l'assistant (`TECH.md` §5.4)… mais pas dans la génération de script, qui n'a de toute façon aucune entrée de sources. |
| **Impossible à corriger** | Génération one-shot, muette : la seule commande est `POST /api/scripts/:id/regenerate` — destructrice, et qui consomme du quota comme une génération neuve. Personne ne publie un texte généré tel quel ; la finalisation migre hors du produit. |

La ressemblance entre posts a par ailleurs trois sources, dont une seule est traitée aujourd'hui :

1. **La structure** — traitée, et bien : anti-répétition par angles (`TECH.md` §5.2).
2. **La matière** — non traitée : une seule description → le même contenu recyclé dans des squelettes différents.
3. **La voix** — non traitée pour un créateur qui démarre : `style_profile` vide (aucun historique de posts à analyser) → le style maison du LLM partout.

### 1.2 Le test fondateur

Expérience faite à la main, hors produit : le journal de développement complet d'un projet perso (~37 runs documentés — bugs, réglages, décisions techniques) collé dans un LLM généraliste, avec une conversation minimale. Résultat : une **série d'environ 5 posts qui se suivent, avec une conclusion**, de qualité quasi finale — quelques retouches à la main, une seule demande de reformulation d'une phrase.

Ce qu'il faut en retenir :

- **La matière est la variable dominante, pas le pilotage.** Avec une matière riche, il n'y a presque rien à dire au modèle ; avec une phrase, aucun pilotage ne sauve le résultat.
- La sortie naturelle a été une **série ordonnée** — la structure `ContentSeries` existe déjà en base ; il n'existe simplement aucun pipeline pour la remplir ainsi.
- Le geste global — **un seul effort documenté → plusieurs contenus** — est l'esprit exact du Module C (« killer feature », repoussée depuis le premier brief), en version texte : le journal de dev est l'équivalent du rush de tournage.
- Ces posts sont **morts dans la conversation** : pas de dates, pas de statuts, aucune mémoire de ce qui est parti ni de ce qui a marché. C'est précisément la partie que CreaFlow doit posséder.

### 1.3 Décision de positionnement

Les LLM généralistes ont gagné l'écriture — ne pas les concurrencer en réinventant un rédacteur maison. CreaFlow gagne **tout ce qu'il y a autour** : la matière en entrée, la cadence, la mémoire et l'arbitrage en sortie. *La salle de montage autour du rédacteur, pas un rédacteur concurrent.*

Corollaire sur la rigidité — ce n'est pas un curseur, c'est une question d'étage :

- **Amont (quoi, quand, quelle catégorie, quel angle, quelle série)** : rigide, déterministe. C'est le moat, c'est là que les humains dérivent vers la répétition. Rien ne change.
- **Aval (les mots)** : libre. Retoucher, réécrire, discuter ne casse pas l'anti-répétition tant que le brief (catégorie + angle imposé + série) reste verrouillé et cadre chaque action IA.

**Verrouiller le brief, libérer les mots.**

---

## 2. Chantier 0 — Import de scripts externes (le geste immédiat)

Aujourd'hui, seule la génération LLM peut créer une ligne `Script`. Ouvrir la création avec contenu fourni :

- `POST /api/scripts/import` (ou extension de `POST /api/scripts` avec champs de contenu) — crée un `Script` à partir d'un texte écrit ailleurs, `origin: "imported"`, plaçable directement sur une date (`scheduledDate`, même mécanique que le flux secondaire existant).
- CreaFlow devient la **couche de suivi** même quand l'écriture s'est passée ailleurs — cohérent avec §1.3.

**Le test qui départage les deux diagnostics.** Importer les 5 posts du test fondateur (au pire en SQL direct), les poser sur 5 dates, statut `planned`, et observer deux semaines :

- s'ils partent → le problème était **la matière**, et ce cadrage le règle ;
- s'ils dorment → le problème est **le déclencheur** (vue « aujourd'hui », notifications) — chantier hors du présent cadrage, qui passe alors devant en priorité.

**Patch immédiat associé** (une ligne de prompt, sans attendre le corpus) : étendre la règle « ne jamais inventer d'info non fournie » à `SCRIPT_SYSTEM_PROMPT`, avec marquage explicite `[à compléter]` en lieu et place de toute précision inventée.

---

## 3. Chantier 1 — La matière première (corpus par sujet)

> **Amendement post-implémentation.** Les §3.4 et §3.5 ci-dessous décrivaient la version *structurée* du
> corpus : découpage asynchrone en `MaterialUnit` typées + sélection *least-recently-used*. Cette version
> a été implémentée, puis abandonnée après un test comparatif direct en usage réel : envoyer le texte
> brut complet d'un journal de bord à Claude produisait un excellent post, tandis que l'app, alimentée
> par 6 unités choisies par rotation sans notion de pertinence, produisait un post pauvre et décousu — le
> découpage perdait la richesse narrative du texte source, et la sélection assemblait des fragments sans
> lien thématique entre eux.
>
> **Mécanisme retenu à la place** : le texte brut complet des documents du sujet est injecté tel quel à
> chaque génération (comme le test manuel qui a fonctionné) — pas de pré-sélection, pas de découpage. Le
> LLM rapporte lui-même, dans sa réponse de génération, les passages qu'il a utilisés comme base
> factuelle (`usedExcerpts`) ; ils sont retrouvés dans le texte source par recherche approximative
> (`src/lib/services/citationMatching.ts`) et enregistrés (`source_material_citations`,
> `src/lib/services/citationService.ts`). Les passages déjà cités sont **annotés** — jamais supprimés —
> dans les injections futures, pour inciter à la variété sans jamais exclure de matière. Traçabilité
> exposée dans l'UI : surlignage des passages cités sur la fiche du document (panneau Matière) et liste
> des citations sur la fiche du script généré. §3.1 à §3.3 restent valides tels quels ; §3.4/§3.5 sont
> conservés en dessous comme trace de la décision initiale et de pourquoi elle a été renversée.

### 3.1 Principe

Un espace de matière brute par produit/sujet, dont la génération se nourrit. Promotion du « corpus factuel » du §9 de `SPEC_RESSOURCES_VISUELLES.md` — rangé là-bas en annexe « à cadrer séparément » — au rang de **réacteur du produit** pour le contenu texte.

Deux décisions structurantes héritées de ce même §9 :

- **Ne pas fusionner avec `BrandAsset`** sous prétexte que l'UI dira « Ressources » dans les deux cas — mise en garde déjà écrite, maintenue.
- **Ancrage sur `Product`** : `productId` nullable sur la matière (une partie du corpus peut être de niveau marque), même pattern que `Script.productId`.

### 3.2 Anti-scope — à surveiller activement

Le corpus **sert la génération** ; ce n'est pas un produit de rangement. V1 : coller du texte + fichiers `md`/`txt`, point. Pas de parseur PDF, pas de visionneuse, pas de classement automatique de documents — ne pas construire par accident, à l'intérieur de CreaFlow, un « gestionnaire de documents IA » (niche distincte, qui a sa propre logique produit).

### 3.3 Généralisation `Product` → sujet

L'entité est encore taillée boutique : proposition de valeur, 3 à 5 obligatoires (`MIN_PRODUCTS`/`MAX_PRODUCTS`, `src/lib/validation.ts`). Pour un profil personal branding, un projet est un **sujet**, pas un produit — il doit pouvoir s'appeler ainsi, exister seul, sans proposition de valeur. Tranché (§8.1) : renommage **côté UI uniquement** (le schéma, les FK et les routes gardent `Product` — zéro migration pour un gain cosmétique), `MIN_PRODUCTS` passe à **1**, `valueProposition` devient optionnelle.

### 3.4 Ingestion — le dépôt est gratuit, la structure est le travail de la machine

Principe directeur : **aucun coût de structuration pour l'humain au moment du dépôt**. La structure arrive après, en asynchrone — jumeau exact du pipeline `BrandAsset` (`SPEC_RESSOURCES_VISUELLES.md` §7.2 : insertion en `pending`, traitement en arrière-plan, `ready` quelques secondes plus tard, jamais bloquant ; un élément non traité est simplement invisible pour la sélection).

1. Dépôt : collage de texte, fichier `md`/`txt`, ou interview (§3.7) → `SourceMaterial` en `pending`.
2. Passe LLM asynchrone : découpage en **unités typées** — typologie fermée : anecdote, bug, chiffre, décision, learning, + `autre` en soupape — chacune avec un label court (`MaterialUnit`).
3. Pour une série : la même passe peut proposer un **découpage en épisodes** (ce que le LLM du test fondateur a fait implicitement).

### 3.5 Sélection & marquage d'usage — dérivé, jamais coché

- Jointure `ScriptMaterialUsage` écrite **à la génération** (quelles unités ont nourri quel script).
- L'usage ne compte que pour les scripts qui **survivent** — un brouillon jeté ne grille pas une anecdote (mécanique : §6).
- **Pas d'épuisement définitif** : rotation *least-recently-used*, calquée sur l'anti-répétition d'angles (`selectLeastRecentlyUsedAngle`) — une bonne histoire peut servir un post « échec » aujourd'hui et un récapitulatif dans deux mois sous un autre angle.
- L'anti-répétition actuelle surveille les **sorties** (15 derniers scripts) ; ce marquage surveille les **entrées**. Les deux se complètent.
- Deux overrides manuels, pas plus : **épingler** (« à placer absolument ») et **exclure** (« privé, jamais dans un post » — un journal de dev en contient toujours).
- Si la sélection doit devenir sémantique un jour : `pgvector` est déjà en place (`drizzle/0007`). Pas en V1.

### 3.6 Injection dans la génération

Mécanisme définitif (voir amendement en tête de §3) : le texte brut complet des documents du sujet,
annoté des passages déjà cités, est injecté dans `buildScriptUserMessage` — petit code, levier énorme ;
c'est ce qui tue le générique et l'inventé. Garde-fou technique pur (pas un mécanisme de pertinence) :
au-delà d'un volume de texte extrême pour un sujet, tronquer avec un `logger.warn` plutôt que planter
l'appel provider.

### 3.7 Deuxième porte — l'interview-chat

La cible d'origine ne tient pas de journal : ses journées d'atelier sont dans sa tête. Pour elle, le corpus ne se colle pas, il **s'extrait** : un chat qui interviewe (« raconte-moi la commande de cette semaine »), une question à la fois — pattern maison depuis l'onboarding (`TECH.md` §5.3) — et dont les réponses deviennent des `SourceMaterial` — une session d'interview par sujet (§8.8). Coller pour ceux qui écrivent déjà, interviewer pour les autres : deux portes, une seule feature.

### 3.8 Génération de série depuis la matière

Depuis le corpus d'un sujet : générer **N scripts ordonnés, rattachés à une même `ContentSeries`**, posés directement sur des créneaux (`POST /api/calendar` existe déjà pour le placement). C'est le Module C en version texte — « un effort → plusieurs contenus », validé à la main par le test fondateur.

---

## 4. Chantier 2 — L'éditeur de script unifié

### 4.1 Le script devient une surface de travail

Le script cesse d'être un artefact généré en one-shot pour devenir un **document co-écrit** : générer, coller, écrire à la main et retoucher par IA sont le même geste, au même endroit. L'import (§2) en est absorbé : coller, c'est écrire.

**Une surface unique ≠ un même état de départ.** La page blanche est littéralement le syndrome que le produit promet de tuer (`PRODUCT.md` §1.1) :

- **Depuis un créneau du calendrier** : la page s'ouvre avec le premier jet déjà généré (ou un unique bouton pré-chargé du brief). L'artisan veut un brouillon, pas un curseur qui clignote.
- **Depuis la création libre** : page vide, machinerie de génération complète à un clic (§5 — elle n'est jamais retirée).

L'unification est dans la machinerie, pas dans le premier écran.

### 4.2 Le brief en en-tête

Le brief du créneau — plateforme, catégorie, **angle imposé**, série — devient l'**en-tête visible** du document au lieu d'un paramètre caché d'un appel one-shot. Chaque action IA de l'éditeur (générer, reformuler la sélection, développer) embarque ce brief + le corpus du sujet + le style. Catégorie et angle ne sont **pas modifiables à la volée depuis l'éditeur** — c'est ce qui rend la liberté d'aval compatible avec l'anti-répétition (§1.3).

### 4.3 Des blocs, pas un texte libre

- **Vidéo** : la structure hook (visuel/texte/audio) + storyboard + légende **est le livrable** de l'artisan — conservée en blocs.
- **Visuel** : accroche + slides + légende.
- **Texte** : corps + hashtags.

Bonus immédiat : la **régénération par bloc** (« refais juste le hook ») remplace le régénérer-tout destructeur.

### 4.4 V1 minimale — validée par l'usage réel

L'usage observé lors du test fondateur tient en deux gestes : corriger à la main, et « reprends cette phrase ». La V1 s'y limite :

- texte des blocs **directement éditable** ;
- **sélection → champ d'instruction libre** → remplacement direct ;
- **undo** ;
- régénération par bloc.

Explicitement reportés jusqu'à preuve du besoin : palette de gestes prédéfinis (reformuler/développer/raccourcir), suivi de modifications accepter/rejeter, menus contextuels, proposition multi-voix au premier jet (§4.7). La magie est dans le contexte injecté, pas dans le chrome de l'éditeur — **ne pas construire Google Docs**.

### 4.5 Naissance paresseuse & API

- La ligne `Script` est créée **au premier contenu** (généré, collé ou tapé), pas à l'ouverture d'une page vide — le calendrier garde son sens « script ou pas ».
- `PATCH /api/scripts/:id` s'étend du statut au **contenu** (champs de blocs).
- Ajout `Script.updatedAt` (seul `createdAt` existe).
- Ajout `DELETE /api/scripts/:id` (n'existe pas aujourd'hui) — le pendant de la naissance paresseuse : un brouillon jeté disparaît et entraîne ses citations avec lui (CASCADE sur `SourceMaterialCitation`, §3 amendement) ; `CalendarEntry.scriptId` étant `ON DELETE SET NULL`, le créneau survit et redevient générable.

### 4.6 Quota — l'unité actuelle n'a plus de sens

Aujourd'hui : une régénération = un `ScriptGenerationEvent` plein tarif. Quand l'acte IA devient « reformule cette phrase », ce comptage tue l'itération — or elle est tout le but. Découpage :

- **Générations complètes** (premier jet, génération de série) → quota scripts existant, inchangé dans son principe.
- **Micro-retouches** (sélection→instruction, régénération d'un bloc) → compteur distinct, pool généreux. Unités et plafonds en décision ouverte (§8.5).

### 4.7 Sous-produit stratégique — la donnée de voix

Dès que les retouches se font **dans** le produit, chaque écart entre le jet IA et la version finale de l'utilisateur est une donnée de style — exactement ce que `style_profile` ne peut pas obtenir pour un créateur sans historique de posts. Tranché (§8.6) : la V1 se contente de **stocker le gisement** (premier jet vs version finale, par script) sans l'exploiter ; la passe d'apprentissage qui en dérive `style_profile` est **paresseuse** — recalcul proposé tous les N scripts finalisés, ou déclenchement manuel façon `POST /api/profile/style-analysis` — cohérent avec la philosophie « aucun cron dans ce repo ». La proposition de **2-3 voix différentes sur le même brief** au premier jet (pour qui ne sait pas encore comment il veut écrire — le choix est aussi une donnée) est actée dans son principe, mais hors V1 éditeur (§4.4).

---

## 5. L'échelle de secours page blanche

La machinerie de génération complète reste disponible partout, y compris sur page vide — mais sur **corpus** vide, elle reproduirait exactement le générique/inventé du §1.1. Elle a donc une échelle de secours, du cas le plus fréquent au plus sec :

1. **Tête vide ≠ corpus vide.** La plupart des jours « sans idée », il reste de la matière non utilisée : le texte brut complet du sujet est envoyé, l'IA choisit dedans quoi utiliser (§3, amendement) — les passages déjà cités sont annotés, pas retirés, l'utilisateur n'a rien à trier. C'est la posture Directeur Marketing dans ce qu'elle a de plus pur — il ne sait pas quoi poster, le produit si.
2. **Corpus sec sur le sujet → l'interview-chat devient l'outil de page blanche.** Deux ou trois questions ; les réponses deviennent la matière (`SourceMaterial`), la matière devient le jet. **L'extraction remplace l'invention.** (Même feature que §3.7, second usage.)
3. **Aiguillage par faim de matière.** Toutes les catégories n'ont pas la même faim : l'expertise/pédagogie tourne sans journal, le storytelling/coulisses non. Un jour sec, le système oriente le créneau vers les catégories peu gourmandes et réserve les gourmandes aux jours documentés — croisement disponibilité de matière × choix de catégorie. Tranché (§8.7) : la règle vit dans le **générateur de calendrier** ; au jour J, le re-typage d'un créneau reste un geste manuel, déjà couvert par `PATCH /api/calendar/:id` (`contentCategoryId`) — aucun automatisme ne retouche un calendrier généré.
4. **Filet ultime, inchangé** : jamais inventer une précision — `[à compléter]` (§2).

Objectif : la page blanche cesse d'être le mode dégradé du produit pour devenir son meilleur numéro.

---

## 6. Modèle de données (esquisse)

> Version effectivement livrée après l'amendement de §3 — remplace `MaterialUnit`/`ScriptMaterialUsage`
> décrits dans une version antérieure de ce document.

```
SourceMaterial (dépôt brut — un collage, un fichier, une session d'interview — immédiatement utilisable)
- id, userId
- productId (nullable, FK ON DELETE SET NULL)
- kind (paste / file / interview)
- title (nullable), rawText
- createdAt

SourceMaterialCitation (passage rapporté par le LLM comme utilisé, écrite à la génération)
- id, userId
- scriptId (FK ON DELETE CASCADE)
- sourceMaterialId (nullable, FK ON DELETE CASCADE — null si le passage rapporté n'a pas été localisé
  dans un document avec assez de confiance ; conservé quand même comme signal de debug)
- excerpt (texte rapporté par le LLM), matchStart / matchLength (nullable, position dans rawText)
- createdAt
— remplacée intégralement à chaque régénération du script (delete-then-insert, même logique que
  l'ancienne ScriptMaterialUsage) ; disparaît avec le script (CASCADE).

Script (ajouts)
- origin (generated / imported / manual — défaut "generated")
- updatedAt
— les champs de blocs existants (title, hookText, storyboard, caption, hashtags…)
  deviennent éditables via PATCH.
```

---

## 7. Ordre d'attaque

| Étape | Contenu | Pourquoi cet ordre |
| :--- | :--- | :--- |
| **0 — immédiat** | Patch prompt « jamais inventer / `[à compléter]` » + import des 5 posts existants (SQL direct acceptable) + lancement du test de suivi (§2) | Une soirée. Arme le test qui peut re-prioriser tout le reste. |
| **1** | Champ de matière brute par sujet injecté dans `buildScriptUserMessage` + endpoint d'import propre + généralisation `Product`→sujet | Petit code, levier maximal — tue le générique/inventé avant tout chantier UI. |
| **2** | Éditeur V1 (§4.4–4.6) | Un bel éditeur sur un générateur affamé ferait juste corriger du générique plus confortablement — d'où l'ordre. |
| **3** | Structuration asynchrone (unités, usage, LRU, épingler/exclure) + génération de série depuis la matière | La version industrielle du corpus. |
| **4** | Interview-chat (deuxième porte + barreau 2 de l'échelle de secours) | Ouvre le corpus à la cible qui n'écrit pas. |
| **5** | Aiguillage matière × catégorie (barreau 3) | Petite règle, dépend de la télémétrie des étapes précédentes. |

**Validation transverse, dès l'étape 1** : rejouer le test fondateur **à modèle égal** — la session de référence tournait sur Claude, le produit démarre sur Gemini par défaut (`LLM_PROVIDER`). Pari : la matière domine le choix du modèle. À mesurer plutôt qu'à croire.

**Porte de décision après l'étape 0** : si les 5 posts importés dorment deux semaines malgré une matière validée, le chantier déclencheur (vue « aujourd'hui », notifications — `reminderSent` dort en base depuis le POC) passe devant les étapes 3+.

---

## 8. Décisions ouvertes

1. ~~**`Product` → sujet**~~ **Tranché.** Renommage **côté UI uniquement** — le schéma, les FK et les routes `/api/products` gardent `Product` (zéro migration pour un gain cosmétique) ; `MIN_PRODUCTS` passe à **1** ; `valueProposition` optionnelle. (§3.3)
2. **Catégorie à l'import** : `Script.contentCategoryId` est `NOT NULL` — imposer le choix d'une catégorie à l'import, ou l'assouplir pour les scripts importés ? (§2)
3. ~~**Typologie des unités**~~ **Tranché : types fermés** (anecdote / bug / chiffre / décision / learning) + `autre` en soupape — condition de l'aiguillage du §5.3 ; la nuance libre reste portée par `MaterialUnit.label`. (§3.4)
4. ~~**Comptage LRU**~~ **Tranché : « survit » = la ligne `Script` existe encore**, quel que soit son statut — un draft vivant compte, seul un brouillon **supprimé** libère ses unités (d'où l'ajout de `DELETE /api/scripts/:id`, §4.5). Règle dérivée du CASCADE, aucune logique d'état à maintenir. (§3.5)
5. **Pool micro-retouches** — structure tranchée au §4.6 (compteur distinct du quota scripts, pool généreux) ; reste ouvert le **chiffrage** : plafond par plan (`starter`/`pro`), reset mensuel, à caler sur les coûts réels par provider — et le sort de la génération d'images IA, déjà notée non quotée (`TECH.md` §10). (§4.6)
6. ~~**Voix → `style_profile`**~~ **Tranché.** V1 : stockage du gisement (premier jet vs version finale) sans exploitation ; passe d'apprentissage **paresseuse** (recalcul proposé tous les N scripts finalisés ou déclenchement manuel, façon `POST /api/profile/style-analysis` — aucun cron, philosophie du repo) ; multi-voix au premier jet actée dans son principe mais hors V1 éditeur. (§4.7)
7. ~~**Localisation de l'aiguillage matière×catégorie**~~ **Tranché : au générateur de calendrier.** Le re-typage du jour J reste un geste manuel, déjà couvert par `PATCH /api/calendar/:id` (`contentCategoryId`) — aucun automatisme ne retouche un calendrier généré. (§5.3)
8. ~~**Interview-chat**~~ **Tranché : une session par sujet** (`productId` nullable pour la matière de niveau marque), pattern `jsonb messages` réutilisé d'`OnboardingSession`/`AssistantSession` — le contexte injecté est le corpus existant du sujet, pas l'état global. (§3.7)

---

## 9. Hors périmètre de ce cadrage

- **Le chantier déclencheur** — vue « aujourd'hui », notifications/rappels de publication : diagnostiqué dans la même session, volontairement séquencé après la porte de décision du §7.
- **Le corpus visuel** (`BrandAsset`) — déjà cadré (`SPEC_RESSOURCES_VISUELLES.md`), non fusionné (§3.1).
- **Le Module C vidéo** (découpage multi-formats d'un tournage) — toujours différé ; §3.8 en est l'esprit en version texte, pas le remplacement.
- **La sélection sémantique** (embeddings sur `MaterialUnit`) — plus tard, si le volume l'exige.
- **Le suivi de modifications** (proposer/accepter sur le texte) — reporté jusqu'à preuve du besoin (§4.4).

---

## 10. Impact documentaire attendu

- `PRODUCT.md` §1.1 — ajouter au constat : l'invention d'informations (pas seulement la répétition) quand l'IA manque de matière.
- `PRODUCT.md` §3 Module A — l'interview-chat comme mode d'alimentation du corpus.
- `PRODUCT.md` §3 Module B — corpus de matière, éditeur, import, échelle de secours page blanche ; le script décrit comme surface de travail.
- `PRODUCT.md` §4 — nouvelles lignes de roadmap (Corpus / Éditeur).
- `TECH.md` §3 — `SourceMaterial`, `SourceMaterialCitation`, ajouts `Script` (`MaterialUnit`/`ScriptMaterialUsage` abandonnés, voir amendement §3).
- `TECH.md` §4 — endpoints import, `PATCH` contenu, micro-retouches, matière, interview, citations (`GET /api/materials/:id/citations`).
- `TECH.md` §5 — injection du texte brut annoté dans `buildScriptUserMessage`, extraction de `usedExcerpts` en sortie de génération, recherche approximative (`citationMatching.ts`), règle « jamais inventer » côté script.
- `TECH.md` §6 — compteur micro-retouches à côté de `ScriptGenerationEvent`.
