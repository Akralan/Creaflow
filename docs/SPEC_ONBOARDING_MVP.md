# SPEC — ONBOARDING MVP & FIN DE LA VIDÉO

> **Statut : à valider.** Premier chantier du passage V0 → MVP. Branche `feature/onboarding-mvp`.
>
> **Objectif.** Quand quelqu'un arrive, tout ce qu'on lui demande doit être une chose *à faire*, pas une question à laquelle la machine pourrait répondre seule. Ce que la personne fait se lit dans sa matière (GitHub, Notion, Linear, notes) ; son ton s'apprend à ses retouches (`docs/SPEC_APPRENTISSAGE_STYLE.md`). L'onboarding se réduit donc à : se présenter, brancher sa matière, corriger ce qu'on en a compris, dire ce qu'on attend du service, choisir ses jours.
>
> En parallèle, **la vidéo sort du produit** : on ne fait plus de script vidéo, et pas avant longtemps. Supprimée, pas masquée.

---

## 1. Décisions tranchées

| Sujet | Décision |
| :--- | :--- |
| Script vidéo | **Supprimé** : type de contenu `video`, champs propres à la vidéo, prompts, écrans, tests. Les scripts vidéo existants en base sont supprimés (données de dev). |
| Animation du post visuel (MP4) | **Gardée.** C'est un format de post visuel (`visualFormat = animation`), pas un script vidéo. |
| Comptes TikTok / Instagram (Module A) | **Hors périmètre.** Ils servent à lire les posts passés pour apprendre le style, pas à produire de la vidéo. |
| Parcours | **Un seul**, quelle que soit la façon dont le compte est né (email ou GitHub/Notion/Linear). La colonne `users.vertical` reste, mais ne choisit plus le parcours. |
| Inscription | **Elle devient le premier écran de l'onboarding.** « Démarrer gratuitement » mène directement à « ton nom + les quatre portes ». Cliquer GitHub, Notion ou Linear crée le compte par OAuth. L'email et le mot de passe ne sont demandés **que** si la personne choisit « Coller mes notes ». La création de compte devient une conséquence du premier branchement, pas une étape. |
| Plusieurs sources | **Un compte branche GitHub, Notion et Linear à la fois**, à l'inscription comme plus tard, quel que soit l'email de chaque compte tiers. Les trois fournissent de la matière, souvent sur les mêmes projets vus sous trois angles (§3 bis). |
| Chat d'onboarding | **Supprimé.** Remplacé par une extraction en un appel à partir de la matière. |
| Connecteurs proposés | **GitHub, Notion, Linear, et « Coller mes notes »** — quatre portes au même rang. Au moins une est obligatoire. |
| Ton | **Plus demandé.** Appris aux retouches. |
| Temps disponible, valeurs, matériel | **Plus demandés.** Remplacés par « Qu'est-ce que tu attends de nous ? » et le choix des jours. |
| Rythme | Le **choix des jours** remplace le nombre de posts par semaine : une case cochée = un post ce jour-là. |
| Choix des séries | **Plus d'écran de sélection.** Les séries sont générées à la fin de l'onboarding, modifiables ensuite dans Direction. |

---

## 2. Le parcours, écran par écran

