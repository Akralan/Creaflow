# BRIEF DE CADRAGE PRODUIT — CREAFLOW (v1.0)
**Plateforme d'Assistance Créative & Planification Social Media pour Créateurs & Boutiques**

---

## 1. Vision & Positionnement

### 1.1 Constat & Problématique
Les artisans, créateurs et gérants de petites boutiques physiques/en ligne font face à un défi majeur :
- **Manque de temps et de compétences marketing :** Ils savent créer leurs produits, mais ne savent pas comment les promouvoir efficacement sur les réseaux sociaux.
- **Syndrome de la page blanche :** Difficulté à trouver des idées régulières et adaptées aux codes des plateformes actuelles (TikTok, Instagram Reels).
- **Sous-optimisation des efforts :** Une session de création/fabrication produit n'est souvent filmée qu'une seule fois ou mal exploitée, alors qu'elle pourrait nourrir plusieurs formats de contenu.
- **Complexité de l'IA brute :** Utiliser des outils comme ChatGPT ou Claude en direct demande une maîtrise du *prompt engineering* que la majorité des petits commerçants n'ont pas.

### 1.2 La Solution
Une application web et mobile centralisée qui agit comme un **Directeur Marketing Virtuel**. Elle collecte l'identité et l'historique du créateur pour générer automatiquement des idées de contenus prêts à être filmés, structurer les scripts selon les meilleures pratiques (hooks, storyboards) et organiser la diffusion via un calendrier intelligent.

---

## 2. Période & Objectifs du MVP (Version 1)

### 2.1 Cible Prioritaire
- Artisans créateurs (bijoux, décoration, bougies, etc.)
- Boutiques de personnalisation (textile, gravure, impression)
- Marque de prêt-à-porter indépendantes
- Petits commerces locaux ayant une activité visuelle

### 2.2 Réseaux Sociaux Couverts en V1
- **TikTok** (Format Short / Vertical Video)
- **Instagram** (Reels, Carrousels, Stories)
- **LinkedIn** (Posts, Carrousels) — *ajouté au scope POC ; ton et formats à adapter par rapport à TikTok/Instagram (registre B2B/personal branding, moins orienté vidéo courte)*

### 2.3 Périmètre du POC (Preuve de Concept)
Avant le MVP complet, une phase de POC vise à valider le parcours de base et le moteur de génération :
- **Plateforme :** Web uniquement, usage desktop. Pas de réflexion mobile/app native pour cette phase.
- **Modules inclus :** Module A (Onboarding & Profiling), Module B (Moteur d'Idées & Scripts), Module D (Calendrier Intelligent).
- **Module hors scope POC :** Module C — La Matrice de Recyclage de Contenu, repoussée après validation du parcours de base.

---

## 3. Parcours Utilisateur & Fonctionnalités Nécessaires (MVP)

```
[ Onboarding & Profiling ] ➔ [ Matrice de Contenu IA ] ➔ [ Générateur de Scripts ] ➔ [ Calendrier Intelligent ]
```

### Module A : Onboarding & Profiling d'Activité
L'utilisateur configure son espace en quelques minutes via un questionnaire guidé :
- **Identité de marque :** Nom, type d'activité, valeurs, ton (ex: *humoristique, éducatif, esthétique/ASMR, institutionnel*).
- **Catalogue Produits :** Ajout des 3 à 5 produits phares (nom, description rapide, proposition de valeur, photos/liens).
- **Inspiration & Historique :** Possibilité d'intégrer les liens des 3 meilleures vidéos déjà publiées (ou compte social) afin de permettre à l'IA d'analyser la « patte » de la marque.
- **Contraintes de production :** Matériel à disposition (ex: *smartphone seul, trépied, éclairage, micro*), temps disponible par semaine pour filmer.

### Module B : Le Moteur d'Idées & Scripts Prêts-à-Filmer
Au lieu d'idées génériques, le moteur génère des fiches de tournage complètes :
- **Structure d'un script généré :**
  - **Titre du concept :** Clarté de l'objectif (ex: *Coulisses - Réalisation d'une commande*).
  - **Accroche (Hook) :** Visuelle (3 premières secondes) + Texte à afficher à l'écran + Voix/Audio.
  - **Storyboard pas à pas :** Découpage en plans simples (ex: *Plan 1: Découpe du sticker, Plan 2: Application presse à chaud, Plan 3: Résultat final*).
  - **Légende & Hashtags :** Rédigés selon les règles SEO de la plateforme visée.
  - **Sons / Tendances :** Recommandation sur le type de musique ou audio à associer.

### Module C : La Matrice de Recyclage de Contenu ("Killer Feature") — *Hors scope POC*
Optimisation du temps de tournage de l'artisan :
- À partir d'un seul processus de fabrication (ex: *20 minutes de personnalisation d'une gourde*), l'application propose un **découpage multi-formats** :
  1. *Format 1 (TikTok) :* Vidéo ASMR / Ratisfaisante (15 sec, son brut).
  2. *Format 2 (Reel Instagram) :* Problème/Solution "L'idée cadeau idéale" (20 sec, voix-off).
  3. *Format 3 (Story Instagram) :* Sondage interactif "Quel prénom graver ensuite ?".

### Module D : Le Calendrier Intelligent & Auto-Remplissage
- **Fréquence sur-mesure :** Définition de l'objectif hebdomadaire (ex: *3 posts TikTok, 2 Reels/semaine*).
- **Génération automatique du mois :** Remplissage du calendrier avec un mix équilibré de contenus :
  - *30% Vente / Promotion de produit*
  - *50% Coulisses / Storytelling / Connexion humaine*
  - *20% Éducatif / Tendance / Divertissement*
- **Rappels & Notifications :** Envoi d'une alerte au créateur au moment optimal de tournage et de publication.

---

## 4. Feuille de Route Fonctionnelle (Roadmap)

| Composante | Version 1 (MVP) | Version 2 (Évolution) |
| :--- | :--- | :--- |
| **Plateformes** | Instagram (Reels/Stories), TikTok | YouTube Shorts, Pinterest, Facebook |
| **Génération de Contenu** | Scripts détaillés, Storyboards textuels, Légendes, Hashtags | Génération de visualisations d'images IA, Voix-off générées par IA |
| **Diffusion / Planification** | Calendrier visuel + Notifications/Rappels pour publier | Auto-publication directe via API officielles des réseaux |
| **Analytics** | Suivi basique déclaratif / Métriques de complétion | Dashboard Analytics complet synchronisé avec les comptes |
| **Collaboration** | Compte solo créateur | Mode multi-utilisateurs / Assistant / Agence |

---

## 5. Spécifications Techniques & IA (Orientations)

- **Moteur LLM (IA) :** API Claude.
- **Architecture de Prompts :** Prompts système modulaires injectant le profil créateur, le catalogue produit et les contraintes de format.
- **Format de Sortie :** Interface web desktop.

*Le détail du scope technique (stack, auth, base de données, intégrations API, modèle de données) est cadré dans `SPEC_POC.md`, pas dans ce document produit.*

---

## 6. Prochaines Étapes Validées
1. **Validation du Brief Produits & Métiers** (Présent document).
2. **Conception des Wireframes UX/UI** (Parcours Onboarding + Vue Calendrier + Fiche Script).
3. **Prototypage du Moteur de Prompts** (Tests de génération de scripts sur 3 profils d'artisans réels).
