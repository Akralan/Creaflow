# SPEC — ÉCRAN PERFORMANCE

> **Statut : implémentée le 2026-10-19 sur `feature/performance`** (lots 0 à 3 ; migrations `0051` à `0053` appliquées en base de dev seulement). **Pas essayée avec un vrai compte X ni LinkedIn** : le fournisseur Apify n'a jamais tourné contre un vrai acteur (champs de sortie supposés, voir §4), et la version de l'API LinkedIn n'est pas vérifiée. Données de démo MyKiné : `scripts/seed-performance-demo.ts`. Référence visuelle validée par le fondateur : `docs/tests/performance-mockup/index.html` (page autonome, chiffres d'exemple MyKiné, s'ouvre dans un navigateur). Elle reprend le CSS réel de l'app (`tellovo-app.css`, `app-extra.css`) : toute différence de rendu avec l'app est un bug de l'implémentation, pas de la maquette.
>
> Cette spec remplace l'écran `/performance` actuel (liste « To confirm » + rééquilibrage). Elle s'appuie sur la plomberie de `docs/SPEC_METRIQUES_AUTO.md` (archive), qui reste vraie : récupération, rattachement post↔script, snapshots.

---

## 1. Ce qu'on construit

Un écran qui dit, **en moins de cinq secondes**, si l'audience grandit et quel post a le mieux marché. Il affiche seulement : il ne décide rien, ne propose rien. L'usage des performances par l'agent qui écrit et qui planifie viendra plus tard (§9) ; l'écran n'a pas à l'attendre.

Périmètre : **LinkedIn et X**, les deux toujours affichés ensemble. Un mois (quatre semaines), qu'on parcourt semaine par semaine.

## 2. L'écran, du plus important au moins important

Trois niveaux de poids visuel, volontairement inégaux (un écran où tout a la même taille perd le lecteur — retour du fondateur sur trois maquettes successives).

| Niveau | Élément | Contenu |
| :--- | :--- | :--- |
| **1** | **Carte héros** (à gauche) | Le chiffre de la semaine choisie : **impressions** (≈ 70 px), pastille d'écart avec la semaine précédente (`▲ +48 %`, la plus visible de l'écran), détail « x sur LinkedIn · y sur X » |
| **1** | **Carte « Best post »** (à droite, teintée accent) | Le post de la semaine qui a eu le plus d'impressions : titre, impressions LinkedIn et X, « 2,4× ta portée habituelle » |
| **2** | **Trois chiffres** sous le héros | Likes, commentaires, partages de la semaine, icône + valeur + écart ; sans boîtes, séparés par des filets |
| **2** | **Graphique** dans la carte héros | Quatre barres, une par semaine, impressions ; la semaine choisie en accent, les autres en gris ; cliquables |
| **3** | **Liste des posts** | Une carte blanche, les quatre semaines à la suite (la plus récente en haut) ; la semaine choisie à pleine intensité, les autres atténuées |

**Titre de page** : une phrase qui dit l'essentiel (« You're growing. » / « A quieter week. » / « Your first week. »), sous-titre avec le nombre de posts et de personnes touchées.

**Navigation** : flèches ‹ › à côté de « Performance », clic sur une barre du graphique, ou défilement de la liste (une barre collante « Week of … / This week » suit). Aucun sélecteur de période, aucun filtre réseau.

**Ligne de liste** : carré de date (jour en gros, jour de la semaine dessous) · titre (+ pastille « Best post » seulement sur le meilleur post de la semaine choisie) · colonne LinkedIn · colonne X. Chaque colonne : impressions en gras (devant le logo du réseau), puis likes, commentaires et partages en **icônes en trait** (cœur, bulle, boucle) — jamais des emojis. En-têtes de colonnes : les deux logos, sans texte. Libellés en infobulle.

**Règles transversales**
- Icônes en trait de la famille de `AppIcon` ; logos LinkedIn et X en SVG (couleur de marque pour LinkedIn, encre pour X).
- Une seule couleur d'accent pour « ce qui compte », gris pour le reste (forme « emphase » du skill dataviz) ; vert/rouge réservés aux écarts, avec flèche et signe (jamais la couleur seule).
- Pas d'écart affiché sur la première semaine de la fenêtre (pas de semaine précédente).
- Anglais dans l'interface, comme le reste de l'app.