1. **Démarrer** (sans compte, c'est la cible de « Démarrer gratuitement » sur la landing). « Comment tu t'appelles ? », puis les quatre portes : **GitHub · Notion · Linear · Coller mes notes**. Un lien discret « Déjà un compte ? Se connecter » vers `/login`.
   - **GitHub, Notion ou Linear** → OAuth → compte créé (ou retrouvé) → écran 2. Le nom saisi traverse la redirection (gardé dans le navigateur, enregistré au retour). Champ vide : pré-rempli avec le nom du compte tiers.
   - **Coller mes notes** → email + mot de passe sur le même écran → compte créé → écran 2.
   - Un compte tiers **déjà connu** : connexion normale ; si l'onboarding est terminé, arrivée dans l'app.
2. **Ce qu'on lit.** Pour chaque porte branchée, le sélecteur existant (`RepoPicker` pour GitHub, `SourcePicker` pour Notion/Linear) avec les éléments les plus récents **déjà cochés**. Pour les notes, une grande zone de texte. En haut, les portes non branchées restent proposées (« Ajoute aussi ton Notion ») : la personne est maintenant connectée, le branchement se rattache à son compte (§3, mode « brancher une source »).
3. **Lecture.** Une animation pendant l'ingestion de la matière et l'extraction du profil (§4). Elle montre ce qui est lu (« Je lis 12 commits de akralan/creaflow… »), sur le modèle de la ligne « lecture en cours » de la landing.
4. **Ce que tu fais.** Le résultat de l'extraction, en champs éditables :
   - **Ce que tu fais** (`activityType`) — ex. « Je construis CreaFlow, un outil qui transforme le travail des développeurs en posts. »
   - **Pour qui** (`targetAudience`) — ex. « Développeurs indépendants qui lancent un produit. »
   - **Tes sujets** — les projets détectés, **avec leurs sources regroupées** (§3 bis) : « CreaFlow — GitHub akralan/creaflow · Notion Journal de bord · Linear Lancement v2 ». Renommables ; on peut détacher une source vers un autre sujet ou en faire un sujet à part.
5. **Qu'est-ce que tu attends de nous ?** Une seule zone de texte libre, avec un exemple en placeholder (« Je veux publier chaque semaine sans y passer mes soirées, et que les gens suivent la construction de mon produit jusqu'au lancement. »). Facultatif mais mis en avant.
6. **Tes jours de publication.** Les 7 jours de la semaine. **Mercredi et samedi** cochés par défaut. Un clic coche ou décoche ; impossible de décocher le dernier. Puis « C'est parti » : génération des rôles, angles et séries, arrivée sur le calendrier.

---

## 3. Données

Règle de `docs/ARCHITECTURE_VERTICALES.md` respectée : aucune table nouvelle, rien de propre à une verticale.

**`creatorProfiles`**
- **Ajout** `expectations text` — la réponse à « Qu'est-ce que tu attends de nous ? ».
- **Ajout** `publishingDays integer[] not null default '{3,6}'` — jours cochés, 1 = lundi … 7 = dimanche (ISO). Au moins un élément (contrôlé par le service).
- **Suppression** de `tone`, `values`, `equipment`, `weeklyTimeAvailable`. Le ton vit dans `styleProfile` (appris). Les prompts qui les lisaient (`prompts.ts`, `angleService`, `assistantService`) lisent `expectations` à la place.
- `brandName` garde son nom en base ; il est affiché « Ton nom ».

**`postingGoals`** : `targetCountPerWeek` devient une conséquence de `publishingDays` (nombre de jours cochés), recalculée à chaque modification des jours. Le réglage manuel du nombre disparaît de l'UI.

**`onboardingSessions`** : `messages` et `extractedProfile` n'ont plus d'usage. La table ne sert plus qu'à porter `status`. On garde la table, on supprime les deux colonnes.

**Mode « brancher une source ».** Aujourd'hui (`resolveOAuthAccount`), brancher GitHub sur un compte existant ne marche que si les deux comptes ont le même email ; sinon, refus ou second compte. Nouvelle règle dans le callback OAuth :
- **Session ouverte** → le compte tiers est rattaché à l'utilisateur connecté, quel que soit son email. S'il est déjà rattaché à un *autre* utilisateur CreaFlow : refus, message clair (« Ce compte GitHub est déjà utilisé par un autre compte CreaFlow »).
- **Pas de session** → comportement actuel (connexion, rattachement par email vérifié, ou création).
Le même mode sert dans Paramètres pour brancher une source plus tard.

**Nom saisi avant le compte.** Gardé dans le navigateur le temps de la redirection OAuth ou du formulaire email, écrit dans `creatorProfiles.brandName` à l'arrivée sur l'écran 2.

**`/signup`** disparaît au profit de l'écran 1 ; `/login` reste pour revenir (email/mot de passe et boutons OAuth).

**« Coller mes notes »** : crée un document `sourceMaterials` de type `paste`, rattaché au sujet choisi à l'écran 4 (ou à un sujet créé pour l'occasion si aucune autre source).

---

## 3 bis. Plusieurs sources, un même sujet

Le modèle le permet déjà : un sujet (`products`) peut porter plusieurs `materialSources`, et la génération lit toute la matière du sujet ensemble. C'est ce mélange qui fait la valeur :
- **Notion** — la vision long terme, la réflexion, l'organisation, les décisions.
- **GitHub** — ce qui a vraiment été construit : code, commits, README, specs.
- **Linear** — les tâches, ce qui est fini, ce qui bloque, parfois le suivi client.

