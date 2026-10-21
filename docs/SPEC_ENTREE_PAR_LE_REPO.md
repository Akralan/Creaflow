# SPEC — ENTRÉE PAR LE REPO (landing → compte → premier post par email)

> **Statut : implémenté le 2026-10-18 sur `feature/entree-par-le-repo` (Lots 0 à 7), migration `0047` appliquée en dev, parcours complet essayé en réel (compte, séries, premier post, email en mode console, clic sur le lien, deux autres posts) ; écarts en §10.** Décisions prises à deux (Alix et Claude) ; la section 1 les garde avec leur raison, parce que CreaFlow servira à parler de CreaFlow : ce journal de décisions est de la matière pour la série devlog.
>
> **Objectif.** Une personne colle le lien d'un repo GitHub public sur la landing, vérifie trois champs que l'IA a déduits du repo, donne son email, et reçoit un email avec **son premier post** déjà écrit. Au clic dans l'email, elle arrive connectée dans l'application, où les deux autres posts de la semaine se préparent. Aucune question dont la machine peut trouver la réponse seule.
>
> **Source du parcours** : l'onboarding de la landing de tellovo.ai (prototype à données fictives : lecture → carte « Tellovo understands your business » → email → « Check your inbox »), branché ici sur les vrais services. Les écrans et les textes sont repris à l'identique de cette landing.

---

