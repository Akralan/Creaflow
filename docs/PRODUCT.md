# VISION PRODUIT — CREAFLOW

> Remplace `BRIEF.md` (cadrage produit initial, phase POC) comme référence à jour sur le périmètre fonctionnel. `BRIEF.md` reste dans le repo comme archive historique du cadrage d'origine — ne pas le mettre à jour, c'est ce document-ci qui reflète l'état actuel.

**Plateforme d'Assistance Créative & Planification Social Media pour Créateurs & Entreprises**

---

## 1. Vision & Positionnement

### 1.1 Constat & Problématique
Les indépendants, fondateurs, créateurs et gérants de petites structures qui veulent exister sur les réseaux sociaux font face à un défi majeur :
- **Manque de temps et de compétences marketing :** ils savent produire leur activité, mais ne savent pas comment la promouvoir efficacement sur les réseaux sociaux.
- **Syndrome de la page blanche :** difficulté à trouver des idées régulières et adaptées aux codes des plateformes actuelles (LinkedIn, Instagram, X...).
- **Matière vécue jamais publiée :** beaucoup accumulent déjà de la matière (notes de projet, specs, journal de bord, décisions, chiffres) sans jamais la transformer en contenu, faute de temps ou de réflexe.
- **Complexité de l'IA brute :** utiliser ChatGPT ou Claude en direct demande une maîtrise du *prompt engineering* que la majorité des utilisateurs n'ont pas.
- **Répétition des idées :** sans mémoire des contenus déjà produits, un créateur qui génère seul ses idées (ou via une IA sans contexte) finit par reproposer les mêmes angles.
- **Invention d'informations :** au-delà de la répétition, un générateur nourri d'une simple description produit n'a que deux options — rester générique ou inventer des détails plausibles. Diagnostiqué sur un premier usage réel (`docs/SPEC_MATIERE_EDITEUR.md` §1.1) : sans matière factuelle en entrée, le script échoue sur sa promesse centrale avant même la question de l'habitude d'usage.

### 1.2 La Solution
Une application web centralisée qui agit comme un **rédacteur en chef IA** : elle n'écrit qu'à partir de ce que l'utilisateur lui a réellement confié, et garantit la variation des angles côté produit. Elle collecte l'identité et l'historique du créateur via une conversation guidée, propose et fait évoluer sa direction éditoriale (séries récurrentes, rôles éditoriaux, angles), transforme la matière factuelle de chaque sujet en contenus prêts à publier — sans jamais inventer une information non fournie — et organise la diffusion via un calendrier intelligent qui varie délibérément les angles pour éviter la répétition.

Le profil créateur et la génération de contenu s'adaptent à toute activité — personal branding, projets personnels documentés, freelance, marque de service, artisanat — sans supposer vente de produit.

Le produit ne fait **plus de vidéo** depuis le 2026-10-16 (`docs/SPEC_ONBOARDING_MVP.md` §1 et §6) : plus de script vidéo, plus de TikTok ni de YouTube. Restent le post visuel (image, carrousel, animation exportée en MP4) et le post texte.

---

## 2. Cible & Périmètre actuels

### 2.1 Cible

Le produit sert toute personne voulant publier régulièrement sur les réseaux sociaux ; ce qui distingue la cible prioritaire de la cible secondaire, c'est **d'où vient la matière** — toute la valeur du produit (ne jamais inventer, ne jamais répéter) dépend du corpus, voir Module B.

**Cible prioritaire — ceux qui ont déjà de la matière écrite :**
- Freelances et indépendants en personal branding (développeurs, consultants, coachs...)
- Fondateurs et porteurs de projets qui documentent leur travail (« build in public ») : notes, specs, journal de bord, décisions
- Créateurs et experts qui tiennent des notes ou ont un historique de publications

Pour eux, le corpus se remplit en quelques secondes par collage de fichiers existants (`docs/SPEC_MATIERE_EDITEUR.md`) : la matière est là, elle n'est simplement jamais transformée en contenu. C'est l'usage validé à date (usage réel du fondateur sur son personal branding et le storytelling de trois projets personnels), et celui à partir duquel le produit est conçu et priorisé.

