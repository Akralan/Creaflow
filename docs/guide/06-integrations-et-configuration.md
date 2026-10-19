# 06 — Intégrations et configuration

Principe : **tout est optionnel sauf la base et une clé OpenAI**. Sans un service, la fonction concernée est masquée ou échoue explicitement ; rien d'autre ne casse. Modèle de fichier : `.env.example` (copié en `.env` par `npm run setup`) ; modèle de prod : `deploy/env.production.example`.

## Minimum pour faire tourner l'app

| Variable | Rôle |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL (dev : conteneur `pgvector/pgvector:pg17` sur le port **5433**) |
| `AUTH_SECRET` | Signature des sessions (généré par `npm run setup`) |
| `LLM_PROVIDER=openai` | **À mettre explicitement** (le repli codé en dur est `gemini`, non opérationnel) |
| `OPENAI_API_KEY` | Toute la génération. Sans elle l'app démarre mais ne génère rien |
| `APP_URL` | URL publique (liens d'email, redirections OAuth, SEO) |

## Services externes

| Service | À quoi il sert | Variables | Si absent |
| :--- | :--- | :--- | :--- |
| **OpenAI** | Texte, agents, assistant, embeddings, recherche web, vision des animations | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_EMBEDDING_MODEL` | Rien ne se génère |
| **Gemini** | Légendes vision des photos | `GEMINI_API_KEY`, `GEMINI_MODEL` | Pas de captioning |
| **GitHub** | Lecture anonyme des repos de `/start` ; connexion OAuth ; source de matière | `GITHUB_TOKEN` (**sans aucun droit**, requis pour ouvrir `/start` au public), `GITHUB_CLIENT_ID/SECRET`, `GITHUB_OAUTH_REDIRECT_URI` (scope `read:user user:email read:org`) | Sans token : 60 requêtes/h partagées par **tout le site** ; sans OAuth : bouton masqué |
| **Notion** | Porte d'entrée et source (intégration **publique** obligatoire) | `NOTION_CLIENT_ID/SECRET` | Bouton masqué |
| **Linear** | Idem (scope `read`) | `LINEAR_CLIENT_ID/SECRET` | Bouton masqué |
| **LinkedIn / X** | Connexion de compte et chiffres | `LINKEDIN_*`, `X_CLIENT_ID/SECRET` | Pas de connexion |
| **Apify** | Chiffres de X sans compte de facturation X | `APIFY_TOKEN`, `APIFY_X_ACTOR`, `X_METRICS_PROVIDER` (`apify` \| `x_api`) | Performance vide avec message |
| **Stripe** | Abonnements | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO` | Tout le monde reste en essai ; `/api/billing/*` échoue explicitement |
| **Brevo** | Emails (reset, connexion par lien, 1er post) | `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_PROVIDER` | Mode `console` : l'email est écrit dans les logs |
| **Cloudflare R2** | Photos et assets | `R2_*`, `STORAGE_PROVIDER` | Bibliothèque de photos inactive |
| **Google Cloud** | Picker Drive pour importer des photos | `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` | Import Drive masqué |
| **Photoroom** | Détourage des photos | `BACKGROUND_REMOVAL_PROVIDER=photoroom`, `PHOTOROOM_API_KEY` (clé `sandbox_` gratuite avec filigrane) | Fonction masquée |
| **Sentry** | Erreurs | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Aucun événement envoyé |

## Autres réglages

| Variable | Rôle |
| :--- | :--- |
| `ADMIN_EMAILS` | Emails (séparés par des virgules, lus au **démarrage**) qui accèdent à `/admin/quotas`. Vide = personne |
| `START_DAILY_CAP` | Plafond de nouveaux comptes par jour via `/start` |
| `SEO_INDEXABLE` | Forcer/empêcher l'indexation. `APP_URL` et cette variable sont lues **au build** ; jamais d'indexation sur un hôte de démo ni en local |
| `EMAIL_LOG_LINKS` | **Essais seulement** : écrit le lien de connexion dans les logs. **À retirer avant Brevo** (voir `URGENT.md`) |

## Ce que chaque service coûte ou exige (à ne pas oublier)

- **LinkedIn métriques** : l'accès « Community Management API » demande une validation LinkedIn (non self-serve). Bloquant tant qu'il n'est pas obtenu.
- **Etsy et Shopify** : bloqués derrière une validation manuelle de leur plateforme (`docs/DEMANDES_ETSY_SHOPIFY.md`) ; non codés.
- **Brevo** : clé + authentification du domaine d'envoi (DNS) + `EMAIL_FROM` (`docs/SETUP_EMAILS_BREVO.md`). OVH ne fournit pas d'envoi de mail depuis le VPS.
- **R2 et Google** : comptes à créer (`docs/SETUP_RESSOURCES_VISUELLES.md`).
- **Détourage** : ≈ 0,02 $ par photo, une seule fois par photo (cache) ; non quoté.

## Rate limits en place (Postgres)

Login 10/15 min par IP + 5/15 min par email · signup 5/h par IP · génération 20/min par utilisateur (scope partagé entre les 4 routes) · assistant 10/min · style 5/min · design et détourage 10/min · reset 5/h par IP + 3/h par email · compte (export, suppression) 3/h · **`/start`** : analyse 5/h par IP, création 3/h par IP et 3/jour par email, renvoi de lien 5/h par IP et 3/h par email, plus plafond global `START_DAILY_CAP`. **Non couvert** : les routes `/api/billing/*`.