> **Mise à jour du 2026-10-21 — la carte a un quatrième champ : « Why you want to build in public ».** Il alimente `creator_profiles.expectations` et n'est **jamais** rempli par la lecture du dépôt : personne d'autre que l'auteur ne sait pourquoi il se met à publier. C'est la matière du post d'origine, qui n'a pas besoin d'événement — sans cette phrase, l'origine recopie la fiche produit (constaté en réel sur le dépôt `MyTwin-Lab/leaderboard`, dont les 47 fichiers de documentation n'ont aucun moment fondateur). Champ facultatif : il ne bloque pas l'inscription.

## 1. Décisions (journal)

| # | Décision | Pourquoi | Écarté |
| :--- | :--- | :--- | :--- |
| D1 | L'entrée est le **lien d'un repo GitHub public**, collé dans le champ de la landing. | Le plus petit geste possible : pas d'OAuth, pas de compte, pas de formulaire. Le repo contient déjà ce qu'on demandait avant. | Garder les six écrans actuels comme entrée. |
| D2 | **Trois champs pré-remplis par l'IA, retouchables** : *What you're building*, *Who it's for*, *The problem you solve*. | Ce sont les trois champs de la landing de référence. Les deux premiers existent chez nous (`activityType`, `targetAudience`) ; **le problème est nouveau** et nourrit le portrait des lecteurs. | Les demander à la main. |
| D3 | **Les attentes sont retirées.** | Elles sont déjà sous-entendues par les trois champs ; les demander mélange les questions. | Les garder en quatrième champ rempli automatiquement. |
| D4 | **Les jours restent**, sous les trois champs, **mercredi, vendredi, samedi cochés** par défaut. Réseaux : **LinkedIn et X** d'office, modifiables ensuite dans le profil. | Un rythme par défaut raisonnable ; les réseaux ne valent pas une question à l'entrée. | Demander les réseaux. |
| D5 | **Un seul sujet à l'entrée : le repo.** Le regroupement de plusieurs sources reste dans l'application. | Le plus simple pour la première minute ; le regroupement est un besoin de la deuxième semaine. | Proposer le regroupement dès l'entrée. |
| D6 | **Le compte est créé dès que l'email est saisi**, et la génération démarre à ce moment-là. | On ne dépense un appel LLM que pour quelqu'un qui a laissé son email : pas de génération perdue pour un visiteur qui part. | Générer avant l'email ; créer le compte au clic sur le lien. |
| D7 | **L'email contient un seul post.** Les deux autres sont générés **au clic** sur « voir les autres posts », et l'application affiche « les autres posts de la semaine sont en chargement ». | Moins de coût pour ceux qui n'ouvrent jamais le mail ; le mail part plus vite. | Générer les trois avant l'envoi. |
| D8 | **Connexion par lien dans l'email, sans mot de passe.** Le compte n'a pas de mot de passe ; la personne en définit un plus tard via « mot de passe oublié ». | C'est le parcours de la landing de référence, sans friction. | Demander un mot de passe à l'entrée. |
| D9 | **Pas de session ouverte à la saisie de l'email** : le lien du mail est la seule porte. | Sinon n'importe qui entrerait dans un compte ouvert avec l'adresse d'un autre. | Connecter tout de suite. |
| D10 | **Le risque d'adresse saisie par un tiers est accepté** (quelqu'un reçoit un mail et un compte qu'il n'a pas demandés). | Rare ; les gens concernés écriront. Limites par IP et par email pour le réduire (§7). | Vérifier l'email avant de créer le compte. |
| D11 | **Le système de génération actuel est gardé** : séries, forme de la série (lecteur, façon d'écrire, signature), rédacteur par événements. On ne change que l'entrée. La première série est le **devlog**. | La génération vient d'être jugée « bien mieux » ; on ne la touche pas. | Un prompt dédié au premier post. |
| D12 | **On construit l'envoi d'email maintenant**, même sans service branché. | On ne peut pas le tester en local : il faut le construire pour pouvoir l'essayer. Le mode `console` couvre l'attente. | S'arrêter à « Check your inbox ». |
| D13 | **Lecture du repo avec un jeton GitHub côté serveur** (`GITHUB_TOKEN`, sans aucun droit). | **Correction d'une idée reçue** : les 60 requêtes par heure de GitHub sont comptées sur l'IP de *notre serveur*, pas celle du visiteur. Sans jeton, ce quota est partagé par tout le site : quelques lectures par heure en tout. Avec un jeton : 5 000 par heure. | S'en contenter sans jeton. |
| D15 | **Trois jours, trois posts, sur LinkedIn.** *(Remplacée le 2026-10-18 par `docs/SPEC_APP_DESIGN_TELLOVO.md` E2 : chaque post est écrit pour LinkedIn **et** X ; le mail porte la version LinkedIn, X s'écrit juste après son départ.)* La série devlog prend les trois jours cochés ; les autres séries proposées sont créées **sans rythme** (la personne les allume dans Direction). Le post du mail et les deux suivants se génèrent sur LinkedIn (X est actif mais ses créneaux restent à écrire). | La distribution habituelle des jours entre séries donnerait un seul jour au devlog ; et un créneau par réseau doublerait la semaine. | Répartir les jours entre toutes les séries ; générer les deux réseaux. |
| D16 | **La génération reprend ce qui est déjà lu.** Si la lecture du repo échoue en route (quota GitHub, panne) mais que des documents sont déjà ingérés, on continue avec eux. | Un quota atteint à la 40e page ne doit pas coûter tout le parcours. | Tout reprendre à zéro à la moindre erreur. |
| D17 | **Pas de table de brouillon** : le navigateur garde les trois champs entre la lecture et l'email, le serveur relit le repo (sans modèle) à la création du compte. | Moins d'état à nettoyer. Le prix : une seconde lecture GitHub, gratuite avec le jeton du serveur. | Une table `signup_drafts`. |
| D14 | **Le champ « problème » devient une colonne** `products.problem`. | `valueProposition` dit ce qu'on offre, pas le mal qu'on soigne ; les mélanger brouillerait le portrait. | Réutiliser `valueProposition`. |

---

## 2. Le parcours

1. **Landing** (`HeroForm`) : le lien est validé (forme `github.com/<propriétaire>/<repo>`) puis passé à `/start?repo=…` (aujourd'hui le bouton envoie vers `/onboarding` sans transmettre la valeur).
2. **`/start` — lecture.** Écran de la landing, trois lignes qui s'animent : « Reading your README and docs », « Scanning recent commits and pull requests », « Understanding who it's for ». Pendant ce temps, le serveur lit le repo et appelle le LLM une fois (§4).
3. **Carte « Tellovo understands your business ».** Le nom du produit (nom du repo), une accroche, les trois champs éditables, puis **les trois jours** (mer., ven., sam. cochés ; un clic coche ou décoche ; jamais moins d'un jour). Le bouton devient un champ email : « Where should we send your first week? The link inside signs you in ».
4. **Envoi.** `POST /api/start` crée le compte et lance la génération en fond (§5). L'écran passe à « Check your inbox. » sans attendre.
5. **Email** (§6), envoyé quand le premier post est prêt : le post en entier, puis un bouton « See your other posts ».
6. **Clic** : le lien connecte la personne (§6), déclenche la génération des deux autres posts de la semaine et ouvre le calendrier, où ces deux créneaux affichent « en chargement ».

L'aperçu factice « Preview the email » de la landing de référence n'est pas repris : l'email est réel.

Cas d'erreur, tous affichés sur place sans perdre la saisie : lien invalide, repo introuvable ou privé (« We can't read this repo. Is it public? »), repo vide (aucun README ni commit), quota GitHub atteint, limites de débit atteintes (§7), échec du modèle (les champs restent vides et se remplissent à la main — jamais bloquant).

---

## 3. Données

Règle de `docs/ARCHITECTURE_VERTICALES.md` respectée : rien de propre à une verticale. Migration **`0047`**.

- **`products.problem text`** (nullable) : « The problem you solve ». Lu par la fabrique du portrait des lecteurs (`readerPortrait.ts`) et ajouté au contexte de la forme de série.
- **`login_tokens`** (même mécanique que `password_reset_tokens`) : `id`, `userId` (cascade), `tokenHash` unique (SHA-256, jamais le jeton), `expiresAt` (24 h), `usedAt`, `createdAt`. Un nouveau lien invalide les précédents de ce compte.
- **`start_jobs`** : une ligne par compte né de ce parcours. `userId` (clé, cascade), `stage` (`queued` → `profile` → `series` → `post` → `mailed`, ou `failed`), `error`, `mailedAt`, `otherPostsRequestedAt`, `createdAt`. Elle rend la génération **reprenable et sans doublon** : un redémarrage du serveur en cours de route, ou un second clic, ne relance rien d'inutile.
- **`calendar_entries.status`** : une valeur `generating` ajoutée à l'énumération, pour afficher « en chargement ». Repasse à `planned` si la génération échoue.
- **Compte sans mot de passe** : `users.passwordHash` est déjà nullable (les comptes OAuth). À vérifier (Lot 0) : `/api/auth/login` doit refuser proprement un compte sans mot de passe, et « mot de passe oublié » doit pouvoir lui en poser un.

Correspondance des trois champs :

| Champ de l'écran | Écrit dans |
| :--- | :--- |
| Nom du produit (nom du repo, modifiable) | `products.name` |
| What you're building | `products.description` et `creatorProfiles.activityType` |
| Who it's for | `products.targetAudience` et `creatorProfiles.targetAudience` |
| The problem you solve | `products.problem` |
| Jours | `creatorProfiles.publishingDays` (défaut `{3,5,6}` pour ce parcours), `postingGoals` recalculés |
| Nom de la personne | `creatorProfiles.brandName` : nom ou identifiant du propriétaire du repo (non demandé) |

---

## 4. Lecture anonyme du repo et extraction

`POST /api/start/analyze` (sans session).

- **Lecture sans OAuth** : `src/lib/github/client.ts` prend aujourd'hui un jeton utilisateur obligatoire. Il apprend à lire un dépôt public avec le jeton serveur `GITHUB_TOKEN` (ou sans, en repli). Contenu lu : métadonnées du repo, README et fichiers `.md` (`selectMarkdownFiles`), journal de commits (`buildCommitJournal`). On réutilise `ingest.ts` tel quel.
- **Extraction** : l'appel LLM existant (`extractProfileFromMaterial`, `profileExtraction.ts`) est adapté : une seule source, un seul sujet, et **un champ de sortie en plus (`problem`)**. Même règle qu'aujourd'hui : un échec n'est jamais bloquant.
- **Rien n'est écrit en base à cette étape** : la réponse revient au navigateur, qui garde les champs. À l'envoi (§5), le serveur relit le repo (sans LLM) pour créer la source ; c'est gratuit avec le jeton serveur et évite une table de brouillons.

---

## 5. Envoi : compte et génération

`POST /api/start` (sans session). Entrée : lien du repo, trois champs, jours, email.

1. Limites (§7), validation de l'email.
2. **Email déjà connu** : aucun compte créé ; on envoie seulement un lien de connexion à ce compte. La réponse est la même dans tous les cas (pas de fuite sur l'existence d'un compte).
3. **Email nouveau** : création du compte (sans mot de passe, sans session), du profil, du sujet unique et de sa source GitHub publique, des objectifs de publication (LinkedIn et X). Ligne `start_jobs` au stade `queued`. Réponse immédiate.
4. **Génération en fond** (`after()`, le serveur du VPS est un processus durable), chaque étape faisant avancer `stage` :
   - lecture de la matière (synchronisation de la source) et **portrait des lecteurs** ;
   - rôles, angles et séries, comme `completeOnboarding` aujourd'hui (`generateCategoriesForUser`, `generateAnglesForUser`, `generateSeriesForUser`, puis `syncSeriesSlots`) ; **la première série est le devlog** : la consigne de génération des séries lui donne cette place (Lot 0 : relire `suggestContentSeries`) ;
   - lecture de la ligne de temps et **forme de la série** ;
   - **génération d'un seul post** : le prochain créneau de la série devlog, par le chemin existant (`buildGenerationContext` → `generateScript` → `createScriptRecord`, avec l'événement choisi par le rédacteur).
5. Le post prêt, **envoi de l'email** (§6), `stage = mailed`.
6. **Échec** à n'importe quelle étape : `stage = failed`, la raison est gardée, et un email part quand même, sans post, avec le lien (« Your first week is ready to open »). La personne n'attend jamais dans le vide.

Le quota d'essai (5 scripts à vie) est consommé normalement : 1 post au mail, 2 au clic, donc 3 sur 5.

---

## 6. L'email et le lien de connexion

- **Gabarit** (`src/lib/email/templates.ts`) : même mise en page sobre que les emails de service ; titre, le post en texte, bouton « See your other posts ». Expéditeur : celui de `EMAIL_FROM`.
- **Lien** : `/connexion/lien?token=…`, valable 24 h. La page consomme le jeton **par une requête POST déclenchée à l'ouverture** (pas au chargement GET), pour qu'un scanner de liens de messagerie ne le brûle pas avant la personne. Jeton consommé : `usedAt` posé, session ouverte (`setSessionCookie`), redirection vers le calendrier. Jeton expiré ou déjà utilisé : page qui propose de renvoyer un lien (même route de renvoi, avec les mêmes limites).
- **Au premier usage du lien** : si `otherPostsRequestedAt` est vide, on le pose et on lance en fond la génération des deux créneaux suivants de la semaine (statut `generating` tout de suite, donc visible à l'arrivée). Idempotent : un second clic ne relance rien. Bandeau dans le calendrier : « Les autres posts de la semaine sont en chargement » ; l'écran se rafraîchit seul jusqu'à leur arrivée.
- **Envoi réel** : OVH ne fournit pas d'envoi de mail sur le VPS. On passe par **Brevo** (déjà codé : `src/lib/email/brevo.ts`). Il manque la clé `BREVO_API_KEY` et un expéditeur ; le guide est `docs/SETUP_EMAILS_BREVO.md`. Sans domaine authentifié, un expéditeur unique vérifié peut suffire pour les tests (à confirmer côté Brevo), avec des mails probablement classés en spam.
- **En attendant la clé** : `getEmailSender` refuse de démarrer en production sans fournisseur, et le mode `console` ne journalise pas le corps du mail en production. Pour pouvoir essayer le parcours sur le VPS sans Brevo, une variable explicite (par exemple `EMAIL_LOG_LINKS=1`) journalise **le lien de connexion** uniquement ; elle ne sert qu'aux essais et se retire dès que Brevo est branché.

---

## 7. Limites et coûts

Tout ce qui coûte (lecture du repo, appel LLM, génération) est limité avec `enforceRateLimit` (Postgres, déjà en place) :

| Action | Limite |
| :--- | :--- |
| Analyse d'un repo (`/api/start/analyze`) | par IP : 5 par heure ; 1 par repo et par IP et par minute |
| Création (`/api/start`) | par IP : 3 par heure ; par email : 3 par jour |
| Renvoi d'un lien de connexion | par IP : 5 par heure ; par email : 3 par heure |
| **Plafond global** | `START_DAILY_CAP` nouveaux comptes par jour (valeur par défaut à fixer) ; au-delà, l'écran dit « We're at capacity today, come back tomorrow » plutôt que de dépenser sans limite |

---

## 8. Découpage

| Lot | Contenu |
| :--- | :--- |
| 0 | Vérifications avant de coder : lecture d'un dépôt public sans OAuth dans `client.ts` et `syncSource` (la source exige-t-elle un compte OAuth ?), connexion refusée proprement pour un compte sans mot de passe, énumération `calendar_entries.status` et ses usages, consigne « première série = devlog » dans `suggestContentSeries`, usage réel de `valueProposition`. |
| 1 | Migration `0047` (§3), schéma, tests de schéma. |
| 2 | Lecture anonyme + extraction à trois champs (§4), tests avec LLM mocké. |
| 3 | `POST /api/start`, `login_tokens`, page `/connexion/lien`, renvoi du lien, limites (§5-§7). |
| 4 | Génération en fond reprenable, premier post, gabarit et envoi d'email, mode « lien journalisé » (§5-§6). |
| 5 | Écrans `/start` (lecture, carte, jours, email, « Check your inbox ») repris de la landing, `HeroForm` qui passe le lien. |
| 6 | Clic sur le lien : deux posts suivants, statut `generating`, bandeau et rafraîchissement du calendrier. |
| 7 | Docs (`PRODUCT.md`, `TECH.md`, `SETUP_EMAILS_BREVO.md`, `CLAUDE.md`) ; essai sur le VPS. |

---

## 9. Hors périmètre / à décider plus tard

- Le parcours actuel `/onboarding` (six écrans, OAuth, notes) **reste tel quel** pour l'instant : il sert aux inscriptions qui ne viennent pas de la landing. Son sort se décide quand ce parcours-ci aura fait ses preuves.
- Brancher Notion, Linear ou d'autres dépôts : dans l'application, après l'entrée.
- Vérification de l'email avant création du compte (D10 : accepté en l'état).
- Dépôts privés : exigent l'OAuth GitHub, donc le parcours actuel.

---

## 10. Écarts à l'implémentation et limites connues

- **Lecture du repo** : l'analyse anonyme lit au plus 4 fichiers `.md` et 30 commits (une dizaine de requêtes) ; la synchronisation à la création du compte lit jusqu'à 50 fichiers (jusqu'à 55 requêtes). Sans `GITHUB_TOKEN`, le quota de 60 requêtes par heure est atteint dès le deuxième visiteur — constaté en essai. Le jeton est donc **obligatoire** pour ouvrir le parcours au public (`.env.example`, `deploy/env.production.example`).
- **Création du compte** : elle relit les métadonnées du repo (une requête), donc elle échoue aussi quand le quota est épuisé (« GitHub is busy right now »).
- **Panne en route** : si la génération échoue, le mail part sans post (« Your first week of content is ready »). Le compte existe alors sans séries ; au clic sur le lien, `isOnboardingComplete` est faux et la personne retombe sur l'ancien `/onboarding`, dont la source (le repo public) est déjà branchée. Pas de reprise automatique depuis le lien : à décider si le cas se présente.
- **Langue du post** : celle du profil (vide ici), sinon celle de la matière lue. Un repo dont les docs sont en français donne un post en français.
- **Temps** : environ 1 minute 20 entre l'email saisi et le mail, mesuré en dev (matière de 3 documents, 13 événements) ; plus long sur un gros dépôt.
- **Création de compte pour un tiers** : accepté (D10).
- **Essais** : parcours joué avec un faux GitHub (documents semés depuis le dépôt local, le quota GitHub étant épuisé) ; la lecture réelle (`/api/start/analyze`) a été essayée sur deux dépôts publics avant l'épuisement du quota.
