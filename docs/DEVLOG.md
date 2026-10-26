# DEVLOG — CreaFlow / Tellovo

> Journal daté du chantier : ce qui a été fait, **ce qui a été décidé et pourquoi**, ce qui a cassé et ce qu'on en a appris. Écrit pour être relu plus tard, et comme matière pour la série « devlog » de l'application elle-même (CreaFlow parle de CreaFlow). Le détail de chaque décision est dans sa spec (`docs/SPEC_*.md`, section « Décisions ») ; ici, le fil.

---

## 2026-10-26 — Le ménage : l'assistant part, et deux défauts relus

**Retiré**, sur décision de l'utilisateur : l'**assistant éditorial** en entier (écran `/assistant`, caché depuis le 18, chat, pièces jointes, outils de lecture, prompt, routes `/api/assistant/*`), `/scripts/new` (plus aucun lien n'y menait) et le **rééquilibrage des rôles** (`categoryReweightService.ts`, suspendu, que plus aucun code n'appelait). Environ 3 000 lignes.

**Ce qui reste, et pourquoi.** Les propositions à valider de l'assistant servaient aussi à l'apprentissage du style : la proposition « New analysis to approve » de Settings passait par `assistant_proposals`. Seul ce type survit. Lecture et résolution vivent maintenant dans `styleLearningService.ts` (`getPendingStyleProposal`, `resolveStyleProposal`), derrière `GET /api/profile/style/proposal` et `POST /api/profile/style/proposal/:id`, avec une carte dédiée (`StyleProposalCard`) à la place du panneau de 700 lignes qui savait afficher 19 types. Les tables `assistant_sessions`, `assistant_attachments` et les autres valeurs de l'enum restent en base (convention `REMOVED`) : des lignes les portent, et l'export RGPD les lit encore.

**Les deux défauts du 21 octobre, relus dans le code d'aujourd'hui :**
- *La paire LinkedIn / X qui ne racontait pas la même chose* est **réglée** depuis la chaîne pointeur du 24, sans que ce soit noté : `writePost` reprend les événements et la forme de la version déjà écrite (`postPairService.ts`).
- *Le premier post qui recopie la fiche produit* est **toujours là, pour une autre raison**. Le journal de commits donne maintenant des événements (100 sur MyTwin). Mais le « pourquoi tu fais du build in public » demandé sur `/start` (`creator_profiles.expectations`) **n'arrive plus au rédacteur** : `seriesReaderService` ne lui passe que la description et le problème. Il arrivait à l'ancien rédacteur d'origine, supprimé le 24. Preuve : le post 1 du banc MyTwin (`docs/tests/pointeurs/mytwin/posts-gpt-6-luna.txt`), « That's why we're building MyTwin Leaderboard: a system for… ». C'est le post envoyé par email. Correction (une ligne de prompt) laissée à une décision séparée.

**Question ouverte**, posée par l'utilisateur : plusieurs séries ne servent à rien, puisqu'on fait du build in public global. À trancher.

`PRODUCT.md` est réécrit pour décrire ce que fait le code : il décrivait encore le fil narratif, la veille, le rééquilibrage, Instagram et l'onglet Topics.

---

## 2026-10-25 — « Understand it », et la veille d'inspiration disparaît

Dans la carte du projet de Business context, un bouton **Understand it** ouvre une modale : les publics du portrait des lecteurs, et le nombre d'événements par genre trouvé dans la matière (`GET /api/events/summary`). Pas la ligne de temps. L'inventaire de ce que l'ancien onglet Topics montrait d'autre a été présenté ; l'utilisateur n'en garde rien d'autre. La **veille d'inspiration** est supprimée du code : recherche web, service, routes, et le bloc `<inspiration>` du prompt V3 avec ses deux champs de préparation. Ses données partent aussi, à la demande de l'utilisateur : la migration `0060_retrait_veille` supprime la table `inspirations` (80 fiches en dev), son type et la colonne de date des projets ; l'export du compte ne les lit plus. Photos de la modale prises sur la vraie app ; la base de dev n'ayant aucun événement (rien n'a été relu depuis le passage aux pointeurs), les comptes du banc tellovo ont été injectés dans le navigateur pour la capture. `docs/SPEC_COMPRENDRE_LE_PROJET.md`.

---

## 2026-10-25 — On se connecte par un lien, le mot de passe disparaît

`/start` créait des comptes sans mot de passe et envoyait un lien de connexion, mais `/login` ne connaissait que l'email et le mot de passe : une personne venue par `/start` qui revenait par `/login` restait à la porte, avec un message qui lui parlait de GitHub. Décision de l'utilisateur : **connexion par lien email seulement**. `/login` demande un email et envoie le même lien que `/start` (24 h, un seul usage) ; la porte « Paste my notes » crée le compte sans mot de passe ; l'onglet Account perd son bloc mot de passe, et la suppression se confirme en recopiant l'adresse. Routes et page du mot de passe retirées, pages légales corrigées. La colonne `password_hash` reste en base sans être lue : la supprimer détruit des données, c'est une décision à part. `docs/SPEC_CONNEXION_PAR_LIEN.md`. Le guide (produit, données, carte des docs), `PRODUCT.md`, le guide Brevo et le README sont repassés pour ne plus parler de mot de passe ; la carte des docs gagne aussi les specs du 24 (formes et genres, rattachement, synchro) qui y manquaient.

---

## 2026-10-24 (soir) — Une source rejoint un projet, au lieu d'en créer un

