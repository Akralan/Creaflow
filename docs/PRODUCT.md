# VISION PRODUIT — CREAFLOW

> Remplace `BRIEF.md` (cadrage produit initial, phase POC) comme référence à jour sur le périmètre fonctionnel. `BRIEF.md` reste dans le repo comme archive historique du cadrage d'origine — ne pas le mettre à jour, c'est ce document-ci qui reflète l'état actuel.

**Plateforme d'Assistance Créative & Planification Social Media pour Créateurs & Entreprises**

---

## 1. Vision & Positionnement

### 1.1 Constat & Problématique
Les artisans, créateurs, freelances et gérants de petites structures font face à un défi majeur :
- **Manque de temps et de compétences marketing :** ils savent produire leur activité, mais ne savent pas comment la promouvoir efficacement sur les réseaux sociaux.
- **Syndrome de la page blanche :** difficulté à trouver des idées régulières et adaptées aux codes des plateformes actuelles (TikTok, Instagram Reels, LinkedIn...).
- **Sous-optimisation des efforts :** une session de création n'est souvent filmée qu'une seule fois ou mal exploitée, alors qu'elle pourrait nourrir plusieurs formats de contenu.
- **Complexité de l'IA brute :** utiliser ChatGPT ou Claude en direct demande une maîtrise du *prompt engineering* que la majorité des utilisateurs n'ont pas.
- **Répétition des idées :** sans mémoire des contenus déjà produits, un créateur qui génère seul ses idées (ou via une IA sans contexte) finit par reproposer les mêmes angles.

### 1.2 La Solution
Une application web centralisée qui agit comme un **Directeur Marketing Virtuel**. Elle collecte l'identité et l'historique du créateur via une conversation guidée, propose et fait évoluer sa direction éditoriale (catégories, angles, séries récurrentes), génère automatiquement des idées de contenus prêts à filmer ou publier, et organise la diffusion via un calendrier intelligent qui varie délibérément les angles pour éviter la répétition.

Le produit n'est pas restreint aux artisans avec produits physiques : le profil créateur et la génération de contenu s'adaptent à toute activité — artisan, freelance, marque de service, personal branding — sans supposer vidéo ou vente de produit.

---

## 2. Cible & Périmètre actuels

### 2.1 Cible prioritaire
- Artisans créateurs (bijoux, décoration, bougies, etc.)
- Boutiques de personnalisation (textile, gravure, impression)
- Marques de prêt-à-porter indépendantes
- Freelances et indépendants en personal branding (développeurs, coachs, consultants...)
- Petits commerces locaux ayant une activité visuelle ou non

### 2.2 Réseaux sociaux couverts
Registre de plateformes extensible côté code (`src/lib/social/types.ts`) ; à date :
- **Avec connexion OAuth** (analyse de la "patte" de marque à partir des posts récents, et pour TikTok/YouTube/Instagram récupération automatique des métriques de performance — voir Module D) : TikTok, Instagram, LinkedIn, YouTube, X (Twitter).
  - Reclassement (`docs/SPEC_METRIQUES_AUTO.md` §8) : YouTube était sous-évaluée dans un classement précédent — Data API v3 gratuite, aucune notion de compte business. X est posée côté code mais bloquée par l'ouverture d'un compte de facturation (pay-per-use depuis février 2026), LinkedIn par une validation d'accès externe (Community Management API) — ces deux dernières fonctionnent en connexion de compte, pas encore en récupération de métriques réelle.
- **Suivies sans OAuth** (calendrier + objectifs de fréquence, contenu généré manuellement, métriques saisies à la main) : Newsletter, Blog / site perso, Slack, Autre.

### 2.3 Modules livrés
- **Module A** — Onboarding & Profiling, sous forme de chat conversationnel avec l'IA.
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
L'utilisateur configure son espace via un **chat conversationnel avec l'IA** (pas un formulaire classique) : l'assistant pose une question à la fois, adaptée à l'activité décrite, et en déduit progressivement :
- **Identité de marque :** nom, type d'activité, ton, valeurs.
- **Contraintes de production :** matériel disponible, temps disponible par semaine.
- **Plateformes pertinentes :** suggérées par l'IA selon l'activité décrite (parmi le registre de plateformes connues).

