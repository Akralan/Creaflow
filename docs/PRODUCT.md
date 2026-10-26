# VISION PRODUIT — CREAFLOW (Tellovo)

> Référence à jour sur le périmètre fonctionnel : ce document décrit ce que fait le code. Réécrit le 2026-10-26 après le retrait de l'assistant ; la version précédente décrivait encore des fonctionnalités retirées (fil narratif, veille d'inspiration, rééquilibrage des rôles, Instagram, onglet Topics). `BRIEF.md` reste l'archive du cadrage d'origine. Le détail des décisions est dans les specs citées et dans `DEVLOG.md`.

**Du build in public écrit à partir de ce que tu construis vraiment.**

---

## 1. Le problème et la promesse

Un développeur ou un fondateur qui construit un produit a déjà la matière de ses posts : son dépôt, ses notes, ses décisions, ses tâches. Il ne publie pas parce que transformer ça en posts lui prend du temps, et qu'une IA générique, nourrie d'une description du produit, ne peut que rester vague ou inventer.

Tellovo lit cette matière, repère ce qui s'est passé, et écrit chaque semaine des posts LinkedIn et X qui racontent le projet, **sans rien inventer** : chaque post part d'un endroit précis d'un document de l'auteur.

## 2. Cible

**Les développeurs et fondateurs qui font du build in public** et dont le travail laisse des traces écrites : un dépôt GitHub (README, docs, devlog, journal de commits), des pages Notion, des projets Linear. C'est la seule cible servie par le parcours d'entrée. L'usage validé à date est celui du fondateur ; **aucun utilisateur extérieur n'a encore testé le produit**.

Les personnes sans matière écrite (artisans, commerces), cible d'origine du cadrage, ne sont plus servies : le collage de notes et l'interview existent côté API, mais n'ont plus d'écran depuis le 2026-10-24.

## 3. Le parcours

### 3.1 Entrer : `/start` (`docs/SPEC_ENTREE_PAR_LE_REPO.md`)

1. La landing mène à `/start`. On colle le lien d'un **dépôt GitHub public**.
2. Une lecture anonyme du dépôt remplit une carte que la personne corrige : *What you're building*, *Who it's for*, *The problem you solve*. Un quatrième champ, *Why you want to build in public*, n'est jamais pré-rempli : seule la personne peut y répondre. Elle choisit aussi ses jours de publication (mercredi, vendredi et samedi cochés par défaut) et **où en est son projet** — *Going public*, *Building*, *Opening up* (bêta ou lancement), *Growing* — que la lecture du dépôt devine et justifie en une ligne (`src/lib/phases.ts`, 2026-10-26).
3. Elle donne son email. Le compte est créé **sans mot de passe**, la génération part en fond, et un email apporte le **premier post** avec un lien de connexion (24 h).
4. Au clic sur ce lien, les autres posts de la semaine s'écrivent, un par jour coché.

Le parcours en six écrans de `/onboarding` (`docs/SPEC_ONBOARDING_MVP.md` : GitHub, Notion, Linear ou notes collées) reste dans le code comme parcours de repli. On revient ensuite par `/login`, qui envoie un **lien par email** : il n'y a plus de mot de passe depuis le 2026-10-25 (`docs/SPEC_CONNEXION_PAR_LIEN.md`).

### 3.2 L'application (`docs/SPEC_APP_DESIGN_TELLOVO.md`)

- **Your content week** (`/calendar`) : les posts de la semaine à gauche, le post ouvert à droite, avec un onglet LinkedIn et un onglet X. On y retouche par l'IA (trois puces et un champ libre), on copie, on voit la source, on marque le post « Ready ». On y choisit aussi le visuel (image, carrousel, animation). **Prepare next week** écrit la semaine suivante.
- **Content plan** (`/plan`) : les quatre semaines à venir.
- **Business context** (`/context`) : les trois champs du projet, les **jours de publication** et la **phase du projet**, les sources connectées (brancher Notion, Linear ou un autre dépôt sur le projet existant, `docs/SPEC_RATTACHEMENT_SOURCES.md`), un badge de fraîcheur, et **Understand it**, qui montre les publics du projet et ses événements comptés par genre (`docs/SPEC_COMPRENDRE_LE_PROJET.md`).
- **Performance** (`/performance`) : un mois de posts LinkedIn et X, semaine par semaine (`docs/SPEC_PERFORMANCE.md`). X est lu par Apify depuis le pseudo, LinkedIn par l'API officielle (accès pas encore obtenu). Un post reconnu passe en **Posted**. L'écran affiche les chiffres, **mais le rédacteur ne les lit pas encore**.
- Dans le menu du compte : **Settings** (profil, style, réseaux, facturation, compte). Direction est retiré le 2026-10-26.