**Cible secondaire — ceux qui n'écrivent pas :**
- Artisans créateurs (bijoux, décoration, bougies, etc.), boutiques de personnalisation, marques indépendantes
- Petits commerces locaux et prestataires de service

Pour eux, la matière est dans la tête et les conversations, pas sur le disque : le corpus se construit par l'**interview-chat** (Module A). Cible d'origine du cadrage (`BRIEF.md`), servie par le produit mais **non validée en usage réel** — l'hypothèse ouverte est qu'ils nourrissent le corpus assez régulièrement pour que la génération tienne sa promesse.

### 2.2 Réseaux sociaux couverts
Registre de plateformes extensible côté code (`src/lib/social/types.ts`) ; à date :
- **Depuis le 2026-10-18, l'application ne connaît que LinkedIn et X** (`docs/SPEC_APP_DESIGN_TELLOVO.md` E1) : Instagram, newsletter, blog, Slack et « autre » ont été retirés des réglages, des sélecteurs et du calendrier (les données existantes restent en base, plus affichées). **Chaque post est écrit pour les deux réseaux**, un texte différent par réseau, sur le même événement (E2). Le registre ci-dessous est l'historique d'avant ce choix.
- **Avec connexion OAuth** (analyse de la "patte" de marque à partir des posts récents, et pour Instagram récupération automatique des métriques de performance — voir Module D) : Instagram, LinkedIn, X (Twitter). TikTok et YouTube ont été retirés avec la vidéo le 2026-10-16 (`docs/SPEC_ONBOARDING_MVP.md` §6).
  - Les chiffres de X passent par **Apify** (pas de compte de facturation X à ouvrir) ; LinkedIn reste bloqué par une validation d'accès externe (Community Management API) — il fonctionne en connexion de compte, pas encore en récupération de chiffres réelle.
- **Suivies sans OAuth** (calendrier, contenu généré manuellement, métriques saisies à la main) : Newsletter, Blog / site perso, Slack, Autre.

### 2.3 Modules livrés
- **Module A** — Onboarding & Profiling : un seul parcours en six écrans (`docs/SPEC_ONBOARDING_MVP.md`), où l'on branche sa matière (GitHub, Notion, Linear ou notes collées) et où l'on corrige ce que la machine en a compris — plus de chat.
- **Module B** — Moteur d'Idées & Scripts, avec système anti-répétition par angles.
- **Module D** — Calendrier Intelligent, mix éditorial personnalisé par IA.
- **Module E** — Direction éditoriale & Assistant IA conversationnel *(ajouté en cours de route, non prévu au cadrage initial)*.

### 2.4 Module hors périmètre
**Module C** — La Matrice de Recyclage de Contenu ("Killer Feature") : découpage automatique multi-formats à partir d'un seul tournage. Jamais implémentée, **abandonnée avec la vidéo** le 2026-10-16 (`docs/SPEC_ONBOARDING_MVP.md`).

---

## 3. Parcours Utilisateur & Fonctionnalités

```
[ Onboarding : brancher sa matière ] ➔ [ Direction éditoriale IA ] ➔ [ Générateur de Scripts ] ➔ [ Calendrier Intelligent ]
                                            ▲
                                            │
                                  [ Assistant éditorial (chat) ]
```

### Module A : Onboarding & Profiling d'Activité

**Un seul parcours, et tout ce qu'on demande est une chose à faire** (`docs/SPEC_ONBOARDING_MVP.md`). Ce que la personne fait se lit dans sa matière ; son ton s'apprend à ses retouches. Ni ton, ni valeurs, ni matériel, ni temps disponible ne sont plus demandés, et il n'y a plus de chat d'onboarding. Six écrans :

