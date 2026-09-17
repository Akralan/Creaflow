# VISION PRODUIT — CREAFLOW

> Remplace `BRIEF.md` (cadrage produit initial, phase POC) comme référence à jour sur le périmètre fonctionnel. `BRIEF.md` reste dans le repo comme archive historique du cadrage d'origine — ne pas le mettre à jour, c'est ce document-ci qui reflète l'état actuel.

**Plateforme d'Assistance Créative & Planification Social Media pour Créateurs & Entreprises**

---

## 1. Vision & Positionnement

### 1.1 Constat & Problématique
Les indépendants, fondateurs, créateurs et gérants de petites structures qui veulent exister sur les réseaux sociaux font face à un défi majeur :
- **Manque de temps et de compétences marketing :** ils savent produire leur activité, mais ne savent pas comment la promouvoir efficacement sur les réseaux sociaux.
- **Syndrome de la page blanche :** difficulté à trouver des idées régulières et adaptées aux codes des plateformes actuelles (TikTok, Instagram Reels, LinkedIn...).
- **Matière vécue jamais publiée :** beaucoup accumulent déjà de la matière (notes de projet, specs, journal de bord, décisions, chiffres) sans jamais la transformer en contenu, faute de temps ou de réflexe.
- **Complexité de l'IA brute :** utiliser ChatGPT ou Claude en direct demande une maîtrise du *prompt engineering* que la majorité des utilisateurs n'ont pas.
- **Répétition des idées :** sans mémoire des contenus déjà produits, un créateur qui génère seul ses idées (ou via une IA sans contexte) finit par reproposer les mêmes angles.
- **Invention d'informations :** au-delà de la répétition, un générateur nourri d'une simple description produit n'a que deux options — rester générique ou inventer des détails plausibles. Diagnostiqué sur un premier usage réel (`docs/SPEC_MATIERE_EDITEUR.md` §1.1) : sans matière factuelle en entrée, le script échoue sur sa promesse centrale avant même la question de l'habitude d'usage.

### 1.2 La Solution
Une application web centralisée qui agit comme un **rédacteur en chef IA** : elle n'écrit qu'à partir de ce que l'utilisateur lui a réellement confié, et garantit la variation des angles côté produit. Elle collecte l'identité et l'historique du créateur via une conversation guidée, propose et fait évoluer sa direction éditoriale (séries récurrentes, rôles éditoriaux, angles), transforme la matière factuelle de chaque sujet en contenus prêts à filmer ou publier — sans jamais inventer une information non fournie — et organise la diffusion via un calendrier intelligent qui varie délibérément les angles pour éviter la répétition.

Le profil créateur et la génération de contenu s'adaptent à toute activité — personal branding, projets personnels documentés, freelance, marque de service, artisanat — sans supposer vidéo ni vente de produit.

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
- **Avec connexion OAuth** (analyse de la "patte" de marque à partir des posts récents, et pour TikTok/YouTube/Instagram récupération automatique des métriques de performance — voir Module D) : TikTok, Instagram, LinkedIn, YouTube, X (Twitter).
  - Reclassement (`docs/SPEC_METRIQUES_AUTO.md` §8) : YouTube était sous-évaluée dans un classement précédent — Data API v3 gratuite, aucune notion de compte business. X est posée côté code mais bloquée par l'ouverture d'un compte de facturation (pay-per-use depuis février 2026), LinkedIn par une validation d'accès externe (Community Management API) — ces deux dernières fonctionnent en connexion de compte, pas encore en récupération de métriques réelle.
- **Suivies sans OAuth** (calendrier + objectifs de fréquence, contenu généré manuellement, métriques saisies à la main) : Newsletter, Blog / site perso, Slack, Autre.

### 2.3 Modules livrés
- **Module A** — Onboarding & Profiling, sous forme de chat conversationnel avec l'IA ; parcours « source d'abord » via connexion GitHub, Notion ou Linear (dépôts, pages et projets deviennent des sujets et alimentent le corpus).
- **Module B** — Moteur d'Idées & Scripts, avec système anti-répétition par angles.
- **Module D** — Calendrier Intelligent, mix éditorial personnalisé par IA.
- **Module E** — Direction éditoriale & Assistant IA conversationnel *(ajouté en cours de route, non prévu au cadrage initial)*.

### 2.4 Module hors périmètre
**Module C** — La Matrice de Recyclage de Contenu ("Killer Feature") : découpage automatique multi-formats à partir d'un seul tournage. Toujours non implémentée, repoussée après validation du parcours de base en usage réel.

---