**Statuts d'un post** : Draft, Ready, Posted (posé par le back-end seulement).

## 4. Comment un post s'écrit

### 4.1 La matière et la ligne de temps (`docs/SPEC_EVENEMENT_POINTEUR.md`)

Les sources connectées sont relues **chaque nuit** (`docs/SPEC_SYNCHRO_QUOTIDIENNE.md`). Chaque document est lu en une passe par un extracteur (`src/lib/llm/pointerExtractor.ts`) qui ne résume rien, et **qui trie** (2026-10-26) : seuls les faits racontables à un inconnu, une histoire et non chacun de ses détails, rien dans le travail des autres ni dans un index, et pas un fait déjà marqué ailleurs — les journaux sont lus d'abord. Sur le dépôt tellovo, 1 880 pointeurs sont devenus 298. un **événement** est une adresse (un document, une ligne, une date si la ligne en porte une) et un **genre** parmi treize (`docs/FORMES_ET_GENRES.md`), avec deux compléments : une livraison est-elle disponible pour d'autres, et quel engagement ou quelle décision cet événement tient-il.

### 4.2 Le rédacteur (`src/lib/llm/pointerPostWriter.ts`)

Le rédacteur est un agent à outils. Il reçoit :
- la ligne de temps en adresses nues, la plus récente d'abord ;
- les posts déjà écrits ;
- le lecteur visé (un des publics du portrait du projet, `products.readerPortrait`) ;
- le contexte du projet (description et problème).

Il ouvre les documents qu'il veut, **choisit lui-même** ses événements, lit la **forme** qui correspond à leur genre (épisode, démo, chiffre, échec, leçon, promesse tenue, origine…, illustrées par de vrais posts) et publie. **La phase du projet décide des formes permises** : pas de « Launch » avant le lancement, une livraison utilisable y est une démo. Ses règles : une histoire qu'on lit jusqu'au bout, pas un compte rendu ; libre sur le récit, jamais d'invention sur les faits ; l'origine au premier post ; l'accroche ; un ton décontracté. Après chaque post, un **vérificateur** (`src/lib/llm/pointerVerifier.ts`) dit quels faits le post raconte vraiment, et ce sont eux qui sont marqués comme racontés.

Ce que le code contrôle ensuite : la langue du post (celle du profil, sinon celle des notes, `docs/SPEC_LANGUE_DES_POSTS.md`), les longueurs par réseau (`src/lib/llm/platformRules.ts`), la forme déclarée. **Un post, deux réseaux** : la version X est **le post LinkedIn adapté en thread**, de la longueur que son contenu demande (`src/lib/llm/xThread.ts`, 2026-10-26), avec ses événements et sa forme (`src/lib/services/postPairService.ts`).

Les posts visuels et les posts libres (sans série) passent encore par l'ancien prompt V3 (`docs/SPEC_PROMPT_GENERATION_V3.md`), qui utilise rôles, angles et mémoire des derniers posts.

**Le levier de qualité principal est le modèle** (`OPENAI_MODEL`), pas les règles : voir `DEVLOG.md` du 2026-10-21.

### 4.3 Le style appris

Chaque post finalisé après retouche nourrit, sur demande, une passe d'apprentissage qui **propose** des règles de style à valider dans Settings. Une fois acceptées, ces règles s'appliquent partout où la machine rédige (`docs/SPEC_APPRENTISSAGE_STYLE.md`).

### 4.4 Le visuel

Le visuel d'un post se choisit post par post : une maquette HTML composée à partir des vraies photos (montage, détourage Photoroom optionnel, éléments d'interface), un carrousel, ou une **animation** écrite par le modèle sous forme de page HTML animée, exportée en MP4 (`docs/SPEC_COMPOSITION_VISUELLE.md`, `docs/SPEC_ANIMATION_HTML_LIBRE.md`). Aucune image n'est générée par IA.

## 5. Calendrier : une série par projet, invisible