1. **Démarrer** — c'est aussi l'inscription, la cible de « Démarrer gratuitement » : « Comment tu t'appelles ? », puis quatre portes au même rang, **GitHub · Notion · Linear · Coller mes notes**. Les trois premières créent (ou retrouvent) le compte par OAuth ; l'email et le mot de passe ne sont demandés que pour « Coller mes notes ». `/login` ne sert plus qu'à revenir.
2. **Ce qu'on lit** — pour chaque porte branchée, le choix des dépôts, pages ou projets (les plus récents déjà cochés) ; une grande zone de texte pour les notes. Les portes non branchées restent proposées : un compte branche GitHub, Notion et Linear à la fois, **quel que soit l'email de chaque compte tiers** (une fois connecté, le compte tiers se rattache au compte CreaFlow ouvert). Jusqu'à 15 sources pendant l'onboarding.
3. **Lecture** — une animation pendant que la machine lit la matière et en déduit le profil, en un seul appel.
4. **Ce que tu fais** — ce qu'on a compris, en champs éditables : ce que tu fais, pour qui (**audience visée**, éditable ensuite en paramètres, avec un override possible par sujet), et **tes sujets** (1 à 5), chacun avec ses sources regroupées — le même projet vu dans GitHub (ce qui a été construit), Notion (la réflexion, les décisions) et Linear (les tâches). Renommables, sources détachables vers un autre sujet.
5. **Qu'est-ce que tu attends de nous ?** — une zone de texte libre, facultative mais mise en avant ; elle oriente ensuite toutes les générations.
6. **Tes jours de publication** — les sept jours de la semaine, mercredi et samedi cochés par défaut, au moins un ; et les réseaux où publier (LinkedIn coché par défaut, X, Instagram).

> **Mise à jour du 2026-10-18 — ce parcours n'est plus l'entrée.** La landing mène à `/start` (`docs/SPEC_ENTREE_PAR_LE_REPO.md`) : on colle le lien d'un **repo GitHub public**, l'IA remplit trois champs (*What you're building*, *Who it's for*, *The problem you solve*) que la personne vérifie, avec les trois jours (mercredi, vendredi, samedi cochés) ; elle donne son email, le compte est créé **sans mot de passe**, la génération part en fond (devlog, forme de la série, **un** post) et un email porte ce premier post et un lien de connexion (24 h). Au clic, les deux autres posts de la semaine s'écrivent. Les six écrans ci-dessus restent dans le code comme parcours de repli (`/onboarding`). Une case cochée = un post ce jour-là, sur chaque réseau actif.

« C'est parti » génère la **direction éditoriale** de départ (rôles éditoriaux, angles de script, séries récurrentes — voir Module E) et mène au calendrier. Plus d'écran de sélection des séries : elles se modifient ensuite dans Direction. Ce qui devient un sujet chez chaque plateforme est arbitré dans `docs/SPEC_CONNECTEURS_ET_SUJETS.md` ; détail technique en `docs/TECH.md` §4 et §8.

Les **sujets** s'appellent "produits" côté code/API — renommage purement visuel, `docs/SPEC_MATIERE_EDITEUR.md` §3.3. L'utilisateur peut aussi connecter ses comptes sociaux (Instagram/LinkedIn/X) via OAuth : la connexion déclenche automatiquement la récupération de publications récentes et une première analyse IA du style de communication (`style_profile`). Ce profil **apprend ensuite des corrections de l'utilisateur** : chaque script finalisé après retouche (ou écrit par lui) nourrit, sur proposition à valider, des règles de style impératives que le produit respecte partout où il rédige — génération, retouche de phrase, régénération de bloc (`docs/SPEC_APPRENTISSAGE_STYLE.md`).

**Alimenter le corpus d'un sujet :** deux portes pour nourrir la génération en matière factuelle (anecdotes, chiffres, décisions, retours...) — coller du texte ou un fichier `.md`/`.txt` pour qui écrit déjà (journal de bord, anciens posts), ou se faire **interviewer par le chat** (une question concrète à la fois) pour qui n'a rien d'écrit. Les deux alimentent le même corpus, structuré en arrière-plan en unités typées (anecdote / bug / chiffre / décision / learning) réutilisées par rotation à chaque génération — voir Module B.

### Module B : Le Moteur d'Idées & l'Éditeur de Script
Le moteur génère des fiches prêtes à l'emploi, **adaptées au type de contenu** (la vidéo a été retirée le 2026-10-16, `docs/SPEC_ONBOARDING_MVP.md`) :
- **Visuel** (image / carrousel / animation) : titre, accroche visuelle, découpage en slides, légende, hashtags.
- **Texte seul** (LinkedIn, newsletter, blog...) : titre, accroche (première phrase), corps de texte, hashtags optionnels.

