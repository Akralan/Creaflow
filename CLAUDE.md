@AGENTS.md

## Commandes du repo

- `npm run dev` — lance le serveur de dev Next.js.
- `npm run build` / `npm run start` — build de production / lancement.
- `npm run lint` — ESLint.
- `npm run db:generate` — génère une migration SQL à partir de `src/db/schema.ts` (ne nécessite pas de connexion DB active).
- `npm run db:migrate` — applique les migrations en attente sur la base pointée par `DATABASE_URL`.
- `npm run db:push` — pousse le schéma directement sans passer par des fichiers de migration (pratique en dev rapide, à éviter une fois qu'on a des données à préserver).
- `npm run db:studio` — ouvre Drizzle Studio pour inspecter la base.
- `npm run test` — lance la suite Vitest une fois (logique pure + appels Claude mockés, aucune base de données requise).
- `npm run test:watch` — lance Vitest en mode watch.

## Configuration

Copier `.env.example` vers `.env` et renseigner au minimum `DATABASE_URL` (PostgreSQL local) pour que l'app démarre.

Le provider LLM utilisé pour la génération de contenu est sélectionné via `LLM_PROVIDER` — voir `src/lib/llm/`. **Seul `openai` est opérationnel** (`OPENAI_API_KEY`) : c'est la valeur à utiliser, et celle que `.env.example` propose. Les adaptateurs `gemini`, `anthropic` et `groq` existent dans le code mais ne sont pas opérationnels — ne pas compter dessus pour faire tourner l'app (le fallback codé en dur dans `src/lib/llm/provider.ts` reste `gemini` si la variable est absente). `GEMINI_API_KEY` reste nécessaire pour le captioning vision des photos, indépendamment de `LLM_PROVIDER`. Le **détourage** des photos (optionnel) demande `BACKGROUND_REMOVAL_PROVIDER=photoroom` et `PHOTOROOM_API_KEY` (clé `sandbox_` gratuite avec filigrane en dev) ; absent, la fonction est simplement masquée.

Les credentials OAuth (TikTok/Instagram/LinkedIn) ne sont nécessaires que pour tester la connexion des comptes sociaux (Module A).

L'onboarding développeur (connexion GitHub, dépôts publics comme sujets) demande `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` et `GITHUB_OAUTH_REDIRECT_URI` — une OAuth App créée sur github.com, scope `read:user user:email read:org` uniquement. Optionnel en dev : sans ces variables le bouton « Continuer avec GitHub » n'apparaît pas sur `/login` et le parcours email/mot de passe reste complet. Voir `docs/TECH.md` §8.

**Notion** et **Linear** fonctionnent exactement pareil — porte d'entrée et source de matière — avec `NOTION_CLIENT_ID`/`NOTION_CLIENT_SECRET` (intégration **publique** sur notion.so/my-integrations : une intégration interne ne peut pas être autorisée par d'autres comptes) et `LINEAR_CLIENT_ID`/`LINEAR_CLIENT_SECRET` (scope `read`). Redirect URI à déclarer des deux côtés : `${APP_URL}/api/auth/oauth/<provider>/callback`. Absents, les boutons n'apparaissent pas. Voir `docs/SPEC_CONNECTEURS_ET_SUJETS.md`.

Les emails de service (lien de réinitialisation de mot de passe, avis de modification, confirmation de suppression de compte) passent par `src/lib/email/` : Brevo (`BREVO_API_KEY`, `EMAIL_FROM` sur un domaine vérifié) ou, par défaut sans clé, le mode `console` qui écrit l'email dans les logs — c'est ainsi qu'on récupère un lien de réinitialisation en local. L'identité de l'éditeur des pages légales vit dans `src/lib/legal/publisher.ts` (placeholders tant que l'entité n'est pas arrêtée ; la bannière « en cours de finalisation » disparaît d'elle-même une fois le fichier rempli). Voir `docs/SPEC_LEGAL_EMAIL_RGPD.md`.

La facturation self-service (Stripe) est optionnelle pour faire tourner l'app en dev : sans `STRIPE_SECRET_KEY`/`STRIPE_PRICE_*`/`STRIPE_WEBHOOK_SECRET`, tout utilisateur reste sur l'essai gratuit (5 scripts à vie) et les routes `/api/billing/*` échouent explicitement si sollicitées. Pour tester le flux complet en local : `stripe listen --forward-to localhost:3000/api/billing/webhook` (Stripe CLI) fournit le `STRIPE_WEBHOOK_SECRET` à utiliser. Voir `docs/TECH.md` §6.

## Documentation projet

