# 09 — Carte des autres docs

Le dossier `docs/` contient ~60 fichiers écrits au fil de 13 chantiers. Beaucoup sont **exacts pour leur chantier mais périmés pour l'ensemble** : chaque spec décrit ce qu'on a décidé ce jour-là, pas l'état final. Ce tableau dit **quoi croire**.

Légende : 🟢 vivant, fiable pour sa zone · 🟡 utile mais en partie périmé (voir la note) · 🔴 archive historique, ne pas s'y fier · 📎 référence ponctuelle (setup, recherche, test).

## Les deux « gros » docs — à lire avec méfiance

| Fichier | Statut | Note |
| :--- | :--- | :--- |
| `PRODUCT.md` (33 Ko) | 🟡 | Vision et modules. Contient encore l'ancien vocabulaire : Instagram/newsletter/blog, « rédacteur en chef », calendrier de cartes, onboarding en six écrans comme entrée. Les encadrés « Mise à jour du 2026-10-18 » corrigent, mais il faut les lire. **Remplacé en pratique par `01-vision.md` + `02-produit.md`.** |
| `TECH.md` (120 Ko) | 🟡 | Très riche (modèle de données détaillé, endpoints, prompts, Stripe, sécurité, Sentry, légal). Périmé sur : « desktop seulement », écran `/calendar` mensuel, `/scripts/:id`, onboarding en chat, rédacteur en chef (§5.12 `materialEpisodes`), Instagram. **Bon pour les détails de §6 Stripe, §7 sécurité, §8 fournisseurs, §9 Sentry.** |
| `PROMPTS.md` (94 Ko) | 🟡 | Inventaire des prompts. À recouper avec `src/lib/llm/` : des prompts du rédacteur en chef et du cadrage y figurent encore. |

## Specs de chantier — par sujet

### Génération (le cœur)
| Fichier | Statut | Pourquoi / quoi |
| :--- | :--- | :--- |
| `SPEC_REDACTEUR_PAR_EVENEMENTS.md` | 🟢 | **Le plus important.** Lecteur d'événements, lecteur et forme de série, rédacteur agentique. Source de `04-ia-et-generation.md` |
| `SPEC_PROMPT_GENERATION_V3.md` | 🟡 | Ne sert plus qu'aux posts libres. Garde la logique des contrôles du code et des règles par plateforme |
| `CHOIX_TECHNIQUES_PROMPT_V3.md` | 🟡 | Le pourquoi des choix de V3, mémoire/veille, cadrage (retiré), séries |
| `SPEC_MEMOIRE_ET_VEILLE.md` | 🟡 | 5 derniers posts + veille d'inspiration (actifs) |
| `SPEC_APPRENTISSAGE_STYLE.md` | 🟢 | Règles de style apprises (jamais essayé en réel) |
| `SPEC_LANGUE_DES_POSTS.md` | 🟢 | Langue du profil sinon des notes |
| `SPEC_PROMPT_GENERATION_TECH.md` | 🔴 | Ancienne génération (angles, concept) — les concepts gelés et l'anti-répétition y naissent |
| `SPEC_REDACTEUR_EN_CHEF.md` | 🔴 | **Retiré** (2026-10-17), remplacé par les événements |
| `SPEC_CADRAGE_SERIE.md` | 🔴 | **Retiré** (2026-10-17), remplacé par la forme de série |

### Séries et calendrier
| Fichier | Statut | Note |
| :--- | :--- | :--- |
| `SPEC_SERIES_ET_ROLES.md` | 🟢 | Série = seul objet éditorial, rôle unique |
| `SPEC_RYTHME_DES_SERIES.md` | 🟢 | Rythme par série, calendrier sur 28 jours |
| `SPEC_APP_DESIGN_TELLOVO.md` | 🟢 | **L'application actuelle** : semaine, plan, contexte, deux réseaux, quota en semaines |

### Entrée, matière, connecteurs
| Fichier | Statut | Note |
| :--- | :--- | :--- |
| `SPEC_ENTREE_PAR_LE_REPO.md` | 🟢 | `/start`, compte sans mot de passe, premier post par email |
| `SPEC_ONBOARDING_MVP.md` | 🟡 | Parcours de repli en six écrans (`/onboarding`) ; la vidéo y est retirée |
| `SPEC_CONNECTEURS_ET_SUJETS.md` | 🟢 | Ce qu'est un « sujet » chez GitHub, Notion, Linear, Etsy, Shopify |
| `SPEC_MATIERE_EDITEUR.md` | 🔴 | Archive : corpus et éditeur de blocs, déjà fusionné dans `PRODUCT`/`TECH` |
| `ARCHITECTURE_VERTICALES.md` | 🟢 | La règle « pas de table par verticale » |
| `DEMANDES_ETSY_SHOPIFY.md` | 📎 | Démarches de validation à mener, en parallèle du code |