Chaque génération est contrainte par :
- le **rôle éditorial** visé (`ContentCategory` côté données — personnalisé par IA, voir Module E),
- un **angle imposé automatiquement** par le système anti-répétition (invisible pour l'utilisateur mais déterminant pour la structure du script),
- la **série récurrente** le cas échéant (identité de format reconnaissable),
- l'**audience visée**, propre à chaque sujet (deux projets n'ont pas le même public) et décrite en un **portrait de 1 à 3 lecteurs** ; une série s'adresse à **un seul** de ces lecteurs (`docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md`), et pour les séries sans lecteur le rédacteur en chef choisit chaque jour,
- les **5 derniers posts du sujet**, pour ne pas répéter une accroche ni une fin,
- des **fiches d'inspiration** trouvées par une veille web sur ce qui marche pour ces lecteurs ; le rédacteur dit lesquelles l'ont servi et lesquelles ne serviront jamais (une fiche signalée deux fois inutile est écartée),
- le **corpus de matière factuelle** du sujet (unités structurées si le corpus a été traité, texte brut sinon) — base réelle de la génération, avec instruction explicite de ne jamais inventer une information non fournie (marqueur `[à compléter]` en son absence),
- les sujets déjà traités récemment et un résumé des performances récentes (métriques saisies manuellement), quand disponibles.

**Raconter un événement, pas décrire un système** (`docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md`, depuis le 2026-10-17) : la matière d'un sujet est lue en entier par un **lecteur d'événements** qui en tient une **ligne de temps** — ce qui s'est passé, quand, ce que ça a changé, pour qui, avec le passage qui le prouve — visible et corrigeable, où l'auteur ajoute lui-même « il s'est passé ça ». Une série choisit **un lecteur** parmi le portrait de son sujet et reçoit une **forme** écrite pour lui (ce qu'il vient chercher, de quoi est fait un bon épisode, ce qui le fait partir, ses mots), corrigeable. Son plan est la ligne de temps dans l'ordre. Le rédacteur reçoit alors un événement, ce lecteur et cette forme, relit la source, écrit un brouillon, le juge comme le lecteur et recommence avant de soumettre ; le code contrôle le post soumis. Une série sans lecteur reçoit d'office le public principal de son sujet ; le fonctionnement ci-dessous ne concerne plus que les posts libres.

**Le fil, pas seulement les épisodes** (`docs/SPEC_FIL_NARRATIF.md`) : une série qui n'enchaîne que des tranches ne dit jamais pourquoi le projet existe, où il va, ni où il en est. À certains moments, le système pose donc un **post de récit** à la place d'un épisode — un post d'**origine** (le problème avant la solution, sur le premier événement de la ligne de temps), un post de **vision** (où ça va, ancré sur une décision réelle), un **point d'étape** (ce qui a changé depuis le dernier), ou une **promesse tenue** (ce que l'auteur avait annoncé, puis l'événement qui y répond). Rien n'est inventé : chacun ne lit que des événements datés existants. L'auteur ne voit que des posts dans son calendrier — pas de réglage, pas de créneau spécial ; s'il n'en veut pas, il supprime, comme pour n'importe quel post. Et un point d'étape n'arrive pas à date fixe : il arrive **quand la matière le justifie**, sinon il n'arrive pas.

**Réfléchir avant d'écrire, puis être relu** (chemin V3, posts libres sans série seulement depuis le Lot 4) **:** le modèle remplit d'abord ses étapes de réflexion (le lecteur visé, les moments candidats de la matière, plusieurs accroches, le choix motivé), puis écrit le post et le relit lui-même. Le code vérifie ensuite ce qui se mesure (tournures interdites, longueurs par réseau, citations retrouvées dans la matière, trous, accroche déjà utilisée) et fait réécrire une fois en cas de faute (`docs/SPEC_PROMPT_GENERATION_V3.md`).

**Une idée, pas une paraphrase du brief :** avant de rédiger quoi que ce soit d'autre, le modèle formule en une ou deux phrases l'intention du post — l'idée unique, à qui elle s'adresse, ce qu'on doit en retenir ou faire. Cette intention (le "concept") est conservée avec le script, gelée dès la génération : les micro-retouches et régénérations de bloc s'y tiennent, sans jamais la réécrire.