### Le constat

Après l'onboarding, brancher Notion créait **un sujet par page cochée**. Les décisions, les choix, les clients potentiels notés dans Notion tombaient dans une autre ligne de temps que celle du dépôt GitHub du même projet, et aucune série ne les voyait. Le seul code qui déplaçait une source vers un sujet était le regroupement de l'onboarding. Le branchement vivait en plus dans Settings › Catalogue, ancien design.

### Ce qu'on a décidé

- **Depuis Business context, une source rejoint toujours un projet existant.** Pas de « New subject » dans ce panneau : créer un projet sera un parcours à part (nouveau dépôt GitHub d'abord, puis les autres sources), à spécifier. L'onglet Topics de Settings, d'abord gardé « un temps », est retiré le soir même après inventaire : ce qu'il seul affichait (créer un projet, notes, fichiers, interview, resync et déliage d'une source) reviendra ailleurs petit à petit ; la liste des documents et la veille ne reviennent pas ; `ReaderPortraitPanel` et `EventTimeline` gardent leur code.
- **Cocher suffit.** Première maquette : une puce à droite ouvrait un menu de destination. L'utilisateur a demandé que cocher ouvre tout de suite les projets sous la ligne, celui de l'écran déjà choisi, et que le bouton du bas fasse tout. Avec un seul projet, il n'y a pas de blocs du tout.
- **Le panneau vit dans l'écran**, au-dessus de la grille, pas dans Settings.
- **La lecture des bases Notion est un chantier séparé.** Le lecteur suit les sous-pages mais aucun bloc de base ni ses lignes ; la promesse « tout ce qui est dessous » le demande, à chiffrer à part.

### Ce qui a été fait

Spec `docs/SPEC_RATTACHEMENT_SOURCES.md` et maquette cliquable dans le CSS de l'app (`docs/tests/notion-rattachement-mockup/`), validées. Puis cinq tâches sur `feature/rattachement-sources` : `createSourcesFromCandidates` accepte un `productId` par candidat ; la route des candidats dit le projet qui lit déjà chacun et accepte le projet cible ; `GET /api/material-sources/:id/status` pour sonder la lecture ; `SourcePanel` dans `ContextScreen`, ouvert au clic ou au retour OAuth sur `/context?connect=` ; docs. 665 tests verts. **Pas essayé en réel** : pas d'intégration Notion configurée en dev.

### Et la nuit : les sources se relisent toutes seules

Dans la foulée, la synchro quotidienne (`docs/SPEC_SYNCHRO_QUOTIDIENNE.md`) : une route protégée par `CRON_SECRET`, appelée par le cron du VPS comme la sauvegarde, qui passe toutes les sources par le `syncSource` du bouton, les plus anciennes d'abord, 25 minutes de budget. L'app n'a toujours pas de planificateur, par choix : rien dans le processus, rejouable, visible dans les logs, jamais en double. En la préparant, un défaut est sorti : **un document changé était relu sans perdre ses anciens pointeurs**, qui se doublaient et n'adressaient plus la bonne ligne. Corrigé : ils tombent avant la relecture. Et un badge dans l'en-tête de Business context dit de quand date la matière la moins fraîche.

### Au passage : la carte du back-end

Une carte de tout ce que le back-end fait d'un post, dressée le même jour, a montré que **les chiffres de performance ne reviennent dans aucun prompt de série** : ils nourrissent l'écran Performance, l'outil de lecture de l'assistant et une phrase du prompt V3 (posts libres, presque plus servi). Profil de style, veille et fiches des cinq derniers posts ne sont pas branchés non plus sur le rédacteur à pointeurs, par choix du 21 octobre. Et `readerReview.ts`, un relecteur hors contexte, est testé mais appelé nulle part. Rien de décidé là-dessus : c'est de la matière pour la suite.

---

## 2026-10-24 — Le fait a un genre, le post a une forme

### Le constat

Le rédacteur à pointeurs n'écrivait qu'une forme : l'épisode. Au run A du banc (aucune règle de forme), 12 posts sur 12 faisaient quatre paragraphes et finissaient sur une leçon. Le relevé de 274 posts LinkedIn de build in public (`docs/CATALOGUE_POSTS_LINKEDIN.md`, `docs/TYPOLOGIE_BUILD_IN_PUBLIC.md`) en compte quinze types. Les faits qui les produisent sont déjà dans les sources ; la chaîne ne les distinguait pas.

### Ce qu'on a décidé (`docs/FORMES_ET_GENRES.md`)

- **Le lecteur pose un genre sur chaque pointeur**, parmi treize valeurs fermées, avec `disponible` (une livraison utilisable par d'autres) et `tient` (l'événement réalise un engagement ou une annonce, ou revient sur une décision). Seule exception assumée à « un événement n'a aucun champ » : c'est une classification, pas un résumé.
- **La forme est prise par le rédacteur**, depuis le genre de l'événement qu'il a choisi, jamais par le calendrier. Raison de l'utilisateur : si le sujet d'un post ne plaît pas, « autre idée » doit pouvoir repartir sur une autre matière, donc une autre forme.
- **Le texte de la forme n'est pas dans le prompt système** (loi du 21 octobre : tout ce qui est nommé comme obligatoire ressort dans le texte). Le prompt n'a qu'une table genre → forme ; le rédacteur lit sa forme par l'outil `read_form`, et `publish_post` refuse une forme non lue ou différente de celle attendue.
- `tient` peut viser une **décision** (forme « looking back »), pas seulement un engagement. Étiquettes de forme en anglais. Une section « la personne qui parle » : je ou on selon les notes, jamais le « nous » institutionnel.
- Les critères de la Partie 3 sont des **critères de lecture au banc**, pas des contrôles de `scriptChecks`.

### Ce qui a été fait

Tâches 1 à 8 du plan sur `feature/formes-et-genres` : migration `0059` (enums `material_event_genre` et `post_form`, colonnes `genre`, `disponible`, `tient`, `scripts.form`), extracteur avec genres et liste ouverte (40 engagements, annonces et décisions rechargés avant chaque document), rédacteur avec `read_form` et refus, forme verrouillée pour la version X et « another idea, same story », étiquette de forme dans l'écran de la semaine.

Puis, à la demande de l'utilisateur, **de vrais posts comme modèles d'écriture** : 250 textes LinkedIn complets récupérés (`docs/tests/posts-modeles/catalogue-textes.json`), les six meilleurs par forme (réactions rapportées à la médiane de leur auteur, trois au plus par auteur) rendus par `read_form` sous la forme (`postExamples.generated.ts`, `scripts/build-post-examples.mjs`). Les posts sont devenus plus courts.

### Ce qui a cassé

- Sur le dépôt de tellovo, le JSON de l'extracteur était **tronqué à 4 096 jetons de sortie** depuis que chaque entrée porte cinq champs : un document entier perdu. Budget porté à 16 384, et le banc reprend document par document depuis un cache partiel.
- Deux runs du banc tués par Claude Code faute de mémoire, posts perdus parce que le relevé s'écrivait à la fin : il s'écrit maintenant après chaque post.

### Les bancs

| | MyKiné (genres) | tellovo |
|---|---|---|
| Pointeurs | 158, les 13 genres | 1 646 (décision 43 %, livraison 35 %) |
| Posts | 12, 10 formes, 0 refus | 12 : 6 leçons, 3 échecs, 1 origine, 1 chiffre, 1 épisode |
| Critères de la Partie 3 | 9 / 12, 2 à moitié | 10 / 12 |

Relectures détaillées : `docs/tests/pointeurs/mykine-genres/criteres-gpt-6-luna.md` et `docs/tests/pointeurs/creaflow/criteres-gpt-6-luna.md`. Sur tellovo, 9 posts sur 12 racontent des specs anciennes non datées comme si elles étaient d'aujourd'hui, et un `chiffre` était une date de l'AI Act. Sur les deux, les accroches sont presque toutes des chiffres et la phrase qui présente le projet revient souvent.

### Ce qui reste ouvert

Deux règles discutées, non décidées : **durcir l'accroche** (10 sur 12 commencent par un chiffre), et dans les formes techniques, **« on comprend le projet par le fait, jamais par une phrase qui le présente »**. La branche est mergée sur `main` le même soir.

---

## 2026-10-24 — L'événement perd tous ses champs, et le rédacteur choisit lui-même

### Ce qui a déclenché le chantier

Un test du chemin réel de l'app sur le dépôt de tellovo lui-même, avec le vrai lecteur d'événements. Le relevé :

```
43 documents, 966 688 caractères
documentsRead : 4        partsRead : 11 sur ~82
eventsSaved   : 75       eventsRejected : 21 (tous sur l'excerpt)
turns         : 107      stoppedAtMaxTurns : false
```

Il n'a pas été coupé par le plafond : il s'est **arrêté tout seul** et sa réponse finale demandait la permission de continuer — « *Which would you prefer: continue now, or pause and review the events already saved?* » — dans un travail de fond où personne ne lirait jamais la question. Les 39 autres documents n'ont jamais été lus.

Sur MyTwin Leaderboard, le même lecteur avait produit 112 événements dont **4 datés** et **107 sans `whatChanged`**, tirés de documentation de référence qui décrit comment le système marche et ne raconte rien. Le `find` chronologique du plan n'avait donc le choix qu'entre quatre décisions de politique éditoriale des news du projet. Les posts étaient mauvais, et aucun choisisseur n'aurait pu les sauver.

### La décision, prise par l'expérience

Un événement est **un document, une ligne, une date**. Aucun autre champ, et rien à rajouter plus tard : `title`, `whatHappened`, `whatChanged`, `kind`, `audiences`, `audienceAngles`, `excerpt`, `qualifiedAt`, `datePrecision` et `origin` sont **supprimés, pas conservés**. La convention du repo (garder la colonne en la commentant « retirée ») a été écartée exprès : le point du chantier est qu'aucun champ ne revienne par la petite porte.

Et il n'y a plus de choisisseur : **le rédacteur choisit**. Il reçoit la ligne de temps en adresses nues, la liste des posts publiés, sa cible, le contexte du projet, et il ouvre ce qu'il veut avec `read_file`.

### Ce que les quinze runs du banc ont appris

Le banc (`scripts/bench-pointeurs.ts`) a tourné sur trois sujets, puis quatre fois douze posts enchaînés sur tellovo, à modèle de rédaction constant (`gpt-6-luna`). Quatre états du prompt, mesurés :

| | paragraphes | longueur moy. | fins = pitch produit |
| :--- | :--- | --: | --: |
| A — aucune règle de forme | **4 partout** | 714 | 0 / 12 |
| B — + variation de forme | 3 ou 4 | 624 | 0 / 12 |
| **C — + accroche + aucun post mort** | 4 ou 5 | 816 | 0 / 12 |
| D — + porte d'entrée pour un inconnu | 4 ou 3 | 822 | **6 / 12** |

**Le run A est la démonstration que sans aucune règle de forme, le modèle s'en donne une** : douze posts sur douze à quatre paragraphes exactement, tous finissant sur une leçon généralisée.

**Le run D est la démonstration la plus nette de la loi du 21 octobre.** La phrase demandait qu'un inconnu puisse entrer dans n'importe quel post, et disait littéralement « *never from a paragraph of presentation bolted onto the end* ». Six posts sur douze ont fini par une description quasi copiée du produit. Nommer l'exigence suffit à la faire ressortir comme un bloc, et l'interdire dans la même phrase n'y change rien. La phrase est rejetée ; l'état retenu est le **run C**.

Deux autres choses apprises en route :

- **Une règle qui suppose quelque chose de faux fabrique un faux « pourquoi ».** L'origine disait d'abord que le lecteur devait se sentir concerné « *because they have the same problem* ». Vrai pour tellovo (un outil pour des devs indie, raconté à des devs indie), faux pour MyKiné (un outil pour des kinés, raconté à des devs). Le modèle a fabriqué le pont : il a ouvert le post d'origine de MyKiné sur « le piège du laptop », qui n'est pas la raison d'exister de MyKiné. Les quatre mots sont retirés.
- **La cible décide du registre.** Les deux sujets dont le lecteur est un pair qui construit donnent du récit ; MyTwin, dont les trois publics sont des opérateurs du produit, donne de la documentation d'admin. Le rédacteur obéissait à sa seule règle.

### Ce qui a cassé, et ce que le lint a trouvé

Le fil narratif entier est parti — `src/lib/narrative/`, les prompts 21, 23 et 28, `narrativeBriefService`, `timelineSynthesis`, `promiseMatch`. En nettoyant, un avertissement d'ESLint sur un paramètre devenu inutilisé (`sameEventId`) a révélé un vrai défaut : **LinkedIn et X ne partageaient plus leurs pointeurs**, donc chaque réseau rechoisissait les siens et les deux versions du même post racontaient autre chose. Corrigé par `restrictToLocked`, qui réduit la ligne de temps du second réseau aux pointeurs du premier — il n'a donc rien d'autre à choisir.

Deux conséquences assumées : le calendrier **n'annonce plus** le titre des prochains posts (il les prenait dans l'ordre des dates, qui n'est plus l'ordre du choix), et un événement **ne se saisit plus à la main** (c'est une adresse produite par la lecture, pas une fiche).

### Ce qui reste

Les deux migrations sont écrites mais **pas appliquées** : la base de dev est partagée avec le checkout principal, et ces `DROP COLUMN` y casseraient `main`. Le chantier n'a donc **jamais tourné dans l'app** — seulement au banc. Restent aussi : le style appris qui ne va plus au rédacteur, les citations qui n'ont plus d'entrée, et `docs/PROMPTS.md` / `docs/TECH.md` à mettre à jour.

---


## 2026-10-18 — De la landing à une application qui écrit pour LinkedIn et X, et une animation qui n'est plus un diaporama

### 1. Entrée par le repo (`docs/SPEC_ENTREE_PAR_LE_REPO.md`)

**Fait.** La landing mène à `/start` : un lien de repo GitHub public → une carte à trois champs déduits par l'IA → un email → un compte créé sans mot de passe, la génération en fond, un email avec le premier post et un lien de connexion (24 h, usage unique) ; au clic, les deux autres posts de la semaine s'écrivent.

**Décisions clés.**
- *Le compte se crée dès l'email* (D6), mais **aucune session** n'est ouverte avant le clic sur le lien (D9) : sinon n'importe qui entrerait dans un compte avec l'adresse d'un autre.
- *Un seul post dans le mail* (D7) : moins de coût pour ceux qui n'ouvrent jamais le mail.
- *Un jeton GitHub côté serveur* (D13). Correction d'une idée reçue : les 60 requêtes par heure de GitHub sont comptées sur **l'IP du serveur**, pas celle du visiteur. Sans jeton, tout le site partageait un quota minuscule.
- *Le jeton du lien est consommé par un POST à l'ouverture de la page*, pas par un GET : un scanner de mails ne le brûle pas.
- *Le système de génération existant est gardé* (D11) : on ne change que l'entrée.

**Appris.** Le quota GitHub est tombé en plein essai (403 sur les blobs) : la génération reprend ce qui est déjà lu (D16). Un effet React en StrictMode tuait ses propres minuteurs : deux effets, dont un gardé par une référence.

**À ne pas oublier.** `URGENT.md` : retirer `EMAIL_LOG_LINKS` (lien de connexion écrit dans les logs) avant de brancher Brevo.

### 2. L'application au design de tellovo.ai (`docs/SPEC_APP_DESIGN_TELLOVO.md`)

**Fait.** Le CSS de l'app de démonstration de tellovo.ai est copié (accent CreaFlow conservé) ; « Your content week » remplace le calendrier et la page de détail ; « Content plan » et « Business context » ; Direction et Settings dans le menu du compte ; l'assistant est caché, pas supprimé.

**Décisions clés.**
- **LinkedIn et X seulement** (E1) et **un script par réseau, rattachés au même créneau, sur le même événement** (E2) : le même texte collé sur deux réseaux est une mauvaise publication sur les deux. Un script par réseau garde le modèle de données et toutes les routes.
- **Le quota compte des semaines** (E10) : ce qu'on offre à un fondateur, c'est une semaine de contenu, pas cinq scripts (avec deux réseaux, compter les scripts aurait doublé la facture sans rien dire à l'utilisateur). Table `consumed_weeks`, migration `0048`.
- **Trois statuts, Draft / Ready / Posted** (E14), Posted n'étant jamais déclaré à la main : c'est un fait observé.
- **Le visuel se choisit post par post** (E16), le texte ne change pas, l'image est commune aux deux réseaux, c'est une micro-retouche.
- **Mobile ultra simple** (E15) : les jours en pastilles, le script dessous, les actions en icônes.

**Cassé, puis corrigé.**
- « Prepare next week » ne faisait rien : le rattrapage des créneaux « en chargement » se basait sur la date de la première demande du compte, donc tout nouveau créneau était libéré aussitôt, et l'écriture en fond ne trouvait plus rien. Chaque créneau porte maintenant sa propre date (`generating_since`, migration `0049`). Et le plan ne recevait que le prochain créneau vide de chaque série (`all=1` pour tout recevoir).
- « The image could not be composed » : l'erreur réelle (« empty timeline ») était masquée par un message générique et était **intermittente** (un tirage raté du modèle). Journal ajouté, seconde tentative.
- Aucun retour visible pendant les actions longues : une ligne d'état sur le post, un cadre qui scintille, le tout indépendant de la bulle d'outils.

**Erreur de ma part, réparée.** J'ai poussé par mégarde `docs/founder/` (194 fichiers) et une image WhatsApp, qui n'étaient pas à moi ; commit retiré, branche réécrite, fichiers jamais perdus.

### 3. L'animation devient une page HTML libre (`docs/SPEC_ANIMATION_HTML_LIBRE.md`)

**Le déclic.** L'animation était un dessin à calques et une ligne de temps à cinq effets ; elle produisait des diapositives de texte qui défilent. Alix : « la base n'est pas bonne ; il faut qu'il puisse faire une animation HTML de X secondes avec tout ce qu'il veut, juste un contrôle contre les trucs bizarres, comme Claude Design. »

**Décisions clés.**
- **Le modèle écrit la page** (HTML, CSS, SVG, JS), jouée dans un **iframe enfermé** (`sandbox="allow-scripts"`, CSP `default-src 'none'`), images et polices intégrées en `data:`.
- **Le JS est autorisé, sous un contrat de temps** : l'animation est une fonction du temps (`window.seek(ms)` pure, pas de minuteur, pas de hasard), parce que l'export vidéo se fait image par image (le principe de Remotion).
- **Le contrôle a trois couches** : lecture du code, enfermement, essai de rendu (la page se regarde elle-même). Le but est « pas de trucs bizarres », pas de limiter la création.
- **Les chiffres à l'écran viennent du post** : « 12 squats » ou « 13/20 » sonnent juste et sont faux ; dans un post sur le travail de quelqu'un, un chiffre inventé est un mensonge.

**Ce que les essais MyKiné ont montré.**
- Le modèle a de bonnes **idées** visuelles (une silhouette dont un point sur trois s'éteint ; une courbe qui franchit trois fois un seuil) et réalise mal la **mise en page** : textes qui se chevauchent, noir sur fond sombre, première image vide, tracés SVG peints en noir, gros texte dans la zone cachée par l'interface des réseaux.
- La revue du modèle **sur ses propres images** corrige peu ; **l'essai de rendu mesuré** (coordonnées exactes renvoyées au modèle) fait le travail. Et un tour de correction ne suffit pas toujours : il corrige un chevauchement et en crée un autre. On garde la moins mauvaise page plutôt que rien.
- Un appel au modèle peut rester suspendu plusieurs minutes : délai de 3 minutes sur le client.

**Fait côté application.** Table `post_animations` (migration `0050`), service et routes, lecteur dans le post, choix « Animation » dans « Add a visual », essai de rendu lancé par le navigateur après l'écriture et au plus deux corrections. Compte de test MyKiné (`mykine.test@example.com`) avec quatre animations rangées en base de dev.

**Pas encore.** Export MP4, « demander un changement » / « voir le code », retrait de l'ancien moteur, photos de la bibliothèque dans l'animation.

### 4. L'écran Performance (`docs/SPEC_PERFORMANCE.md`)

**Le déclic.** L'écran `/performance` ne montrait aucun chiffre (une liste « To confirm » et un rééquilibrage que plus rien ne génère). Alix : « il faut juste les afficher » — et voir l'écran *avant* de décider des données.

**Méthode : maquette d'abord.** Une page HTML autonome sur le compte MyKiné (`docs/tests/performance-mockup/index.html`, CSS réel de l'app), refaite cinq fois avant la spec. Ce qu'elle a appris : une semaine comme unité (pas de 7/14/30 jours), un mois parcouru semaine par semaine, LinkedIn et X toujours ensemble, des chiffres de démo qui *progressent* (la première version baissait, le pire exemple), et surtout **de la hiérarchie** — trois maquettes où tout avait la même taille, « je me perds dans ce que je dois regarder ». Sources : Carbon (le plus important = le plus grand et le plus contrasté), Stephen Few, le skill dataviz. Icônes en trait, jamais d'emojis.

**Décisions clés.**
- **X par Apify** plutôt que par l'API officielle : ≈ 0,06 à 0,24 $ par utilisateur et par mois contre 0,60 à 3 $, et plus de compte de facturation ni d'OAuth de X pour les chiffres (les vues d'un post sont publiques). L'API officielle reste en repli. **LinkedIn reste sur l'API officielle** : un scraper ne voit pas les impressions.
- **`Posted` est posé par le rattachement** (promesse de E14 restée en suspens), avec un rattachement automatique quand un seul script ressemble nettement au post.
- Une colonne ajoutée, `post_metrics.published_at` : classer selon la date *prévue* serait faux dès qu'on publie un jour plus tard.

**Ce qu'on a trouvé en route.** L'en-tête `LinkedIn-Version: 202401` ne pouvait pas marcher (l'API des statistiques de posts date de 202506) : passé à 202606. Le code relisait 20 posts à chaque rafraîchissement de X (≈ 0,10 $ l'appel au tarif officiel), pas « les posts rattachés » comme la spec de septembre le supposait. Le compte de démo n'étant connecté à aucun réseau, l'écran affichait d'abord « Connect… » au lieu des chiffres : dès qu'il y a des posts, on les montre.

**Pas encore.** Un vrai acteur Apify contre un vrai compte (les champs de sortie sont supposés), l'accès LinkedIn, l'usage de ces chiffres par l'agent qui écrit et qui planifie.

**Après la revue à froid (2026-10-19).** Un agent relecteur sans contexte a rendu « corrections requises » sur cinq points, tous corrigés : lecture et rattachement filtrés par utilisateur (migration `0053`, unicité des candidats par utilisateur), contrôle de fréquence d'Apify pris avant l'appel et gardé en base, plafonds sur les nombres venant d'Apify et un échec par post qui n'arrête pas les autres, un script déjà lié refusé, rattachement automatique resserré (date et légende doivent toutes deux concorder). Il a aussi relevé un redirect ouvert préexistant dans `/api/auth/[platform]/connect` (`returnTo`), refermé au passage. Reste connu : pas de « délier » un post, semaines en UTC (un post du lundi 00:30 à Paris tombe dans la semaine d'avant), les tests ne couvrent pas les chemins qui touchent la base.

**Une semaine qui commence.** Un lundi à 00:58 l'écran montrait 0 et −100 % : la semaine neuve n'avait encore aucun chiffre. Règle : pas d'écart tant qu'aucun post de la semaine n'a de chiffres (tirets), et une pastille accent « Wait N days » à côté du pourcentage tant que le post le plus récent a moins de 3 jours (`daysUntilSettled`) ; le titre et la phrase restent neutres pendant ce temps. Le calcul est pur et testé ; les deux états sont dans `docs/tests/performance-screens/` (9 et 10).

**Se connecter depuis l'écran.** Sur la demande du fondateur : logos des réseaux restants en haut à droite, panneau de pseudo pour X, OAuth pour LinkedIn, page à tirets dès qu'un réseau est connecté. Les captures de chaque état se font avec Chrome et `playwright-core` en répondant aux appels d'API par des données fabriquées.

### Pièges de méthode (pour la prochaine fois)

- Les heredocs shell avec apostrophes ou backticks cassent la commande sous Git Bash : écrire les patchs dans un fichier avec l'outil d'écriture.
- Les worktrees `.claude/worktrees` polluent `vitest` : lancer `npx vitest run --exclude ".claude/**"`.
- `tsx` (esbuild) ajoute un `__name()` aux fonctions passées à `page.evaluate` : passer le code de la page sous forme de chaîne.
- Sous Git Bash, `MSYS_NO_PATHCONV=1` pour ne pas réécrire `/api/...` en chemin Windows.
- Un test qui exécute le JS du lecteur (`new Function`) a attrapé une faute d'échappement (`\n` dans un gabarit) qui aurait désactivé tout le lecteur sans erreur visible.

### État des branches

`feature/entree-par-le-repo` et `feature/app-design-tellovo` (qui l'inclut) : migrations `0047` à `0050` appliquées en **dev seulement**, **pas encore sur le VPS** (qui sert toujours la landing et les stories de la version précédente). Un déploiement demande : clé OpenAI, `GITHUB_TOKEN`, `START_DAILY_CAP`, les migrations, et la vérification des polices dans l'image.


## 2026-10-21 — Pourquoi les posts étaient des inventaires

Deux jours sur une seule question : les posts générés étaient des rapports à rubriques (« Bilan factuel : », « Ce que ça coûte : », « À retenir pour un prototype : »), jamais des histoires. Chaque resserrage du prompt empirait les choses. Le diagnostic a été fait au banc d'essai (`scripts/bench-brief.ts`), six branches sur les mêmes trois événements du devlog MyKiné, relevés dans `docs/tests/bench-brief-*.txt`.

### La loi qu'on en retire

**Tout élément nommé comme obligatoire dans le prompt ressort dans le texte.** En titre de paragraphe si on le laisse faire ; en phrase qui récite la règle si on interdit le titre. Preuve : le prompt disait *« Find the tension before you find the words »* et le post sortait « La tension était simple et nette : … ». Le prompt disait *« it ends on a fact that is still true »* et le post sortait « Ce qui est vrai maintenant : … ». Les étiquettes étaient les noms des règles.

Corollaire : **une règle de plus, c'est une rubrique de plus**. La seule direction qui marche est le retrait, et la démonstration par l'exemple — qui ne nomme rien.

### Les trois causes, dans l'ordre où elles ont été mesurées

1. **Le brief était un formulaire, et le post en était le rendu.** Cinq lignes de brief donnaient cinq paragraphes, dans l'ordre, chacun étiqueté du nom de son champ traduit. `whatHappened` arrivait « 2 to 5 sentences » déjà rédigées, en anglais : le rédacteur traduisait. La trace montre qu'il **avait lu le document source** et avait traduit le résumé quand même — on lui donnait la réponse à côté de la question.
2. **Les rubriques étaient recopiées, pas inventées.** `docs/tests/mykine-pack/B/decisions.md` est écrit « Contexte : / Choix : / Perdu : », le devlog porte des « Seuils : » et des « Problème : », et le post ressortait « Décision : / Coût : / Ce qui change maintenant : ». 47 des 69 événements du sujet viennent de ce fichier. Dire au rédacteur que sa source est un classement, pas un modèle d'écriture, a fait tomber les étiquettes de 9 à 1 sur trois posts.
3. **Le portrait des lecteurs prescrivait la forme.** Le prompt 18 demandait « ce qui l'arrête de scroller » et le modèle répondait « des diagrammes, des bouts de code, des listes concises de ce qu'on changerait ». C'était la maladie du brief de série (supprimé la veille) dans une autre table. Les portraits **déjà écrits** gardent ces prescriptions : un recalcul reste à faire.

### Ce qui a été changé

Le brief se réduit au projet (nom, description, problème), à l'événement (date et titre), à ce qui précède et au document source. Les trois exemples inventés du prompt sont remplacés par trois vrais posts de l'auteur, en français, qui portent le contexte global de leur projet ; les paires d'accroches fictives du prompt coeur sont retirées. L'accroche n'est plus recopiée en tête du texte (3 posts sur 3 avant, 0 sur 3 après) : le champ `caption` demandait « le texte du post, en entier ». Et les règles que les vrais posts contredisaient sautent — interdiction d'expliquer le produit, interdiction absolue de call to action et de fin tournée vers l'avenir, première personne du singulier obligatoire, contexte rationné à une demi-phrase.

### Ce qui reste ouvert

- **Le rédacteur de récit (prompt 28) n'a pas été traité.** Il reçoit toujours `What happened / What it changed / For this reader / What it cost` pré-rédigés pour chacun de ses douze événements. Deux des trois posts d'une semaine viennent de lui, et ce sont eux qui gardent la forme de formulaire.
- ~~Le lecteur d'événements désamorce la tension.~~ **Réglé le 2026-10-21 par suppression** : `at_stake` n'était plus lu par aucun prompt, il n'est plus rempli non plus. Trace du raisonnement : La description de `whatHappened` dit *« the facts … Nothing else »*, et « Nothing else » efface ce qui rend un fait racontable : la source dit « des images de lui **en caleçon** sur mon VPS », l'événement enregistre « images of Julien were being stored on the VPS ». 54 des 69 événements ont un `at_stake` vide, et quand il est rempli c'est souvent de l'analyse (« implied a clinical need and potential product market ») au lieu du détail qui gêne.
- **Les portraits de lecteurs déjà en base** gardent leurs prescriptions de forme (celui du compte de démo a été corrigé à la main, sauvegarde dans `docs/tests/portrait-lecteurs-mykine-avant.json`).

### Pièges de méthode

- Mon scoreur d'étiquettes comptait comme défaut de vraies phrases (« Le problème n'est pas la formule : c'est le bruit »). Une métrique automatique sur la ponctuation ne distingue pas un intertitre d'un deux-points narratif : c'est pourquoi la règle est restée dans le prompt et n'est pas descendue dans `scriptChecks`.
- J'ai qualifié une branche de « régression » en la comparant à la branche précédente au lieu de la comparer aux posts que le fondateur juge bons. Ses trois exemples portent 7 étiquettes sur 3 posts ; la branche accusée en portait 6. La référence était fausse, pas la branche.
- `node --env-file=.env` lit un `.env` que `source .env` casse (une valeur contient `<` et `>`).

### Le modèle comptait plus que les règles

Même banc, mêmes trois événements, même brief, **seul `OPENAI_MODEL` change** : `gpt-5-mini` → `gpt-6-luna`.

| | `gpt-5-mini` | `gpt-6-luna` |
|---|---|---|
| paragraphes étiquetés | 6 / 17 | **0 / 12** |
| détails humains gardés | 2 / 10 | **6 / 10** |
| longueur moyenne | 1044 car. | **671 car.** |

Le « quand même » de « il a quand même fait 20 squats dans son salon » — le mot qui porte toute l'histoire — n'est sorti d'**aucune** des six branches sur `gpt-5-mini`, et sort du premier essai sur `gpt-6-luna`, avec la bière de l'entrée du 9 novembre (« Bière avec Julien. ») que personne n'avait jamais vue. Les quatre jours de retraits n'étaient pas vains (les rubriques venaient bien du prompt, 9 → 1), mais l'écart entre « inacceptable » et « bon » était surtout le modèle. Relevé dans `docs/tests/bench-brief-G-gpt6-luna.txt`.

Ce que le modèle ne règle pas : la **sélection**. Quels moments méritent un post reste décidé en amont, et c'est là que la ligne de temps compte — pas pour la tension, qui se lit dans les documents.

### Le post de vision est retiré

Constat du fondateur, et le code lui donne raison : un post de vision est juste un post d'événement dont l'événement est gros. Les trois preuves sont dans `docs/SPEC_FIL_NARRATIF.md`. Et un bug partait avec : son ancrage `decisions.slice(-VISION_SCOPE)` opérait sur un tableau trié `date asc nulls last`, donc il prenait les décisions **sans date** — 0 datée sur 12 dans le pack MyKiné, d'où un post de vision sur une colonne JSONB sans index, pendant que la vraie décision récente (« le devis d'hébergement HDS dépasse le revenu → anonymiser les données patient », 3 octobre) n'a jamais été vue.

Erreur de raisonnement à noter, relevée par le fondateur : j'avais écrit que « personne ne veut lire une décision de schéma de base de données ». Faux — le lecteur de cette série est « Solo product devs » et le portrait contient « Backend / infra engineers ». Le défaut n'était pas le sujet mais le **type** (un bon épisode présenté comme une vision), l'enjeu au conditionnel dans la matière, et un nom de table livré tel quel.

### Reste ouvert

- Le périmètre de l'origine est à 2 : le post commence sur le plus spectaculaire des deux moments, et le moment fondateur passe en flashback. À 1, il commencerait sur la bière.
- Le point d'étape et la promesse tenue se recouvrent (« récapituler » vs « ce que j'avais dit que je ferais »). Question non tranchée.
- `ORIGIN_SCOPE = 2` et le bloc d'origine réécrit ont été réglés contre les défauts de `gpt-5-mini` : à re-juger sur `gpt-6-luna`.

### Nettoyage du 2026-10-21

Audit du code laissé derrière par quatre jours de retraits. Supprimés : `at_stake` (champ de l'outil du lecteur, son paragraphe de prompt, ses écritures et ses champs de brief), `angleFor()` et le champ `angle` des briefs (calculés dans deux services, imprimés nulle part), et cinq scripts périmés (`baseline-lot0-*`, `baseline-lot1-run`, `baseline-lot2-run`, `mykine-compare` — remplacé par `bench-brief.ts`).

Gardés exprès, avec leur raison écrite dans `src/db/schema.ts` : les colonnes `at_stake`, `beat_id`, `mode`, `form`, `framing`, `chosen_voice` (convention du repo — on marque `REMOVED`, on ne migre pas), la valeur `vision` de l'enum `narrative_kind` et sa lecture dans `recentPosts` (des posts en base la portent), et la table `narrative_state`, morte pour le produit mais lue par l'export RGPD de `accountService`.

`audience_angles` reste aussi, et c'est un cas intéressant : son **texte** n'est plus imprimé dans aucun prompt, mais demander « qu'est-ce que ce fait change pour lui » est ce qui fait décider au modèle **si** ça change quelque chose — et le tableau `audiences` qui en est dérivé décide quelle série peut raconter quel événement. Le champ gagne sa place comme raisonnement, pas comme contenu.

La reproduction du prompt 21 dans `docs/PROMPTS.md` avait dérivé d'un chantier entier (elle disait encore « technical docs contain no event »). Elle est désormais **régénérée depuis le code** — system prompt et schémas d'outils. Un script permanent de synchronisation éviterait la prochaine dérive ; il n'existe pas encore.

### L'origine cesse d'exiger un événement (2026-10-21, fin de journée)

Trois fois dans la journée le fondateur a dit la même chose : un post d'origine n'est pas forcément basé sur un événement, ça peut être la présentation du projet, du besoin, et de la raison pour laquelle la personne se met à construire en public. Le code exigeait un événement (`events.length > 0`, puis un périmètre de 2) et je l'ai répété à l'envers une fois de trop.

Ce qui change : l'origine est placée au rang 1 de la première série **qu'il y ait des événements ou non**. S'il existe un moment fondateur il sert d'ancre et est marqué raconté ; sinon le périmètre est vide et le brief porte les mots de l'auteur — ce qu'il construit, pour qui, le problème, et **pourquoi il publie**. `ORIGIN_SCOPE` : 2 → 1.

Le champ « Why you want to build in public » est ajouté à la carte de `/start` (`creator_profiles.expectations`). Il n'est jamais rempli par la lecture du dépôt, exprès.

**Ce que l'essai en réel a montré, et c'est la leçon du jour.** Sur `MyTwin-Lab/leaderboard` — 47 fichiers de documentation, aucun devlog — le journal de commits a été lu **en premier** (le tri `narrativeFirst` a bien marché, 8 jours datés reconnus) et a produit **zéro événement** : les commits disent « feat(home): plain section titles, links below » — vrai, daté, mais rien en jeu. Le lecteur a ensuite miné la documentation et sorti 112 réglages non datés (« Default GPU instance type set to L4-1-24G »).

Et le post d'origine généré sans `expectations` est ressorti en deux phrases qui recopient `products.problem` puis `products.description` : **exactement la plaquette pour laquelle on avait supprimé la vision le matin même**. Donner à l'origine la fiche produit et rien d'autre redonne la fiche produit. La phrase qui manque ne peut venir que d'une personne, et c'est pour ça qu'on la demande maintenant.

Deux défauts relevés et pas corrigés : dans le chemin `/start`, le premier post est écrit **sans plan narratif** (donc comme épisode) puis `writeSecondNetwork` en calcule un pour l'autre réseau — d'où une paire LinkedIn/X qui ne raconte pas la même chose. Et le relecteur a refusé « Rubens Valcy » et « September 16 » comme des mots que le lecteur ne comprend pas : un nom de personne et une date ne sont pas du jargon.