### Visuel
| Fichier | Statut | Note |
| :--- | :--- | :--- |
| `SPEC_COMPOSITION_VISUELLE.md` | 🟢 | Maquette sur vraies photos, montage, détourage |
| `SPEC_DESIGN_HTML_SUR_IMAGE.md` | 🟢 | La maquette HTML éditable, export PNG |
| `SPEC_FORMAT_VISUEL_ET_ANIMATION.md` | 🟡 | Format image/carrousel/animation ; l'animation « à calques » y est remplacée par la suivante |
| `SPEC_ANIMATION_HTML_LIBRE.md` | 🟢 | **Animation actuelle** (HTML libre) |
| `SPEC_RESSOURCES_VISUELLES.md` | 🟡 | Bibliothèque de photos ; la génération d'image y est retirée |
| `RECHERCHE_DESIGN_MAQUETTE.md` | 📎 | Règles de design/animation, **rien d'implémenté** |
| `SETUP_RESSOURCES_VISUELLES.md` | 📎 | Créer les comptes R2 et Google Cloud |

### Mesure
| Fichier | Statut | Note |
| :--- | :--- | :--- |
| `SPEC_PERFORMANCE.md` | 🟢 | L'écran Performance (jamais essayé en vrai) |
| `SPEC_METRIQUES_AUTO.md` | 🔴 | Archive : récupération des métriques, fusionnée dans `TECH` |

### Compte, légal, exploitation
| Fichier | Statut | Note |
| :--- | :--- | :--- |
| `SPEC_LEGAL_EMAIL_RGPD.md` | 🟢 | Pages légales, emails de service, mot de passe oublié, export/suppression |
| `SPEC_QUOTAS_ADMIN.md` | 🟢 | Quotas perso par compte, `/admin/quotas` |
| `SPEC_SEO.md` | 🟢 | Landing SSR, Open Graph, `isIndexable` |
| `SPEC_ASSISTANT_AGENTIQUE.md` | 🟢 | L'assistant (caché mais fonctionnel) |
| `DEPLOIEMENT_VPS.md` | 🟢 | Guide de prod + « Statut » du déploiement du 2026-10-16 |
| `SETUP_EMAILS_BREVO.md` | 📎 | Clé, DNS, `EMAIL_FROM` |

### Journaux et historique
| Fichier | Statut | Note |
| :--- | :--- | :--- |
| `DEVLOG.md` | 🟢 | Journal daté : décisions, casses, apprentissages. **Le lire pour comprendre pourquoi** |
| `BRIEF.md`, `SPEC_POC.md`, `UI_FONCTIONNALITES.md` | 🔴 | Cadrage et spec du POC initial — conservés, jamais mis à jour |
| `superpowers/` | 🔴 | Plans et specs de l'été (onboarding GitHub, connecteurs) — déjà implémentés |

## Dossiers de données (pas de la documentation)

| Dossier | Contenu |
| :--- | :--- |
| `docs/tests/` | Rapports d'essais réels : `mykine-pack/` (pack kiné/dev, **résultats de la génération par événements**), `2026-10-17/` (`essais.html`), `animation-html/`, `performance-mockup/` (référence visuelle validée de Performance), `performance-screens/` |
| `docs/baseline/` | Comparaisons de l'ancien prompt (lots 0-2, V2 contre V3) — historique |
| `docs/recherche-ghostwriting/` | Trois notes de recherche sur les pratiques de ghostwriting, les bons posts par plateforme, le récit d'événement — **source des principes de `eventWriter.ts`** |
| `docs/founder/` | **Pas du code du produit** : brief, analyse concurrents, panels de consommateurs et pitchs produits par le pack « founder ». Non suivi par git — ne pas le pousser |
| `docs/WhatsApp Image …jpeg` | Image de référence (maquette de la landing Tellovo). Non suivie par git |

## Règle pour la suite

Quand un chantier change l'état d'ensemble, mettre à jour **ce dossier `guide/`** (surtout `07-etat-et-reste-a-faire.md`, `02-produit.md` et `08-decisions.md`) en plus de la spec du chantier. Une spec décrit un chantier ; le guide décrit le produit.