**Anti-répétition :** l'application maintient une bibliothèque d'angles/archétypes de hook par utilisateur (générée par IA à l'onboarding, ex : "question choc", "avant/après", "témoignage", "tutoriel"...). À chaque génération, le système impose automatiquement l'angle le moins récemment utilisé dans le rôle visé — l'utilisateur n'a rien à choisir, la variation est garantie côté produit plutôt que laissée au hasard du LLM. La même logique de rotation (least-recently-used) s'applique à la sélection des unités de matière injectées, avec deux overrides manuels : épingler ("à placer absolument") et exclure ("jamais dans un post").

**Le script est une surface de travail, pas un artefact figé.** Générer, coller un texte déjà écrit ailleurs, taper à la main et retoucher par IA sont le même geste : le script peut naître d'une génération complète, d'un import (`docs/SPEC_MATIERE_EDITEUR.md` §2), ou directement dans l'éditeur au premier caractère tapé sur un créneau vide (naissance paresseuse). Une fois créé, chaque bloc est directement éditable ; sélectionner un passage et taper une instruction libre le retouche sans repasser par une régénération complète ; chaque bloc (accroche, slides, légende, hashtags) peut être régénéré individuellement plutôt que tout le script. Rôle, angle et série restent verrouillés depuis l'éditeur — la liberté est sur les mots, pas sur le brief.

**Quand l'intention elle-même ne va pas, pas seulement les mots :** « autre idée, même brief » régénère le script en entier, mais dirigé — brief intégralement verrouillé (y compris l'angle, jamais recalculé), et l'idée écartée est mémorisée pour que la proposition suivante ne la reformule pas simplement autrement. Un geste distinct des retouches de bloc dans l'éditeur (bouton séparé, confirmation systématique avant remplacement), pour marquer que c'est l'intention qu'on change, pas les mots.

**Générer une série depuis la matière** (ancien découpage en épisodes par le rédacteur en chef) : retiré le 2026-10-17 avec le chef (`docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md` Lot 4). Une série raconte désormais la ligne de temps de son sujet, dans l'ordre, à son lecteur.

**L'échelle de secours page blanche :** un jour sans idée n'est pas nécessairement un jour sans matière — la rotation choisit dans ce qui n'a pas encore été utilisé ; si le corpus du sujet est sec, l'interview-chat devient l'outil de la page blanche (extraire plutôt qu'inventer) ; le générateur de calendrier oriente aussi, en amont, les rôles gourmands en matière ("storytelling/coulisses") vers les jours où le corpus est fourni, et réserve les rôles qui tournent sans journal ("expertise/pédagogie") aux jours secs — sans jamais retoucher un calendrier déjà généré. Le filet ultime reste le même : ne jamais inventer une précision, marquer `[à compléter]`.

### Module C : La Matrice de Recyclage de Contenu — *Abandonné*
Jamais implémentée, abandonnée avec la vidéo. Voir §2.4.

### Module D : Le Calendrier Intelligent & Auto-Remplissage