Ce qui manque, c'est le **regroupement** : aujourd'hui chaque source branchée tend à devenir son propre sujet. À l'onboarding, l'extraction (§4) propose quelles sources parlent du même projet (noms proches, contenu qui se recoupe), et l'écran 4 permet de corriger. Une source qui ne recoupe rien reste un sujet à part. Pas de nouvelle table : c'est le `productId` de chaque `materialSource` qui change.

Le rédacteur gagne une consigne : quand un sujet a plusieurs sources, croiser les angles (la décision prise dans Notion, le commit qui l'applique, la tâche Linear qui l'a déclenchée) plutôt que de piocher dans une seule.

---

## 4. Extraction du profil

Un seul appel LLM (`LLM_PROVIDER`, donc OpenAI en pratique), après l'ingestion :
- **Entrée** : le nom, l'identité du compte tiers (nom, bio GitHub), et des extraits de la matière ingérée (le `buildConnectedOnboardingContext` existant, élargi à plusieurs documents par sujet : README, derniers commits, pages récentes).
- **Sortie** : `activityType`, `targetAudience`, et les sujets : pour chacun un libellé, une phrase de description et **la liste des sources qu'il regroupe** (§3 bis).
- **Échec ou matière vide** : les champs restent vides et la personne les remplit ; l'onboarding n'est jamais bloqué par le LLM.

---

## 5. Calendrier sur les jours choisis

`api/calendar/generate` répartit aujourd'hui `targetCountPerWeek × semaines` créneaux sur le mois (`distributeDays`). Désormais : **un créneau par jour coché**, pour chaque plateforme active. Les dates tombent exactement sur ces jours. L'onglet Paramètres permet de modifier les jours et le texte « Ce que tu attends de nous », avec les mêmes règles (7 jours, au moins un). L'assistant peut proposer de changer les jours (proposition à valider, comme le reste).

---

## 6. Suppression de la vidéo

- **Base** : `content_type` recréé sans `video` (Postgres ne retire pas une valeur d'enum : nouveau type, conversion, suppression de l'ancien). Défaut de `scripts.contentType` → `text`. Scripts `video` supprimés (avec leurs entrées de calendrier rattachées, qui repassent en créneau vide). Colonnes propres à la vidéo supprimées : `soundRecommendation`, `hookAudio`, `hookVisual` — **à confirmer colonne par colonne au Lot 0** (le storyboard et la légende servent aussi au post visuel et restent).
- **Code** : `videoScriptSchema`, `generateVideoScriptTool`, les consignes vidéo de `prompts.ts`, les blocs vidéo de l'éditeur, de `GenerateForm`, `ImportScriptForm`, du calendrier, de `microEdit`, de l'assistant et du directeur narratif.
- **Tests** : ceux qui testent la vidéo sont supprimés, les autres mis à jour.
- **Docs** : `PRODUCT.md`, `TECH.md`, `UI_FONCTIONNALITES.md`.
- **Pièces de marque** : on n'accepte plus de fichier `video/mp4` en upload.

**Point ouvert — TikTok et YouTube comme plateformes de publication.** Aujourd'hui, choisir TikTok ou YouTube implique la vidéo. Proposition : les retirer de la liste des plateformes de publication et ne garder que **LinkedIn et X** (Instagram reste si on y publie des visuels). À trancher avant le Lot 0.

---

## 7. Découpage

| Lot | Contenu |
| :--- | :--- |
| 0 | Suppression de la vidéo (§6) : migration, code, tests, docs. |
| 1 | Données et comptes (§3) : migration `creatorProfiles`/`onboardingSessions`, mode « brancher une source » dans le callback OAuth, inscription par la porte « notes ». |
| 2 | Extraction du profil et regroupement des sources (§3 bis, §4) : service, prompt, route, consigne de croisement pour le rédacteur, tests avec LLM mocké. |
| 3 | Nouveau parcours (§2) : les six écrans, l'écran 1 devenant la cible de « Démarrer gratuitement » ; suppression de `/signup`, du chat, de `CreatorIdentityStep`, de la sélection des séries et des parcours par verticale dans le registre. |
| 4 | Calendrier et paramètres (§5). |
| 5 | Docs à jour, `CLAUDE.md`. |

**À signaler à la landing** (autre chantier en cours) : le bouton « Démarrer gratuitement » doit pointer vers l'écran 1 ; « Comment ça marche » annonce encore « le ton, pour qui tu publies, le temps dont tu disposes » ; la grille tarifaire parle de « scripts », un mot hérité de la vidéo.