## 3. D'où viennent les chiffres

Aucune nouvelle table. Tout vient de l'existant :

| Donnée affichée | Source |
| :--- | :--- |
| Impressions, likes, commentaires, partages d'un post sur un réseau | `post_metrics` (valeur courante, un enregistrement par script, donc par réseau) |
| Un post = deux scripts (LinkedIn, X) même créneau | `postPairService` |
| Titre, date | script + créneau du calendrier |
| Semaine d'un post | **date de publication réelle** (voir ci-dessous), lundi → dimanche |
| Totaux et écarts de la semaine | somme des valeurs courantes des posts de la semaine, comparée à la semaine d'avant |
| « × ta portée habituelle » | impressions du post ÷ médiane des posts de la fenêtre affichée ; **absent sous 5 posts** (trop bruité) |

**Une colonne à ajouter** : `post_metrics.published_at` (date de publication réelle remontée par l'API, `PlatformPostMetric.publishedAt`, que `fetchAndMatchPostsForUser` reçoit déjà et ne conserve pas). Sans elle, on classerait les posts selon la date *prévue* du calendrier, fausse dès qu'on publie un jour plus tard. Migration `0051`. Repli si la plateforme ne renvoie pas de date : date prévue du créneau.

**Fenêtre** : les quatre dernières semaines, la semaine en cours comprise. Une semaine sans post est affichée (barre à zéro, pas d'écart calculable : « — »).

**Une semaine qui commence, et des chiffres qui arrivent** (règle ajoutée le 2026-10-19, après avoir vu « 0 » et « −100 % » un lundi à 00:58). Trois cas, tous côté client (`derive.ts`, `PerformanceScreen.tsx`) :
- **Aucun post avec des chiffres dans la semaine** : pas d'écart du tout, des tirets « — » à la place des chiffres et dans le graphique, titre « A fresh week. » (semaine en cours) ou « Nothing went out this week. ». Les chiffres et l'écart n'apparaissent qu'à partir du moment où les chiffres d'un post ont été récupérés.
- **Un post récent** (`daysUntilSettled`) : les vues continuent d'arriver pendant quelques jours (`NUMBERS_SETTLE_DAYS = 3`). Tant que le post le plus récent de la semaine a moins de 3 jours, une pastille **accent** « Wait N days » s'affiche à côté du pourcentage (infobulle : les vues arrivent encore), le titre devient « Numbers are still coming in. » (jamais « You're growing » ou « A quieter week » sur une semaine trop jeune), la phrase du dessous dit « … so far — views keep arriving for a few days. » au lieu de « 96 % de moins », et la carte « Best post » n'affiche plus « × ta portée habituelle ».
- **Semaine ouverte par défaut** : la dernière qui a des posts, jamais une semaine vide.

**Un biais assumé, à connaître.** Les chiffres d'un post continuent de monter après sa semaine. La semaine en cours est donc *toujours* moins mûre que la précédente, et l'écart « +48 % » compare deux maturités différentes. On garde la comparaison simple (valeurs courantes) parce que c'est ce que montre l'app de chaque réseau, et parce qu'un écart annoncé à tort négatif en début de semaine est le seul vrai risque : voir D6.

## 4. Récupération et rattachement (existant, avec deux changements)

- **Déclenchement** : à l'ouverture de l'écran, `POST /api/performance/refresh` (lazy, pas de cron). Inchangé.
- **Cadence** : X relu au plus une fois par 24 h (`MIN_REFETCH_INTERVAL_HOURS`) ; LinkedIn sans limite propre. Inchangé.
- **X passe par Apify** (D1/D2). L'API officielle coûte ≈ 0,005 $ par post renvoyé, soit ≈ 0,10 $ par rafraîchissement de 20 posts, donc ≈ 3 $ par mois et par utilisateur (≈ 0,60 $ si ces lectures comptent comme « lectures de ses propres données » à 0,001 $ ; on ne sait pas laquelle des deux X applique). Un acteur Apify de scraping de X coûte ≈ 0,10 à 0,40 $ les 1 000 posts, soit ≈ 0,06 à 0,24 $ par mois et par utilisateur. Les vues, likes, réponses et reposts d'un post sont publics sur X : un scraper les lit à partir du **pseudo**, sans OAuth ni compte développeur X. Conséquences : on demande le pseudo X (sur l'écran Performance, ou dans les réglages) ; `fetchPostMetrics` de X devient un fournisseur interchangeable (variable d'environnement `X_METRICS_PROVIDER` = `apify` | `x_api`, sur le modèle de `BACKGROUND_REMOVAL_PROVIDER`), l'API officielle restant en repli ; jeton Apify dans `APIFY_TOKEN`.
- **Cadence d'Apify : une lecture par utilisateur et par 6 h** (la spec disait 24 h pour l'API payante ; pour Apify le coût est négligeable, la limite sert à ne pas lancer un scrape à chaque rechargement). Le droit de lire est **pris avant l'appel** par un `UPDATE … WHERE x_last_read_at < now() - 6 h` atomique sur `creator_profiles.x_last_read_at` (migration `0053`) : deux requêtes simultanées, un appel qui échoue et un redémarrage comptent tous. Après un échec, le prochain essai revient au bout d'1 h. Changer de pseudo remet le compteur à zéro. La route de rafraîchissement est limitée à 6 appels par minute et par utilisateur.
- **Un pseudo n'est pas prouvé** : rien n'empêche de saisir celui d'un autre. Les garde-fous : les posts sont cherchés et rattachés **parmi les scripts de l'utilisateur seulement**, l'unicité des candidats est `(user, réseau, post)` (un post pris par un pseudo usurpé ne se cache pas à son vrai auteur), et un chiffre énorme ou illisible venant d'Apify est plafonné ou écarté, sans arrêter les autres posts.
- **Risques de ce choix** : acteurs maintenus par des tiers (ils cassent quand X change), conditions d'utilisation de X qui interdisent le scraping (X a perdu contre Bright Data en 2024 devant un tribunal de district américain, pour des données publiques ; décision de première instance, suite non vérifiée). D'où le repli et l'essai préalable (lot 2).
- **LinkedIn n'a pas d'équivalent** : un scraper ne voit pas les impressions (visibles de l'auteur connecté seulement, à notre connaissance) et ceux qui utilisent les cookies du compte exposent le compte de l'utilisateur à une suspension. LinkedIn reste sur l'API officielle.
- **À corriger avant d'activer LinkedIn** : `src/lib/social/linkedin.ts` envoie `LinkedIn-Version: 202401` (lignes 69 et 99) alors que `memberCreatorPostAnalytics` n'existe qu'à partir de 202506 et que 202510 est retirée le 2026-10-15. Passer à une version récente (202606) et revérifier la réponse avec un vrai accès.
- **Rattachement** : l'heuristique date + légende (`postMatchingService`) pré-remplit, une confirmation fixe le lien. **Changement 1** : le lien est posé sans demander seulement si **tout** concorde (D4) — score ≥ 0,8, au moins 0,2 devant le second script, date ≥ 0,8 **et** légende ≥ 0,6 — parce qu'**un lien ne se défait pas** (il n'y a pas de « délier » dans cette version) ; sinon confirmation. Un script déjà lié à un autre post n'est jamais relié (409).
- **`Posted`** : **Changement 2** — c'est le moment que le Lot « statuts » de `SPEC_APP_DESIGN_TELLOVO.md` (E14) attendait. Quand un script est rattaché à un post réel, il passe à `published` (affiché **Posted**), avec `published_at`. Seul le back-end l'écrit ; aucun écran ne le pose à la main.
- **Connexion depuis l'écran** : `PUT /api/performance/x-handle` `{ handle }` enregistre (ou, vide, efface) `creator_profiles.x_handle` ; l'OAuth de LinkedIn passe par `/api/auth/linkedin/connect?returnTo=/performance` (le chemin de retour est maintenant limité à un chemin du site : `//hôte` et `https://hôte` sont refusés). LinkedIn reste en OAuth (décision du fondateur le 2026-10-19) ; une connexion par pseudo n'a pas été retenue : un scraper ne voit pas les impressions.
- **Candidats en attente** : l'écran ne leur consacre pas de section. S'il y en a, une ligne discrète au-dessus du héros (« 2 posts detected — confirm » → feuille de confirmation). Sans candidat, rien ne s'affiche.
- **La semaine d'ouverture** est la dernière qui a des posts (un lundi matin la semaine en cours est vide) ; sans aucun post, la semaine en cours.
- **Saisie manuelle** (`PUT /api/scripts/:id/metrics`) : l'API reste (utile à l'agent et en repli), l'écran ne l'expose pas dans cette itération (D3).

## 5. API

Un seul endpoint de lecture, pour que l'écran se rende en un appel :

`GET /api/performance/overview` — sans paramètre : la fenêtre est toujours les quatre dernières semaines, la semaine choisie se gère côté client

```
{
  weeks: [{ start, posts, impressions, likes, comments, shares,
            byNetwork: { linkedin: {impressions,…}, x: {impressions,…} } }],   // 4 entrées, de la plus ancienne à la plus récente
  posts: [{ key, publishedAt, weekStart, title,
            linkedin: { impressions, likes, comments, shares } | null,
            x:        { impressions, likes, comments, shares } | null }],
  medianImpressions: number | null,        // null sous 5 posts
  connections: { linkedin: State, x: State },   // State : ok | needs_reconnect | not_connected | needs_handle
  xMethod: "handle" | "oauth",             // comment X se connecte : un pseudo (Apify) ou OAuth (API X)
  pendingCandidates: number
}
```

Les écarts, le meilleur post et les phrases du titre sont **calculés côté client** à partir de ce JSON (fonctions pures, testées), pour que changer de semaine ne refasse aucun appel.

## 6. États qui ne sont pas « tout va bien »

Le blocage d'accès LinkedIn (validation « Community Management API », pas self-serve) et la facturation X rendront l'écran vide ou partiel pendant un moment : c'est le cas courant du début, pas une exception.

| Situation | Affichage |
| :--- | :--- |
| Aucun réseau connecté, aucun post | Carte au centre : « Connect a network to see how your posts do », avec les deux choix **sur la page** — LinkedIn ouvre sa connexion (OAuth, retour sur Performance), X demande le pseudo dans un champ |
| Un réseau connecté, pas encore de données | La page garde sa vraie forme (héros, meilleur post, liste, graphique) avec des **tirets « — »** à la place des chiffres, « Your numbers will appear here. » et « Looking for your posts… » pendant la lecture, puis « No post spotted yet — … » |
| Réseaux restant à connecter | En haut à droite, à la hauteur du titre : « Still to connect » + les logos des réseaux restants ; LinkedIn ouvre l'OAuth, X ouvre un petit panneau pour le pseudo ; disparaît quand les deux sont connectés. Un réseau expiré y apparaît comme « Reconnect … » |
| Réseau connecté mais sans accès aux statistiques (LinkedIn en attente, X non facturé) | Colonne de ce réseau : « Stats not available yet », sans chiffre ni barre ; l'autre réseau s'affiche normalement ; les totaux sont ceux du réseau disponible, **annoncés comme tels** |
| Connexion expirée | Bandeau existant (« Connection expired for … — reconnect from settings ») |
| Premiers jours : posts publiés, chiffres pas encore remontés | « Collecting your first numbers… » à la place du héros |
| Une seule semaine de données | Héros sans pastille d'écart, graphique à une barre |
| Moins de 5 posts | Pas de « × ta portée habituelle » |

Même sans accès LinkedIn, l'écran doit rester utile avec X seul, et inversement.

## 7. Implémentation

- `src/app/(app)/performance/page.tsx` : mince, charge `PerformanceScreen`.
- `src/components/app/PerformanceScreen.tsx` : l'écran. Styles dans `app-extra.css` sous `.ap`, préfixe `pf-` (le HTML/CSS de la maquette en est la base, à porter tel quel).
- `src/lib/performance/overview.ts` : construction du JSON de §5 (serveur) ; `src/lib/performance/derive.ts` : écarts, meilleur post, phrases du titre (pur, côté client).
- `src/lib/services/postMetricsFetchService.ts` : conserver `publishedAt` ; rattachement automatique au-dessus du seuil ; passage du script à `published`.
- Retrait de la section « Suggested rebalancing » de l'ancien écran (plus rien ne la génère depuis `SPEC_RYTHME_DES_SERIES.md`).
- Tests Vitest : `derive.ts` (écarts, médiane, semaine sans post, première semaine, moins de 5 posts), regroupement par semaine (lundi → dimanche, fuseau), rattachement automatique.

### Lots

| Lot | Contenu | Vérification |
| :--- | :--- | :--- |
| 0 | **Fait le 2026-10-19** : migration `0051` (`published_at`, appliquée en dev), `src/lib/performance/derive.ts` + 19 tests, `overview.ts`, route `GET /api/performance/overview`, `publishedAt` conservé à la récupération et à la confirmation | `npm run test` (547 verts hors `.claude/worktrees`), requête vérifiée en base de dev avec des lignes temporaires, retirées |
| 1 | **Fait** : `PerformanceScreen` (portée de la maquette), `NetworkLogo`, icônes cœur/bulle/boucle/œil/étoile dans `AppIcon`, styles `pf-*` dans `app-extra.css`, états vides de §6 | capture de l'écran réel (1440 px et 420 px) comparée à la maquette |
| 2 | **Fait, sauf l'essai réel** : `Posted` + rattachement automatique + ligne « posts detected » ; **fournisseur Apify pour X** (essai avec le crédit gratuit sur un acteur et un vrai compte : renvoie-t-il les **vues** par post, est-il stable et maintenu ?) ; pseudo X dans les réglages ; version LinkedIn corrigée | un post réel rattaché passe en Posted ; chiffres X réels via Apify |
| 3 | **Fait** : documentation : `PRODUCT.md`, `TECH.md`, `DEVLOG.md`, ligne dans `CLAUDE.md` | — |

## 8. Hors périmètre

Filtre par réseau ou par période, export, comparaison de séries ou de rôles, heures de publication, croissance de followers, tableau de saisie manuelle dans l'écran, toute recommandation affichée à l'utilisateur.

## 9. Pour plus tard : l'agent lit les performances

Le fondateur l'a dit : l'écran affiche d'abord ; ces chiffres serviront ensuite à montrer à l'agent qui écrit et à celui qui planifie quels posts ont marché et lesquels non. Ce que cette spec prépare pour ça, sans le construire : `published_at`, les valeurs par réseau, et la médiane (= le critère « a marché / n'a pas marché », à réutiliser tel quel pour ne pas avoir deux définitions). `buildPerformanceSummary` (qui n'injecte aujourd'hui que le taux d'engagement par catégorie, et seulement à partir de 3 scripts) sera à reprendre alors ; ne pas le toucher dans ce chantier.

---

## 10. Points tranchés (2026-10-19)

| # | Question | Décision |
| :--- | :--- | :--- |
| D1 | **LinkedIn est bloqué** (validation de la Community Management API). Que livre-t-on sans l'accès ? | Tout construire et tester sur données de dev ; **X réel via Apify** ; LinkedIn s'allume à l'obtention de l'accès. Pas de repli manuel dans l'écran (D3). |
| D2 | **Coût X.** | Apify (§4) : ≈ 12 à 50 fois moins cher que l'API officielle ; au plus une relecture par 24 h ; ne relire que les posts rattachés quand le fournisseur le permet. |
| D3 | **Saisie manuelle** dans l'écran ? | Non : elle recrée la corvée que l'automatique supprime. L'API reste. |
| D4 | **Rattachement automatique** au-dessus d'un score élevé ? | Oui ; seuil à fixer sur de vrais cas ; confirmation seulement en dessous. |
| D5 | **Posts publiés hors de l'app** ? | Non comptés : seuls les posts rattachés à un script. |
| D6 | **Semaine en cours moins mûre** que la précédente. | Écart affiché tel quel ; à reconsidérer si le « +48 % » trompe en usage réel. |

D3 à D6 reprennent les recommandations de la première version de cette spec, que le fondateur a validée en disant de commencer.

---

## 11. Journal des décisions

| # | Décision | Pourquoi | Alternative écartée |
| :--- | :--- | :--- | :--- |
| 1 | **Partir d'une maquette HTML** sur le compte MyKiné avant tout code | Voir l'écran avant de décider de ce qu'il faut stocker ; la maquette a changé quatre fois | Spécifier les données d'abord |
| 2 | Pas de sélecteur 7 j / 14 j / 30 j ; **un mois, parcouru semaine par semaine** | La semaine est l'unité de tout le produit (écran « Your content week », quota en semaines) | Période libre |
| 3 | **LinkedIn et X toujours ensemble**, pas de filtre | On y voit les deux d'un coup, et la décision « quel réseau » se lit sans cliquer | Filtre Tous / LinkedIn / X |
| 4 | Données de démo qui **progressent** | La première maquette baissait d'une semaine à l'autre : le pire exemple pour juger l'écran | — |
| 5 | **Hiérarchie à trois niveaux**, un chiffre héros | Trois maquettes où tout avait la même taille : « je me perds dans ce que je dois regarder ». Sources : Carbon (le plus important = le plus grand et le plus contrasté, en haut à gauche), Stephen Few (un écran, d'abord l'aperçu), skill dataviz (un seul héros, emphase) | Grille de cartes égales ; tableau dense sans cartes |
| 6 | **Quelques boîtes**, pas aucune | Version « sans cadres » : « aucune notion d'importance ». Les cartes servent à marquer le niveau 1 et à rester dans le langage de l'app | Tout à plat |
| 7 | **Un seul graphique : quatre barres par semaine**, semaine choisie en accent | C'est la tendance du mois, et c'est aussi la navigation. Le graphique à 12 colonnes (une par post) faisait doublon avec la liste | Une colonne par post ; courbe |
| 8 | **Carte « Best post »** | Seul endroit de l'app qui répond à « qu'est-ce qui a marché » ; c'est aussi le critère que l'agent reprendra (§9) | Badge « Top » dans la liste seulement |
| 9 | « Best post » **seulement sur la semaine choisie** | Une étiquette sur chaque semaine noie celle qui compte | Une étiquette par semaine |
| 10 | **Icônes en trait**, pas d'emojis ; logos LinkedIn et X en en-têtes | Cohérence avec `AppIcon` ; les logos remplacent « LinkedIn · impressions », redondant avec le titre | Emojis (essayés, refusés) ; texte |
| 11 | Date en **carré** (jour en gros, jour de la semaine dessous) | Se balaie plus vite qu'« Mon 12 Oct » | Date en texte |
| 12 | **Pas de totaux à côté des semaines** (barre collante, titres de semaine) | Déjà dans le héros ; c'était une redite | Total par semaine |
| 13 | Pas de bandeau « Maquette » ni de ligne sous la barre collante | Retour du fondateur : bruit visuel | — |
| 14 | **Pas de compteur de jours** (« Day 3 of 7 », croissance J+1/J+7) | « Ne sert à rien » : l'écran est par semaine. Les snapshots restent en base | Croissance par post à J+1/J+3/J+7 |
| 15 | `Posted` posé par le rattachement | Promesse de E14 (`SPEC_APP_DESIGN_TELLOVO.md`) restée en suspens | Bouton « Mark as posted » |
| 16 | **X via Apify**, API officielle en repli | ≈ 12 à 50 fois moins cher, et supprime le compte de facturation X et l'OAuth X pour les métriques. Les vues d'un post sont publiques | API officielle seule ; saisie manuelle |
| 17 | **LinkedIn reste sur l'API officielle** | Un scraper ne voit pas les impressions, et les acteurs à cookies exposent le compte de l'utilisateur | Scraper LinkedIn |
| 18 | Version `LinkedIn-Version` à corriger (lot 2) | `202401` n'a pas l'API des statistiques de posts | — |
| 23 | **Pas d'écart sur une semaine sans chiffres, et « Wait N days » sur une semaine trop jeune** | Le fondateur, un lundi à 00:58 : « je suis à 0 et −100 % ». Compter avant que les vues soient arrivées ne dit rien ; la pastille dit combien de temps attendre | Corriger l'écart par la maturité des posts ; ne rien afficher |

## 12. Idées (rien de décidé, rien à construire)

- **Typefully** (nom à confirmer avec le fondateur) : outil d'écriture et de statistiques pour X et LinkedIn. À regarder plus tard comme source possible de métriques ou comme référence d'écran. Aucun travail dans ce chantier.
| 19 | **Revue à froid, puis corrections** (2026-10-19) | Cinq points « importants » : lecture des posts par `platformPostId` sans filtre utilisateur et unicité des candidats globale (un pseudo usurpé cachait ses posts à leur vrai auteur) ; contrôle de fréquence d'Apify en mémoire, posé après l'appel ; un nombre énorme faisait échouer toute la lecture ; rattachements concurrents ; rattachement automatique irréversible au seuil non calibré | Garder tel quel |
| 20 | **Se connecter depuis l'écran Performance**, pas depuis les réglages | Le fondateur : « je connecte mon premier réseau » sur la page même. Logos des réseaux restants en haut à droite, panneau de pseudo pour X, OAuth pour LinkedIn | Bouton « Open settings » |
| 21 | Page à tirets quand un réseau est connecté mais vide | La page doit montrer sa forme dès la connexion, pas une carte d'attente | Carte « Collecting… » seule |
| 22 | **LinkedIn reste en OAuth**, pas de pseudo | Un scraper ne voit pas les impressions, le chiffre principal de l'écran | Pseudo LinkedIn via Apify ; les deux |

## 13. Limites connues (notées le 2026-10-19, rien à faire pour l'instant)

À savoir en lisant les chiffres ou avant d'étendre l'écran. Le fondateur a dit de les noter sans les traiter.

- **Semaines en UTC.** Lundi à dimanche, en UTC, comme le reste de l'app (`weekPosts.ts`). Un post publié le lundi 00:30 à Paris tombe dans la semaine d'avant ; l'écran change de semaine à 02:00 heure de Paris l'été, 01:00 l'hiver. Pas de bug d'heure d'été (tout est en millisecondes UTC). À reprendre le jour où on gère un fuseau par utilisateur.
- **Pas de « délier ».** Un post rattaché à un script le reste : aucun chemin pour défaire un lien (faux positif du rattachement automatique, ou confirmation faite par erreur). Le rattachement automatique a donc été resserré (date **et** légende) plutôt que d'ajouter un « Not this one ».
- **Le pseudo X n'est pas prouvé.** On peut saisir celui d'un autre : les chiffres lus sont publics et ne sont rattachés qu'aux scripts de la personne qui l'a saisi, donc le tort reste dans son propre compte. Prouver un pseudo demanderait l'OAuth de X.
- **Apify jamais essayé pour de vrai.** Le fournisseur suppose les noms de champs de l'acteur (`viewCount`, `likeCount`, `replyCount`, `retweetCount`, `author.userName`) ; un item sans champ auteur est accepté sans vérifier que c'est le bon compte ; l'acteur par défaut (`apidojo/tweet-scraper`) n'a pas été vérifié (prix, entrée `twitterHandles`, maintenance). À vérifier au premier essai réel, avec le crédit gratuit.
- **LinkedIn : accès non obtenu** (Community Management API, validation de LinkedIn) ; la version d'API `202606` n'est pas vérifiée contre une vraie réponse.
- **La semaine en cours est moins mûre** que la précédente (D6) : un « +48 % » compare deux maturités différentes.
- **Tests.** Pas de test des chemins qui touchent la base (`overview.ts`, `postMetricsFetchService.ts`, `postLinkService.ts`, la résolution d'un candidat) : le dépôt n'a pas de base de test ; ils ont été vérifiés à la main sur la base de dev.
- **Défilement.** La bande de détection de la semaine (`IntersectionObserver`) est étroite : un défilement très rapide peut laisser la semaine précédente active jusqu'au prochain arrêt.
- **Données de démo.** `scripts/seed-performance-demo.ts` pose les 9 posts sur les trois semaines avant celle-ci : elles vieillissent d'une semaine à chaque lundi (UTC). Relancer le script les rafraîchit ; `--remove` remet les scripts LinkedIn en brouillon, sans restaurer leur statut d'origine s'il était autre.
- **Dates des captures.** Les images de `docs/tests/performance-screens/` pour les états sans données utilisent des semaines fabriquées (19 octobre) ; seule celle « avec données » vient de la base.