**Décidé le 2026-10-26** : un build in public raconte tout le projet, plusieurs séries ne servaient à rien. Chaque projet a **une seule série**, créée par le code à l'inscription (`ensureProjectSeries`, plus d'appel au modèle pour proposer des séries), que l'auteur ne voit nulle part. Elle reste la mécanique du calendrier et du rédacteur :
- son **rythme** est celui des jours de publication réglés dans Business context ; les changer recalcule le calendrier (`applyPublishingDaysToSeries`) ;
- son **lecteur** est le public principal du portrait du projet, construit à partir de « Who it's for » ; si le portrait change de noms, le rédacteur reprend le public principal au lieu de retomber sur V3.

Le calendrier se tient seul sur 28 jours : chaque jour de publication donne un post par réseau actif (`docs/SPEC_RYTHME_DES_SERIES.md`).

## 6. Compte, offre et conformité

- **Essai gratuit** : une semaine de contenu, à vie. Ensuite Starter ou Pro via Stripe (`docs/TECH.md` §6). La modale de paiement de l'app est visuelle seulement.
- Quotas personnalisés par compte depuis `/admin/quotas` (`docs/SPEC_QUOTAS_ADMIN.md`).
- Onglet Compte : export des données (JSON), suppression du compte avec résiliation Stripe.
- Pages légales alimentées par `src/lib/legal/publisher.ts` (encore des valeurs provisoires) ; emails par Brevo ou en mode console (`docs/SPEC_LEGAL_EMAIL_RGPD.md`).

## 7. Retiré du produit (pour ne pas le réintroduire par erreur)

| Retiré | Quand | Où c'est expliqué |
| :--- | :--- | :--- |
| Vidéo, TikTok, YouTube, Module C (recyclage) | 2026-10-16 | `SPEC_ONBOARDING_MVP.md` |
| Instagram, newsletter, blog, Slack dans l'app | 2026-10-18 | `SPEC_APP_DESIGN_TELLOVO.md` E1 |
| Rédacteur en chef, modes de série, cadrage de série | 2026-10-17 | `SPEC_REDACTEUR_PAR_EVENEMENTS.md` |
| Événements à champs, fil narratif (origine, point d'étape, promesse tenue, vision) | 2026-10-21 / 24 | `SPEC_EVENEMENT_POINTEUR.md`, `SPEC_FIL_NARRATIF.md` |
| Onglet Topics de Settings (collage de notes, interview, création de projet) | 2026-10-24 | `SPEC_RATTACHEMENT_SOURCES.md` |
| Mot de passe | 2026-10-25 | `SPEC_CONNEXION_PAR_LIEN.md` |
| Veille d'inspiration | 2026-10-25 | `SPEC_MEMOIRE_ET_VEILLE.md` |
| Assistant éditorial (chat, pièces jointes, propositions), rééquilibrage des rôles, `/scripts/new` | 2026-10-26 | `DEVLOG.md` du 2026-10-26 |
| Séries multiples, écran Direction, suggestion de séries par le modèle | 2026-10-26 | `DEVLOG.md` du 2026-10-26 |

## 8. Prochaines étapes

0. **Atteindre la barre de `docs/tests/POSTS_OBJECTIFS.md`** : six posts écrits à la main à partir du dépôt tellovo (décidé le 2026-10-26). Ce qui reste : `docs/TODO.md`.

1. **Faire tester par 5 à 10 développeurs extérieurs** et mesurer l'écart entre le brouillon et ce qui est publié. Rien d'autre ne dit si le produit tient sa promesse.
2. Mettre en ligne la version actuelle : **déployée sur le VPS le 2026-10-26** (migrations jusqu'à `0061`), mais sans `OPENAI_API_KEY` ni `GITHUB_TOKEN` dans son `.env` — la génération n'y marche pas encore. Restent `URGENT.md` (`EMAIL_LOG_LINKS`), Brevo, `publisher.ts`, sauvegardes planifiées.
3. Rebrancher le « pourquoi » de l'auteur dans le rédacteur : il est demandé sur `/start` mais ne lui parvient plus depuis le 2026-10-24, et le premier post retombe en plaquette produit (`DEVLOG.md` du 2026-10-26).
4. Faire lire les performances au rédacteur.
5. Rendre une porte à la matière non connectée (notes collées) si la cible sans dépôt revient.