> **Mise à jour du 2026-10-18 — l'application reprend le design de l'app de tellovo.ai** (`docs/SPEC_APP_DESIGN_TELLOVO.md`). Le calendrier de cartes et la page de détail d'un post sont remplacés par **« Your content week »** : les posts de la semaine à gauche, le post ouvert à droite (onglets LinkedIn / X, retouche par l'IA en trois puces et un champ libre, copier, source, « Mark as ready »), avec **« Content plan »** (quatre semaines) et **« Business context »** (les trois champs, les sources). Direction et Settings passent dans le menu du compte, l'assistant est caché, Performance reste sous Business context. **Statuts : Draft, Ready, Posted** (Posted n'est posé que par le back-end, plus tard). **L'essai gratuit offre une semaine de contenu, à vie** ; **« Prepare next week »** écrit la semaine suivante. Le visuel d'un post se choisit **post par post** depuis la bulle d'outils (image, carrousel, animation), commun aux deux réseaux, sans réécrire le texte.
- **Chaque série a son rythme** (`docs/SPEC_RYTHME_DES_SERIES.md`) : ses jours de la semaine, chaque semaine ou une semaine sur deux. Le calendrier se remplit tout de suite et en continu, sur les quatre semaines qui viennent, un post par jour du rythme et par réseau actif de la série. Deux séries peuvent publier le même jour. Créer une série ou changer ses jours met le calendrier à jour aussitôt (« 8 posts ajoutés d'ici le 14 novembre »). Un jour peut être sauté depuis le calendrier sans toucher au rythme.
- **Jours où tu peux publier** (Paramètres, onboarding) : ils ne placent plus les posts ; ils sont répartis entre les séries en fin d'onboarding et proposés quand on crée une série.
- **Plus de posts libres générés :** tout créneau automatique appartient à une série. Un post ponctuel se place à la main (script placé sur une date, import).
- **Une ligne par série :** avec plusieurs séries, le calendrier montre chaque série sur sa ligne, l'une sous l'autre, ses posts de gauche à droite, avec au moins son prochain post même au-delà de la semaine. Avec une seule série, une seule bande.
- **Cycle du créneau :** l'utilisateur déclenche la génération du script depuis le créneau. Script et créneau ont chacun un statut, modifiable manuellement pour suivre l'avancement.
- **Suivi de performance :** l'écran **« Performance »** (`docs/SPEC_PERFORMANCE.md`, 2026-10-19) montre le dernier mois de posts LinkedIn et X, une semaine à la fois : le chiffre de la semaine (impressions) avec son écart sur la semaine d'avant, le meilleur post, les likes/commentaires/partages, puis la liste des posts avec les deux réseaux côte à côte. Il affiche seulement — l'usage de ces chiffres par l'agent qui écrit et qui planifie vient ensuite. On connecte son premier réseau **directement depuis l'écran** (LinkedIn par sa connexion, X en donnant son pseudo) ; tant qu'il n'y a pas de données la page montre sa forme avec des tirets. Les chiffres viennent du réseau, sans saisie : **X est lu par Apify** à partir du pseudo saisi dans les réglages (sans connexion OAuth de X), **LinkedIn par l'API officielle** dès que l'accès « Community Management API » est accordé. Un post repéré qui ressemble sans ambiguïté à un script est rattaché tout seul et passe en **Posted** ; sinon l'écran demande une confirmation. Historique daté conservé (`PostMetricsSnapshot`), réinjecté en résumé dans les générations suivantes.
- **Rééquilibrage éditorial automatique — suspendu :** il ajustait le poids des rôles d'après les métriques, mais ce poids ne choisissait que le rôle des posts libres, qui ne sont plus générés. La suite prévue est de proposer un changement de rythme de série (« le devlog marche deux fois mieux : passer à deux jours ? »), un chantier à venir.
- **Rappels & Notifications :** non implémentés à ce stade.

### Module E : Direction éditoriale & Assistant IA — *ajouté au périmètre, non prévu au cadrage initial*
- **Écran "Direction" :** la **série est le seul objet éditorial manipulé** (`docs/SPEC_SERIES_ET_ROLES.md`) — création, identité, poids, ciblage par plateforme, sujet lié, mode, régénération par IA. Chaque série sert **exactement un rôle éditorial** (pourquoi le post existe : expertise, coulisses, preuve sociale…) ; un créneau sans série est un **post libre** qui ne porte qu'un rôle. Le mix des rôles s'affiche en lecture seule sur cet écran ; son édition complète (libellé, consigne, poids, gourmandise en matière) vit dans Paramètres › Avancé, parce que ce poids est surtout piloté par les performances réelles.
- **Pour qui on écrit :** chaque série a un lecteur unique, choisi parmi les publics de son sujet, et sa forme écrite pour lui ; le détail de la série montre les prochains épisodes tirés de la ligne de temps (`docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md`).
- **Le cadrage par choix (posture, voix, récit, signature) a été retiré** le 2026-10-17 : la forme de la série le remplace, avec une signature facultative, ce qui revient à chaque épisode.
- **Retirer une série** la sort aussi du calendrier à venir : ses posts déjà rédigés quittent le calendrier (le script reste dans les scripts) et ses jours de publication passent aux séries restantes.
- **Assistant éditorial (chat) — un rédacteur en chef assistant :** conversation libre pour faire évoluer sujets, séries, rôles, angles, réseaux actifs, jours de publication, **matière première** et **audience de marque** (`docs/SPEC_ASSISTANT_AGENTIQUE.md`).
  - **Il lit tout l'espace de travail** pour argumenter : la matière du créateur, ses scripts, son calendrier, ses performances réelles, son profil. Un rédacteur en chef qui conseille sans avoir lu ce qui est publié ni ce qui est planifié ne sert à rien.
  - **Il ne touche ni aux scripts ni au calendrier.** Les mots et le planning restent la main du créateur ; l'assistant tient le brief. C'est une frontière de rôle, pas une limite technique.
  - **Il ne modifie jamais rien directement :** il formule des **propositions** — création, modification, ou archivage (jamais de suppression) — que l'utilisateur accepte, édite ou rejette une par une avant application.
  - **La matière entre par la conversation :** on peut **glisser un fichier** `.md`/`.txt` dans le chat, et l'assistant propose de le ranger dans le bon sujet (il n'en voit que le nom, jamais le contenu — s'il ne sait pas où le classer, il demande, et le rangement peut venir plusieurs messages plus tard). Quand le créateur raconte simplement une information exploitable — une actualité, une anecdote d'atelier, un chiffre — l'assistant propose de l'ajouter à sa matière : ce qui se dit en passant devient la matière des prochains contenus.
- **Rééquilibrage des rôles, proposé automatiquement :** même mécanisme de proposition que ci-dessus, mais généré par un calcul déterministe sur les métriques de performance plutôt que par le LLM (voir Module D) — la boucle "arbitrage basé sur la performance réelle" que le positionnement rédacteur en chef IA promet.

---

## 4. Feuille de Route Fonctionnelle

| Composante | État actuel | Prochaine étape |
| :--- | :--- | :--- |
| **Plateformes** | Instagram, LinkedIn, X (OAuth) + Newsletter, Blog, Slack, Autre (suivies manuellement) | Pinterest, Facebook, connexions OAuth supplémentaires ; débloquer les métriques LinkedIn/X (validation externe, compte de facturation) |
| **Génération de Contenu** | Posts visuels et textes, découpage en slides, légendes, hashtags, angles anti-répétition, séries récurrentes, **maquette du post visuel** composée automatiquement par l'agent en HTML à partir des **vraies photos** de la marque — montage multi-photos, produit **détouré** sur fond de marque, éléments d'interface (étiquette de prix, badge, bouton, cadres) — éditable à la main et par instruction, exportée en PNG (`docs/SPEC_DESIGN_HTML_SUR_IMAGE.md`, `docs/SPEC_COMPOSITION_VISUELLE.md` ; plus aucune image générée par IA) ; **format choisi à la génération** — image, carrousel de N slides, ou **animation** de 5 à 15 s dont les textes entrent et sortent, aperçu dans l'éditeur, export MP4 au clic (`docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md`) | Voix-off et musique sur les animations, coloration syntaxique des extraits de code, carrousel PDF pour LinkedIn |
| **Corpus & Éditeur** | Matière par sujet (collage/fichier/interview-chat), **dépôt GitHub connecté** (les `.md` et le journal de commits d'un dépôt public deviennent de la matière, resynchronisable), structuration en unités typées + rotation LRU, import de scripts écrits ailleurs, éditeur de blocs (édition directe, sélection→instruction, régénération par bloc), génération de série depuis la matière, concept d'intention gelé par script, "autre idée, même brief" (régénération complète dirigée), **style appris des corrections** (règles proposées à validation, éditables, injectées dans tous les gestes de rédaction) | Étendre les **sources de matière connectées** au-delà de git (dossier de notes synchronisé, Obsidian) ; dépôts privés ; proposition multi-voix au premier jet ; angles enrichis (squelette de hook + condition de réussite par angle, `docs/SPEC_PROMPT_GENERATION_TECH.md` §7) |
| **Diffusion / Planification** | Calendrier visuel, mix rôles/séries personnalisé par IA, statuts manuels, aiguillage matière×rôle (réoriente les rôles gourmands en matière un jour sec) | Rappels/notifications, auto-publication directe via API officielles |
| **Analytics** | Automatique (Instagram Creator) + saisie manuelle en complément (LinkedIn/X en attente de déblocage, Newsletter/Blog/Slack/Autre) ; historique daté par post | Dashboard Analytics agrégé, au-delà de l'écran "Performance" post par post |
| **Direction éditoriale** | Série = seul objet manipulé, avec un rôle unique ; rôles/angles/séries personnalisés par IA, assistant conversationnel à propositions, rééquilibrage des rôles proposé automatiquement à partir des métriques réelles | Étendre le rééquilibrage aux angles et aux séries |
| **Compte & conformité** | Essai gratuit sans carte puis Starter/Pro via Stripe ; mot de passe oublié par email (ferme les autres sessions) ; onglet « Compte » : changer de mot de passe, **exporter ses données** (JSON), **supprimer son compte** (résiliation Stripe immédiate, effacement complet) ; CGU/CGV, confidentialité et mentions légales alimentées par une identité d'éditeur centralisée (`docs/SPEC_LEGAL_EMAIL_RGPD.md`) | Renseigner l'identité de l'éditeur et le domaine d'envoi ; vérification d'email à l'inscription et changement d'adresse si des adresses invalides apparaissent |
| **Collaboration** | Compte solo créateur | Mode multi-utilisateurs / Assistant / Agence |
| **Module C (Recyclage)** | Abandonné avec la vidéo (2026-10-16) | — |

---

## 5. Orientations IA (résumé)

- **Moteur LLM :** provider pluggable sélectionné par variable d'environnement. **OpenAI est le seul provider opérationnel** ; les adaptateurs Gemini, Claude (Anthropic) et Groq existent dans le code mais ne sont pas utilisables en l'état. Gemini reste utilisé, indépendamment de ce choix, pour le captioning vision des photos. Le détourage des photos passe par un service externe derrière un adaptateur (Photoroom), optionnel.
- **Architecture de prompts :** prompts système modulaires par cas d'usage (génération de script, extraction du profil d'onboarding, chat assistant, analyse de style, suggestion de rôles/angles/séries), tous forcés en sortie JSON structurée via function/tool calling.

Le détail technique (stack, modèle de données, endpoints, architecture des prompts complète) est dans `TECH.md`.

---

## 6. Prochaines étapes

1. Valider la cible prioritaire (§2.1) avec quelques utilisateurs externes qui ont déjà de la matière écrite : mesurer s'ils remplissent le corpus sans accompagnement et à quel point le script généré est publié tel quel ou réécrit.
2. Étendre les sources de matière connectées au-delà du dépôt git déjà livré (dossier de notes, Obsidian, dépôts privés) pour supprimer le collage manuel chez le reste de la cible prioritaire.
3. Notifications/rappels de publication (Module D).
4. Dashboard analytics agrégé à partir des métriques désormais collectées automatiquement (Instagram) et manuellement (autres plateformes).
5. Débloquer la récupération automatique des métriques LinkedIn (validation Community Management API) et X (ouverture d'un compte de facturation).
6. Étendre le rééquilibrage automatique (aujourd'hui limité aux rôles) aux angles et aux séries récurrentes.
7. ~~Reprise du Module C~~ — abandonnée avec la vidéo (2026-10-16, `docs/SPEC_ONBOARDING_MVP.md`).
8. Auto-publication directe via API officielles (évolution long terme).
9. ~~Passe d'apprentissage `style_profile`~~ — livrée (`docs/SPEC_APPRENTISSAGE_STYLE.md`). Reste la proposition multi-voix au premier jet, à cadrer.
10. ~~Maquette du post visuel composée par l'agent~~ — livrée (`docs/SPEC_DESIGN_HTML_SUR_IMAGE.md`). Restent la coloration syntaxique des extraits de code, l'export PDF pour les carrousels LinkedIn et la vignette dans le calendrier.
11. ~~Format du post visuel (image, carrousel de N, animation)~~ — livré (`docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md`) : le format se choisit à la génération, l'animation est une slide dont les textes entrent et sortent sur 5 à 15 s, exportée en MP4 au clic. Restent le son et le repli pour les navigateurs sans WebCodecs.
12. ~~Composition visuelle à partir des vraies photos~~ — livrée (`docs/SPEC_COMPOSITION_VISUELLE.md`) : la génération d'image par IA est retirée ; la maquette se compose automatiquement après la génération du script, avec plusieurs photos, détourage et éléments d'interface. Restent la sélection automatique des photos par l'agent et un second adaptateur de détourage libre.