## 3. Parcours Utilisateur & Fonctionnalités

```
[ Onboarding conversationnel ] ➔ [ Direction éditoriale IA ] ➔ [ Générateur de Scripts ] ➔ [ Calendrier Intelligent ]
                                            ▲
                                            │
                                  [ Assistant éditorial (chat) ]
```

### Module A : Onboarding & Profiling d'Activité

**Deux parcours, selon d'où vient la matière.** Qui crée son compte avec **GitHub**, **Notion** ou **Linear** choisit jusqu'à 5 sources qui deviennent ses sujets — un dépôt public, une page racine ou une base Notion, un projet Linear — dont le contenu entre directement dans le corpus : les `.md` et le journal de commits d'un dépôt, le texte d'une page et de ses sous-pages, la description d'un projet avec son journal d'updates et ses issues terminées. Il ne répond ensuite qu'à deux ou trois questions (ton, audience, temps disponible) : le reste est déduit de son profil et de ses sujets. Tout le monde d'autre suit le parcours conversationnel décrit ci-dessous, inchangé. Ce qui devient un sujet chez chaque plateforme est arbitré dans `docs/SPEC_CONNECTEURS_ET_SUJETS.md` ; détail technique en `docs/TECH.md` §8.

L'utilisateur configure son espace via un **chat conversationnel avec l'IA** (pas un formulaire classique) : l'assistant pose une question à la fois, adaptée à l'activité décrite, et en déduit progressivement :
- **Identité de marque :** nom, type d'activité, ton, valeurs.
- **Audience visée :** qui achète ou lit, ce qui l'intéresse, ce qu'il doit retenir de la marque — question posée mais **skippable**, jamais un critère bloquant pour terminer l'onboarding. Éditable ensuite en paramètres, avec un override possible par sujet pour les profils multi-sujets (ex. personal branding : l'audience d'un projet technique diffère de celle d'un produit grand public).
- **Contraintes de production :** matériel disponible, temps disponible par semaine.
- **Plateformes pertinentes :** suggérées par l'IA selon l'activité décrite (parmi le registre de plateformes connues).

Une fois assez d'informations réunies, l'IA marque la conversation comme complète, ce qui déclenche automatiquement :
- la génération de la **direction éditoriale** de départ (rôles éditoriaux, angles de script, séries récurrentes — voir Module E),
- la création d'objectifs de fréquence hebdomadaire par défaut sur les plateformes suggérées.

En parallèle, l'utilisateur renseigne ses **sujets** (1 à 5, appelés "produits" côté code/API — renommage purement visuel, `docs/SPEC_MATIERE_EDITEUR.md` §3.3) et peut connecter ses comptes sociaux (TikTok/Instagram/LinkedIn) via OAuth : la connexion déclenche automatiquement la récupération de publications récentes et une première analyse IA du style de communication (`style_profile`). Ce profil **apprend ensuite des corrections de l'utilisateur** : chaque script finalisé après retouche (ou écrit par lui) nourrit, sur proposition à valider, des règles de style impératives que le produit respecte partout où il rédige — génération, retouche de phrase, régénération de bloc (`docs/SPEC_APPRENTISSAGE_STYLE.md`).

**Alimenter le corpus d'un sujet :** deux portes pour nourrir la génération en matière factuelle (anecdotes, chiffres, décisions, retours...) — coller du texte ou un fichier `.md`/`.txt` pour qui écrit déjà (journal de bord, anciens posts), ou se faire **interviewer par le chat** (une question concrète à la fois) pour qui n'a rien d'écrit. Les deux alimentent le même corpus, structuré en arrière-plan en unités typées (anecdote / bug / chiffre / décision / learning) réutilisées par rotation à chaque génération — voir Module B.

