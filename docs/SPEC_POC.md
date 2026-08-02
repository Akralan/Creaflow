# SPEC TECHNIQUE — POC CREAFLOW

Ce document cadre le **scope technique** du POC (stack, architecture, modèle de données). Le positionnement produit et les fonctionnalités restent dans `BRIEF.md` — ce fichier ne traite que du "comment".

---

## 1. Rappel du périmètre POC

- **Plateforme :** Web uniquement, usage desktop.
- **Modules inclus :** A (Onboarding & Profiling), B (Moteur d'Idées & Scripts), D (Calendrier Intelligent).
- **Hors scope POC :** Module C (Matrice de Recyclage de Contenu).
- **Réseaux couverts :** TikTok, Instagram, LinkedIn.

---

## 2. Stack & Infrastructure

- **Moteur IA :** API LLM (Claude ou Gemini selon configuration, voir `src/lib/llm/`).
- **Frontend :** React / Next.js, interface web desktop (pas de responsive mobile pour le POC).
- **Backend :** API routes Next.js (co-localisées avec le frontend, pas de backend séparé pour le POC).
- **Principe de conception API :** les routes sont pensées **par vue UI**, pas par entité pure — chaque écran doit pouvoir se charger avec le moins d'appels possible (endpoints agrégés plutôt qu'un appel par entité liée, pas de pattern N+1).
- **Base de données :** PostgreSQL en local (instance sur la machine de développement).
- **Authentification :** minimale, email / mot de passe. Chaque testeur dispose de son propre espace.
- **Intégrations réseaux sociaux (Module A) :** APIs officielles par plateforme (TikTok Login Kit, Instagram Graph API, LinkedIn API). L'utilisateur connecte son compte via OAuth pour donner accès à ses propres publications. Nécessite inscription développeur + approbation d'app sur chaque plateforme — à démarrer tôt vu les délais.

---

## 3. Modèle de données (POC)

```
User
- id, email, password_hash, created_at

CreatorProfile (1:1 avec User)
- id, user_id
- brand_name, activity_type, tone, values (texte libre)
- equipment (liste : smartphone / trépied / éclairage / micro)
- weekly_time_available
- style_profile (json, nullable — résumé de style généré par IA à partir des InspirationVideo, ex: ton, longueur de phrase, usage d'emojis)
- style_profile_updated_at

Product (catalogue, 3-5 par créateur)
- id, user_id
- name, description, value_proposition, photo_url

SocialConnection (OAuth par plateforme)
- id, user_id
- platform (tiktok / instagram / linkedin)
- access_token, refresh_token, platform_user_id, connected_at

InspirationVideo (liens analysés pour la "patte" de marque)
- id, user_id, platform
- external_url, caption_text, metadata (json), fetched_at

Script (fiche de tournage générée — Module B)
- id, user_id
- product_id (nullable — un script peut être générique, pas lié à un produit précis)
- platform
- title, hook_visual, hook_text, hook_audio
- storyboard (json — liste de {plan_number, description})
- caption, hashtags (array), sound_recommendation
- content_category (vente / coulisses / educatif — pour respecter le mix 30/50/20)
- status (draft / planned / shot / published)
- created_at

PostingGoal (objectif hebdo par plateforme — Module D)
- id, user_id, platform, target_count_per_week

CalendarEntry (Module D)
- id, user_id
- script_id (nullable)
- platform, scheduled_date
- content_category
- status (planned / shot / published)
- reminder_sent (bool)
```

### Relation Script ↔ CalendarEntry

Les deux entités sont indépendantes mais reliées par `CalendarEntry.script_id` (nullable) :