- `docs/PRODUCT.md` — vision produit et fonctionnalités, à jour.
- `docs/ARCHITECTURE_VERTICALES.md` — comment le cœur se décline en verticales métier (dev, artisan, entrepreneur) : options tranchées, registre de connecteurs de matière et onboarding déclaratif. Chantiers 1 à 3 implémentés ; le 4 est une règle permanente — **une verticale n'ajoute pas de table et ne partitionne pas le modèle de données**, gardée par `src/db/schemaInvariants.test.ts`. Migration `0027` (renommage `onboarding_track` → `vertical`) écrite à la main, appliquée et vérifiée en base de dev.
- `docs/TECH.md` — scope technique à jour : stack, modèle de données, endpoints, architecture des prompts.
- `docs/DEPLOIEMENT_VPS.md` — mise en production sur un VPS unique : `Dockerfile` (standalone), `docker-compose.prod.yml` (Postgres pgvector, app, Caddy, conteneur `migrate`), `deploy/` (Caddyfile, modèle de `.env` de prod, `update.sh`, `backup.sh` vers R2). Le `docker-compose.yml` sans suffixe reste celui du dev. Fichiers écrits le 2026-10-16, **déployé le 2026-10-16** sur le VPS OVH `vps-a004fa72.vps.ovh.ca` depuis la branche `feature/deploiement-vps`, sans clé d'API (écarts listés dans le « Statut » du guide).
- `docs/BRIEF.md` / `docs/SPEC_POC.md` — cadrage initial de la phase POC, conservés comme archive historique (ne plus mettre à jour).
- `docs/SPEC_SERIES_ET_ROLES.md` — la série est le seul objet éditorial manipulé, la catégorie est un « rôle » (unique par série, ou porté par un post libre). Modèle de données inchangé, UX recadrée. Implémenté (Lots 0-4), migration de données appliquée en dev.
- `docs/SPEC_RESSOURCES_VISUELLES.md` — cadrage de la bibliothèque de ressources visuelles. Implémenté et validé en conditions réelles ; la partie « génération d'images » (Nano Banana) a été **retirée** par `docs/SPEC_COMPOSITION_VISUELLE.md`.
- `docs/SPEC_COMPOSITION_VISUELLE.md` — fin de la génération d'image : la maquette se compose automatiquement après la génération du script à partir des vraies photos (jusqu'à 6), avec montage, détourage (Photoroom derrière un adaptateur) et éléments d'interface. Implémenté (Lots 0-4), mergé sur `main` le 2026-10-16, migrations `0033`-`0034` (données comprises) appliquées en base de dev ; pas encore testé en réel.
- `docs/SETUP_RESSOURCES_VISUELLES.md` — comptes/clés externes à créer (Cloudflare R2, Google Cloud) pour que cette feature fonctionne.
- `docs/SPEC_ASSISTANT_AGENTIQUE.md` — l'assistant éditorial devient un « rédacteur en chef assistant » outillé : lecture de toute l'app, écriture sur tout sauf scripts et calendrier, toujours via propositions à valider. Repose sur la primitive `callAgentic` (multi-tours, N tools), écrite pour le seul adaptateur OpenAI — l'assistant ne dépend donc pas de `LLM_PROVIDER` et exige `OPENAI_API_KEY`, comme la génération d'images et le captioning vision le font pour Gemini. Implémenté (lots 0-4) et validé en conditions réelles.
- `docs/SPEC_CONNECTEURS_ET_SUJETS.md` — ce qu'est un « sujet » chez GitHub, Notion, Linear, Etsy et Shopify, et ce que coûte de les brancher. Notion et Linear sont **implémentés** (migration `0028` appliquée en base de dev) et validés en conditions réelles. Etsy et Shopify sont bloqués derrière une validation manuelle de leur plateforme — démarches détaillées dans `docs/DEMANDES_ETSY_SHOPIFY.md`, à mener en parallèle du code.
- `docs/superpowers/plans/2026-09-09-connecteurs-notion-linear.md` — le plan d'implémentation suivi pour Notion et Linear.
- `docs/SPEC_APPRENTISSAGE_STYLE.md` — exploitation du gisement premier jet / version finale : règles de style apprises, proposées à validation, injectées partout où la machine rédige (y compris micro-retouches). Implémenté (Lots 0-4), migration `0029`, pas encore testé avec une vraie clé LLM.
- `docs/SPEC_DESIGN_HTML_SUR_IMAGE.md` — le post visuel devient un livrable : l'agent compose une maquette HTML par-dessus l'image (ou sans), éditable à la main et par instruction, rendue en PNG dans le navigateur. Implémenté (Lots 0-4), migration `0030`, pas encore testé avec une vraie clé LLM ni dans un navigateur réel (export PNG à vérifier en premier).
- `docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md` — format du post visuel choisi à la génération (image, carrousel de N, animation de D secondes) ; l'animation est une slide avec une ligne de temps, aperçu natif dans l'éditeur, export MP4 au clic (WebCodecs, Chrome/Edge). Implémenté (Lots 0-4), migrations `0031`-`0032`, pas testé en réel (export vidéo à vérifier en premier).
- `docs/SPEC_LEGAL_EMAIL_RGPD.md` — ce qu'il manquait pour encaisser : pages légales alimentées par `publisher.ts` (CGU et CGV réunies, confidentialité alignée sur les vrais sous-traitants), emails de service via Brevo ou console, mot de passe oublié avec fermeture des sessions, onglet « Compte » (changer de mot de passe, exporter ses données en JSON, supprimer son compte avec résiliation Stripe). Implémenté (Lots 0-5), migration `0035` (renumérotée après le merge de la composition visuelle, qui occupe 0033-0034) appliquée en base de dev, parcours complet (reset, changement, export, suppression) vérifié en local en mode console.
- `docs/SETUP_EMAILS_BREVO.md` — ce qu'il reste à faire côté comptes externes : clé API Brevo, authentification du domaine d'envoi (DNS), `EMAIL_FROM`, `APP_URL`, identité de l'éditeur dans `publisher.ts`, emails de facturation à activer côté Stripe.
- `docs/superpowers/specs/2026-08-31-onboarding-dev-github-design.md` — onboarding développeur : identité GitHub, dépôts publics comme sujets, `.md` et journal de commits ingérés comme matière. Implémenté ; migration `0026` appliquée en base de dev, trajet OAuth validé en conditions réelles.