### Module B : Le Moteur d'Idées & l'Éditeur de Script
Le moteur génère des fiches prêtes à l'emploi, **adaptées au type de contenu** (pas uniquement vidéo) :
- **Vidéo** (TikTok, Reels...) : titre, accroche (hook visuel + texte à l'écran + audio), storyboard en plans numérotés, légende, hashtags, recommandation de son.
- **Visuel statique** (image / carrousel) : titre, accroche visuelle, découpage en slides, légende, hashtags.
- **Texte seul** (LinkedIn, newsletter, blog...) : titre, accroche (première phrase), corps de texte, hashtags optionnels.

Chaque génération est contrainte par :
- le **rôle éditorial** visé (`ContentCategory` côté données — personnalisé par IA, voir Module E),
- un **angle imposé automatiquement** par le système anti-répétition (invisible pour l'utilisateur mais déterminant pour la structure du script),
- la **série récurrente** le cas échéant (identité de format reconnaissable),
- l'**audience visée** (celle du sujet si renseignée, sinon celle de la marque),
- le **corpus de matière factuelle** du sujet (unités structurées si le corpus a été traité, texte brut sinon) — base réelle de la génération, avec instruction explicite de ne jamais inventer une information non fournie (marqueur `[à compléter]` en son absence),
- les sujets déjà traités récemment et un résumé des performances récentes (métriques saisies manuellement), quand disponibles.

**Une idée, pas une paraphrase du brief :** avant de rédiger quoi que ce soit d'autre, le modèle formule en une ou deux phrases l'intention du post — l'idée unique, à qui elle s'adresse, ce qu'on doit en retenir ou faire. Cette intention (le "concept") est conservée avec le script, gelée dès la génération : les micro-retouches et régénérations de bloc s'y tiennent, sans jamais la réécrire.

**Anti-répétition :** l'application maintient une bibliothèque d'angles/archétypes de hook par utilisateur (générée par IA à l'onboarding, ex : "question choc", "avant/après", "témoignage", "tutoriel"...). À chaque génération, le système impose automatiquement l'angle le moins récemment utilisé dans le rôle visé — l'utilisateur n'a rien à choisir, la variation est garantie côté produit plutôt que laissée au hasard du LLM. La même logique de rotation (least-recently-used) s'applique à la sélection des unités de matière injectées, avec deux overrides manuels : épingler ("à placer absolument") et exclure ("jamais dans un post").

**Le script est une surface de travail, pas un artefact figé.** Générer, coller un texte déjà écrit ailleurs, taper à la main et retoucher par IA sont le même geste : le script peut naître d'une génération complète, d'un import (`docs/SPEC_MATIERE_EDITEUR.md` §2), ou directement dans l'éditeur au premier caractère tapé sur un créneau vide (naissance paresseuse). Une fois créé, chaque bloc est directement éditable ; sélectionner un passage et taper une instruction libre le retouche sans repasser par une régénération complète ; chaque bloc (accroche, storyboard, légende, hashtags) peut être régénéré individuellement plutôt que tout le script. Rôle, angle et série restent verrouillés depuis l'éditeur — la liberté est sur les mots, pas sur le brief.

**Quand l'intention elle-même ne va pas, pas seulement les mots :** « autre idée, même brief » régénère le script en entier, mais dirigé — brief intégralement verrouillé (y compris l'angle, jamais recalculé), et l'idée écartée est mémorisée pour que la proposition suivante ne la reformule pas simplement autrement. Un geste distinct des retouches de bloc dans l'éditeur (bouton séparé, confirmation systématique avant remplacement), pour marquer que c'est l'intention qu'on change, pas les mots.

**Générer une série depuis la matière :** à partir du corpus d'un sujet, le système propose un découpage en épisodes et génère N scripts ordonnés, rattachés à la même série et posés directement sur le calendrier — un seul effort documenté produit plusieurs contenus programmés.

**L'échelle de secours page blanche :** un jour sans idée n'est pas nécessairement un jour sans matière — la rotation choisit dans ce qui n'a pas encore été utilisé ; si le corpus du sujet est sec, l'interview-chat devient l'outil de la page blanche (extraire plutôt qu'inventer) ; le générateur de calendrier oriente aussi, en amont, les rôles gourmands en matière ("storytelling/coulisses") vers les jours où le corpus est fourni, et réserve les rôles qui tournent sans journal ("expertise/pédagogie") aux jours secs — sans jamais retoucher un calendrier déjà généré. Le filet ultime reste le même : ne jamais inventer une précision, marquer `[à compléter]`.

### Module C : La Matrice de Recyclage de Contenu — *Hors périmètre*
Non implémentée. Voir §2.4.

### Module D : Le Calendrier Intelligent & Auto-Remplissage
- **Fréquence sur-mesure :** objectif hebdomadaire par plateforme, modifiable individuellement.
- **Génération automatique du mois :** mix de contenus dont les proportions sont **personnalisées par IA et par utilisateur** (plus de triptyque fixe 30/50/20) :
  - défini par les **rôles éditoriaux actifs**, chacun avec un poids en % normalisé à 100 sur l'ensemble ;
  - les **séries récurrentes** actives peuvent en plus s'imposer sur une partie des créneaux (poids indépendant, non normalisé) ;
  - rôles et séries peuvent être **ciblés par plateforme** (sans ciblage explicite, ils s'appliquent à toutes les plateformes suivies).
- **Cycle du créneau :** le calendrier crée des créneaux typés (une série, ou un "post libre" portant seulement un rôle) sans script ; l'utilisateur déclenche la génération du script depuis le créneau. Script et créneau ont chacun un statut, modifiable manuellement pour suivre l'avancement.
- **Suivi de performance :** vues/likes/commentaires/partages, saisis manuellement ou récupérés automatiquement (TikTok, YouTube, Instagram Creator — écran "Performance", synchronisation lazy à l'ouverture, pas de cron) via un rattachement post↔script par heuristique + confirmation utilisateur unique. Historique daté conservé (`PostMetricsSnapshot`), réinjecté en résumé dans les générations suivantes.
- **Rééquilibrage éditorial automatique :** à partir des métriques récupérées automatiquement (jamais de la saisie manuelle), le poids des rôles éditoriaux actifs peut être ré-ajusté — normalisé par plateforme, plafonné et amorti par cycle pour éviter sur-réaction et emballement (`docs/SPEC_METRIQUES_AUTO.md` §6). Jamais appliqué seul : passe systématiquement par une proposition (`AssistantProposal`, voir Module E) que l'utilisateur valide, édite ou rejette. Limité aux rôles pour cette itération ; angles et séries non concernés.
- **Rappels & Notifications :** non implémentés à ce stade.

### Module E : Direction éditoriale & Assistant IA — *ajouté au périmètre, non prévu au cadrage initial*
- **Écran "Direction" :** la **série est le seul objet éditorial manipulé** (`docs/SPEC_SERIES_ET_ROLES.md`) — création, identité, poids, ciblage par plateforme, sujet lié, mode, régénération par IA. Chaque série sert **exactement un rôle éditorial** (pourquoi le post existe : expertise, coulisses, preuve sociale…) ; un créneau sans série est un **post libre** qui ne porte qu'un rôle. Le mix des rôles s'affiche en lecture seule sur cet écran ; son édition complète (libellé, consigne, poids, gourmandise en matière) vit dans Paramètres › Avancé, parce que ce poids est surtout piloté par les performances réelles.
- **Assistant éditorial (chat) — un rédacteur en chef assistant :** conversation libre pour faire évoluer sujets, séries, rôles, angles, objectifs de fréquence, **matière première** et **audience de marque** (`docs/SPEC_ASSISTANT_AGENTIQUE.md`).
  - **Il lit tout l'espace de travail** pour argumenter : la matière du créateur, ses scripts, son calendrier, ses performances réelles, l'état narratif de ses séries, son profil. Un rédacteur en chef qui conseille sans avoir lu ce qui est publié ni ce qui est planifié ne sert à rien.
  - **Il ne touche ni aux scripts ni au calendrier.** Les mots et le planning restent la main du créateur ; l'assistant tient le brief. C'est une frontière de rôle, pas une limite technique.
  - **Il ne modifie jamais rien directement :** il formule des **propositions** — création, modification, ou archivage (jamais de suppression) — que l'utilisateur accepte, édite ou rejette une par une avant application.
  - **La matière entre par la conversation :** on peut **glisser un fichier** `.md`/`.txt` dans le chat, et l'assistant propose de le ranger dans le bon sujet (il n'en voit que le nom, jamais le contenu — s'il ne sait pas où le classer, il demande, et le rangement peut venir plusieurs messages plus tard). Quand le créateur raconte simplement une information exploitable — une actualité, une anecdote d'atelier, un chiffre — l'assistant propose de l'ajouter à sa matière : ce qui se dit en passant devient la matière des prochains contenus.
- **Rééquilibrage des rôles, proposé automatiquement :** même mécanisme de proposition que ci-dessus, mais généré par un calcul déterministe sur les métriques de performance plutôt que par le LLM (voir Module D) — la boucle "arbitrage basé sur la performance réelle" que le positionnement rédacteur en chef IA promet.

---

## 4. Feuille de Route Fonctionnelle

| Composante | État actuel | Prochaine étape |
| :--- | :--- | :--- |
| **Plateformes** | TikTok, Instagram, LinkedIn, YouTube, X (OAuth) + Newsletter, Blog, Slack, Autre (suivies manuellement) | Pinterest, Facebook, connexions OAuth supplémentaires ; débloquer les métriques LinkedIn/X (validation externe, compte de facturation) |
| **Génération de Contenu** | Scripts vidéo/visuel/texte, storyboards, légendes, hashtags, angles anti-répétition, séries récurrentes, photo mise en scène (Nano Banana) et **maquette du post visuel** composée par l'agent en HTML par-dessus l'image (ou sans), éditable à la main et par instruction, exportée en PNG (`docs/SPEC_DESIGN_HTML_SUR_IMAGE.md`) | Voix-off générées par IA, coloration syntaxique des extraits de code, carrousel PDF pour LinkedIn |
| **Corpus & Éditeur** | Matière par sujet (collage/fichier/interview-chat), **dépôt GitHub connecté** (les `.md` et le journal de commits d'un dépôt public deviennent de la matière, resynchronisable), structuration en unités typées + rotation LRU, import de scripts écrits ailleurs, éditeur de blocs (édition directe, sélection→instruction, régénération par bloc), génération de série depuis la matière, concept d'intention gelé par script, "autre idée, même brief" (régénération complète dirigée), **style appris des corrections** (règles proposées à validation, éditables, injectées dans tous les gestes de rédaction) | Étendre les **sources de matière connectées** au-delà de git (dossier de notes synchronisé, Obsidian) ; dépôts privés ; proposition multi-voix au premier jet ; angles enrichis (squelette de hook + condition de réussite par angle, `docs/SPEC_PROMPT_GENERATION_TECH.md` §7) |
| **Diffusion / Planification** | Calendrier visuel, mix rôles/séries personnalisé par IA, statuts manuels, aiguillage matière×rôle (réoriente les rôles gourmands en matière un jour sec) | Rappels/notifications, auto-publication directe via API officielles |
| **Analytics** | Automatique (TikTok, YouTube, Instagram Creator) + saisie manuelle en complément (LinkedIn/X en attente de déblocage, Newsletter/Blog/Slack/Autre) ; historique daté par post | Dashboard Analytics agrégé, au-delà de l'écran "Performance" post par post |
| **Direction éditoriale** | Série = seul objet manipulé, avec un rôle unique ; rôles/angles/séries personnalisés par IA, assistant conversationnel à propositions, rééquilibrage des rôles proposé automatiquement à partir des métriques réelles | Étendre le rééquilibrage aux angles et aux séries |
| **Collaboration** | Compte solo créateur | Mode multi-utilisateurs / Assistant / Agence |
| **Module C (Recyclage)** | Hors périmètre | À reprendre après validation du parcours de base |

---

## 5. Orientations IA (résumé)

- **Moteur LLM :** provider pluggable sélectionné par variable d'environnement. **OpenAI est le seul provider opérationnel** ; les adaptateurs Gemini, Claude (Anthropic) et Groq existent dans le code mais ne sont pas utilisables en l'état. Gemini reste utilisé, indépendamment de ce choix, pour la génération d'images et le captioning vision.
- **Architecture de prompts :** prompts système modulaires par cas d'usage (génération de script, chat d'onboarding, chat assistant, analyse de style, suggestion de rôles/angles/séries), tous forcés en sortie JSON structurée via function/tool calling.

Le détail technique (stack, modèle de données, endpoints, architecture des prompts complète) est dans `TECH.md`.

---

## 6. Prochaines étapes

1. Valider la cible prioritaire (§2.1) avec quelques utilisateurs externes qui ont déjà de la matière écrite : mesurer s'ils remplissent le corpus sans accompagnement et à quel point le script généré est publié tel quel ou réécrit.
2. Étendre les sources de matière connectées au-delà du dépôt git déjà livré (dossier de notes, Obsidian, dépôts privés) pour supprimer le collage manuel chez le reste de la cible prioritaire.
3. Notifications/rappels de tournage et de publication (Module D).
4. Dashboard analytics agrégé à partir des métriques désormais collectées automatiquement (TikTok/YouTube/Instagram) et manuellement (autres plateformes).
5. Débloquer la récupération automatique des métriques LinkedIn (validation Community Management API) et X (ouverture d'un compte de facturation).
6. Étendre le rééquilibrage automatique (aujourd'hui limité aux rôles) aux angles et aux séries récurrentes.
7. Reprise du Module C une fois le parcours de base validé en usage réel.
8. Auto-publication directe via API officielles (évolution long terme).
9. ~~Passe d'apprentissage `style_profile`~~ — livrée (`docs/SPEC_APPRENTISSAGE_STYLE.md`). Reste la proposition multi-voix au premier jet, à cadrer.
10. ~~Maquette du post visuel composée par l'agent~~ — livrée (`docs/SPEC_DESIGN_HTML_SUR_IMAGE.md`). Restent la coloration syntaxique des extraits de code, l'export PDF pour les carrousels LinkedIn et la vignette dans le calendrier.