- **Flux principal (mis en avant dans l'UX) :** le calendrier auto-génère des créneaux typés (ex: "5 août — coulisses — TikTok") sans script. L'utilisateur clique sur un créneau pour générer le script correspondant, qui vient ensuite remplir `script_id`.
- **Flux secondaire (possible, pas mis en avant) :** un script peut être généré librement via le Module B sans passer par le calendrier, puis attaché à un créneau existant après coup en renseignant `script_id`.

Aucune contrainte `NOT NULL` ne force l'un ou l'autre sens — le modèle supporte nativement les deux parcours.

---

## 4. Vues UI & Endpoints associés (POC)

Conçus en parallèle du modèle de données pour que chaque vue se charge en un minimum d'appels.

### Onboarding (Module A) — wizard multi-étapes
- `POST /api/profile` — identité de marque + contraintes de production (CreatorProfile).
- `POST /api/products` — ajout des 3-5 produits (bulk).
- `GET /api/auth/:platform/connect` → redirection OAuth ; `GET /api/auth/:platform/callback` → crée la `SocialConnection`, récupère côté serveur les vidéos récentes (stockées en `InspirationVideo`), **puis déclenche automatiquement le calcul/la mise à jour de `style_profile`** (voir section 6) — aucun appel supplémentaire requis depuis le front.

### Calendrier mensuel (Module D) — vue principale
- `GET /api/calendar?month=YYYY-MM` — endpoint agrégé unique : renvoie les `CalendarEntry` du mois **avec** le script lié déjà joint (`{ id, title, status }` ou `null`) et les `PostingGoal` par plateforme pour afficher la progression. Évite un appel par créneau.
- `POST /api/calendar/generate` `{ month }` — génère les créneaux du mois selon les objectifs et le mix 30/50/20.
- `POST /api/scripts/generate` `{ calendar_entry_id }` — génère le script via l'API LLM configurée, crée la ligne `Script`, met à jour `CalendarEntry.script_id`, et renvoie le script complet en un seul aller-retour (pas de create puis fetch séparé).

### Fiche Script (Module B) — vue détail
- `GET /api/scripts/:id` — script complet, produit lié inclus par jointure (pas d'appel séparé vers `/api/products/:id`).
- `POST /api/scripts/:id/regenerate` — régénère tout ou partie du script.
- `POST /api/scripts` — génération libre, sans créneau calendrier (flux secondaire décrit en section 3).

### Catalogue produits
- `GET /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`.

### Paramètres / connexions sociales
- `GET /api/connections` — statut de connexion par plateforme (un seul appel pour les 3).

---

## 6. Architecture des Prompts (Module B)

### Couches du prompt de génération de script
1. **Prompt système statique** — rôle ("Directeur Marketing Virtuel"), règles de structure du script (hook 3 premières secondes, storyboard en plans numérotés), règles spécifiques par plateforme (TikTok/Instagram orientés vidéo courte vs LinkedIn orienté texte/carrousel B2B).
2. **Contexte dynamique injecté par appel** — profil créateur (nom, ton, valeurs), `style_profile` (résumé, pas le brut), produit concerné si applicable, contraintes de production, `content_category` visée, plateforme cible.
3. **Sortie forcée en JSON strict** — via le mécanisme de *function/tool calling* de l'API LLM configurée (Claude ou Gemini), avec un schéma JSON correspondant exactement aux colonnes de `Script`. Évite le parsing de texte libre.

### Analyse de style (`style_profile`) — Option B retenue
Plutôt que de réinjecter les légendes brutes des `InspirationVideo` à chaque génération, un appel LLM dédié analyse ces légendes et produit un résumé structuré du style (ton, longueur de phrase, usage d'emojis, etc.), stocké sur `CreatorProfile.style_profile`.

- **Déclenchement :** automatique après connexion OAuth d'une plateforme (callback qui récupère les `InspirationVideo`, cf. section 4), et manuellement via `POST /api/profile/style-analysis` si l'utilisateur veut forcer un recalcul (ex: après avoir ajouté de nouvelles vidéos).
- **Avantage :** cohérence de ton stable d'une génération de script à l'autre, coût réduit par génération (résumé court injecté plutôt que le texte brut de plusieurs vidéos).
- **Coût additionnel :** un appel LLM asynchrone supplémentaire à chaque connexion/rafraîchissement de compte social (peu fréquent, acceptable pour le POC).

---

## 7. Décisions ouvertes

*(Aucune à ce stade — tous les points de cadrage technique du POC ont été tranchés.)*