Une fois assez d'informations réunies, l'IA marque la conversation comme complète, ce qui déclenche automatiquement :
- la génération de la **direction éditoriale** de départ (catégories de contenu, angles de script, séries récurrentes — voir Module E),
- la création d'objectifs de fréquence hebdomadaire par défaut sur les plateformes suggérées.

En parallèle, l'utilisateur renseigne son **catalogue produits/offres** (3 à 5 phares) et peut connecter ses comptes sociaux (TikTok/Instagram/LinkedIn) via OAuth : la connexion déclenche automatiquement la récupération de publications récentes et une analyse IA du style de communication (`style_profile`), réutilisée à chaque génération de script pour garder un ton cohérent.

### Module B : Le Moteur d'Idées & Scripts Prêts-à-Publier
Le moteur génère des fiches prêtes à l'emploi, **adaptées au type de contenu** (pas uniquement vidéo) :
- **Vidéo** (TikTok, Reels...) : titre, accroche (hook visuel + texte à l'écran + audio), storyboard en plans numérotés, légende, hashtags, recommandation de son.
- **Visuel statique** (image / carrousel) : titre, accroche visuelle, découpage en slides, légende, hashtags.
- **Texte seul** (LinkedIn, newsletter, blog...) : titre, accroche (première phrase), corps de texte, hashtags optionnels.

Chaque génération est contrainte par :
- la **catégorie de contenu** visée (rôle éditorial — personnalisée par IA, voir Module E),
- un **angle imposé automatiquement** par le système anti-répétition (invisible pour l'utilisateur mais déterminant pour la structure du script),
- la **série récurrente** le cas échéant (identité de format reconnaissable),
- les sujets déjà traités récemment et un résumé des performances récentes (métriques saisies manuellement), quand disponibles.

**Anti-répétition :** l'application maintient une bibliothèque d'angles/archétypes de hook par utilisateur (générée par IA à l'onboarding, ex : "question choc", "avant/après", "témoignage", "tutoriel"...). À chaque génération, le système impose automatiquement l'angle le moins récemment utilisé dans la catégorie de contenu visée — l'utilisateur n'a rien à choisir, la variation est garantie côté produit plutôt que laissée au hasard du LLM.

### Module C : La Matrice de Recyclage de Contenu — *Hors périmètre*
Non implémentée. Voir §2.4.

### Module D : Le Calendrier Intelligent & Auto-Remplissage
- **Fréquence sur-mesure :** objectif hebdomadaire par plateforme, modifiable individuellement.
- **Génération automatique du mois :** mix de contenus dont les proportions sont **personnalisées par IA et par utilisateur** (plus de triptyque fixe 30/50/20) :
  - défini par les **catégories de contenu actives**, chacune avec un poids en % normalisé à 100 sur l'ensemble ;
  - les **séries récurrentes** actives peuvent en plus s'imposer sur une partie des créneaux (poids indépendant, non normalisé) ;
  - catégories et séries peuvent être **ciblées par plateforme** (sans ciblage explicite, elles s'appliquent à toutes les plateformes suivies).
- **Cycle du créneau :** le calendrier crée des créneaux typés (catégorie + éventuellement série) sans script ; l'utilisateur déclenche la génération du script depuis le créneau. Script et créneau ont chacun un statut, modifiable manuellement pour suivre l'avancement.
- **Suivi de performance :** vues/likes/commentaires/partages, saisis manuellement ou récupérés automatiquement (TikTok, YouTube, Instagram Creator — écran "Performance", synchronisation lazy à l'ouverture, pas de cron) via un rattachement post↔script par heuristique + confirmation utilisateur unique. Historique daté conservé (`PostMetricsSnapshot`), réinjecté en résumé dans les générations suivantes.
- **Rééquilibrage éditorial automatique :** à partir des métriques récupérées automatiquement (jamais de la saisie manuelle), le poids des catégories de contenu actives peut être ré-ajusté — normalisé par plateforme, plafonné et amorti par cycle pour éviter sur-réaction et emballement (`docs/SPEC_METRIQUES_AUTO.md` §6). Jamais appliqué seul : passe systématiquement par une proposition (`AssistantProposal`, voir Module E) que l'utilisateur valide, édite ou rejette. Limité aux catégories pour cette itération ; angles et séries non concernés.
- **Rappels & Notifications :** non implémentés à ce stade.

### Module E : Direction éditoriale & Assistant IA — *ajouté au périmètre, non prévu au cadrage initial*
- **Écran "Direction" :** gestion manuelle des catégories de contenu, angles et séries récurrentes (édition, ciblage par plateforme, régénération complète par IA sur demande).
- **Assistant éditorial (chat) :** conversation libre avec l'IA pour faire évoluer produits, catégories, angles, séries et objectifs de fréquence. L'IA ne modifie jamais rien directement : elle formule des **propositions** (création ou modification, jamais de suppression) que l'utilisateur accepte, édite ou rejette une par une avant application. L'assistant peut lire jusqu'à 3 URLs fournies par l'utilisateur comme source factuelle pour étayer ses propositions.
- **Rééquilibrage des catégories, proposé automatiquement :** même mécanisme de proposition que ci-dessus, mais généré par un calcul déterministe sur les métriques de performance plutôt que par le LLM (voir Module D) — la boucle "arbitrage basé sur la performance réelle" que le positionnement Directeur Marketing Virtuel promet.

---

## 4. Feuille de Route Fonctionnelle

| Composante | État actuel | Prochaine étape |
| :--- | :--- | :--- |
| **Plateformes** | TikTok, Instagram, LinkedIn, YouTube, X (OAuth) + Newsletter, Blog, Slack, Autre (suivies manuellement) | Pinterest, Facebook, connexions OAuth supplémentaires ; débloquer les métriques LinkedIn/X (validation externe, compte de facturation) |
| **Génération de Contenu** | Scripts vidéo/visuel/texte, storyboards, légendes, hashtags, angles anti-répétition, séries récurrentes | Génération de visualisations d'images IA, voix-off générées par IA |
| **Diffusion / Planification** | Calendrier visuel, mix catégories/séries personnalisé par IA, statuts manuels | Rappels/notifications, auto-publication directe via API officielles |
| **Analytics** | Automatique (TikTok, YouTube, Instagram Creator) + saisie manuelle en complément (LinkedIn/X en attente de déblocage, Newsletter/Blog/Slack/Autre) ; historique daté par post | Dashboard Analytics agrégé, au-delà de l'écran "Performance" post par post |
| **Direction éditoriale** | Catégories/angles/séries personnalisés par IA, assistant conversationnel à propositions, rééquilibrage des catégories proposé automatiquement à partir des métriques réelles | Étendre le rééquilibrage aux angles et aux séries |
| **Collaboration** | Compte solo créateur | Mode multi-utilisateurs / Assistant / Agence |
| **Module C (Recyclage)** | Hors périmètre | À reprendre après validation du parcours de base |

---

## 5. Orientations IA (résumé)

- **Moteur LLM :** provider pluggable — Gemini (par défaut), Claude (Anthropic) ou Groq, sélectionné par variable d'environnement.
- **Architecture de prompts :** prompts système modulaires par cas d'usage (génération de script, chat d'onboarding, chat assistant, analyse de style, suggestion de catégories/angles/séries), tous forcés en sortie JSON structurée via function/tool calling.

Le détail technique (stack, modèle de données, endpoints, architecture des prompts complète) est dans `TECH.md`.

---

## 6. Prochaines étapes

1. Notifications/rappels de tournage et de publication (Module D).
2. Dashboard analytics agrégé à partir des métriques désormais collectées automatiquement (TikTok/YouTube/Instagram) et manuellement (autres plateformes).
3. Débloquer la récupération automatique des métriques LinkedIn (validation Community Management API) et X (ouverture d'un compte de facturation).
4. Étendre le rééquilibrage automatique (aujourd'hui limité aux catégories) aux angles et aux séries récurrentes.
5. Reprise du Module C une fois le parcours de base validé en usage réel.
6. Auto-publication directe via API officielles (évolution long terme).
