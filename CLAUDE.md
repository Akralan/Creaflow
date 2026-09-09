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

Le provider LLM utilisé pour la génération de contenu est sélectionné via `LLM_PROVIDER` (`gemini` par défaut, `anthropic`, `groq`, ou `openai`) — voir `src/lib/llm/`. Renseigner la clé correspondante : `GEMINI_API_KEY` (clé Google AI Studio, quota gratuit), `ANTHROPIC_API_KEY`, `GROQ_API_KEY` (quota gratuit nettement plus généreux, pratique pour tester en dev — mais palier gratuit à faible débit, ex. 8000 tokens/minute, qui peut être atteint si le corpus de matière brute injecté en entier à la génération (`docs/SPEC_MATIERE_EDITEUR.md` §3) est volumineux), ou `OPENAI_API_KEY`.

Les credentials OAuth (TikTok/Instagram/LinkedIn) ne sont nécessaires que pour tester la connexion des comptes sociaux (Module A).

L'onboarding développeur (connexion GitHub, dépôts publics comme sujets) demande `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` et `GITHUB_OAUTH_REDIRECT_URI` — une OAuth App créée sur github.com, scope `read:user user:email read:org` uniquement. Optionnel en dev : sans ces variables le bouton « Continuer avec GitHub » n'apparaît pas sur `/login` et le parcours email/mot de passe reste complet. Voir `docs/TECH.md` §8.

La facturation self-service (Stripe) est optionnelle pour faire tourner l'app en dev : sans `STRIPE_SECRET_KEY`/`STRIPE_PRICE_*`/`STRIPE_WEBHOOK_SECRET`, tout utilisateur reste sur l'essai gratuit (5 scripts à vie) et les routes `/api/billing/*` échouent explicitement si sollicitées. Pour tester le flux complet en local : `stripe listen --forward-to localhost:3000/api/billing/webhook` (Stripe CLI) fournit le `STRIPE_WEBHOOK_SECRET` à utiliser. Voir `docs/TECH.md` §6.

## Documentation projet

- `docs/PRODUCT.md` — vision produit et fonctionnalités, à jour.
- `docs/ARCHITECTURE_VERTICALES.md` — comment le cœur se décline en verticales métier (dev, artisan, entrepreneur) : options tranchées, registre de connecteurs de matière et onboarding déclaratif. Chantiers 1 à 3 implémentés ; le 4 est une règle permanente — **une verticale n'ajoute pas de table et ne partitionne pas le modèle de données**, gardée par `src/db/schemaInvariants.test.ts`. Migration `0027` (renommage `onboarding_track` → `vertical`) écrite à la main, appliquée et vérifiée en base de dev.
- `docs/TECH.md` — scope technique à jour : stack, modèle de données, endpoints, architecture des prompts.
- `docs/BRIEF.md` / `docs/SPEC_POC.md` — cadrage initial de la phase POC, conservés comme archive historique (ne plus mettre à jour).
- `docs/SPEC_SERIES_ET_ROLES.md` — la série est le seul objet éditorial manipulé, la catégorie est un « rôle » (unique par série, ou porté par un post libre). Modèle de données inchangé, UX recadrée. Implémenté (Lots 0-4), migration de données appliquée en dev.
- `docs/SPEC_RESSOURCES_VISUELLES.md` — cadrage de la bibliothèque de ressources visuelles / génération d'images, implémentée côté code, pas encore vérifiée en environnement réel.
- `docs/SETUP_RESSOURCES_VISUELLES.md` — comptes/clés externes à créer (Cloudflare R2, Google Cloud) pour que cette feature fonctionne.
- `docs/SPEC_ASSISTANT_AGENTIQUE.md` — l'assistant éditorial devient un « rédacteur en chef assistant » outillé : lecture de toute l'app, écriture sur tout sauf scripts et calendrier, toujours via propositions à valider. Suppose une primitive `callAgentic` (multi-tours, N tools) qui n'existe pas encore, écrite pour le seul adaptateur OpenAI — l'assistant sortira donc de `LLM_PROVIDER` et exigera `OPENAI_API_KEY`, comme la génération d'images et le captioning vision le font déjà pour Gemini. Implémenté (lots 0-4), non testé avec une vraie clé.
- `docs/superpowers/specs/2026-08-31-onboarding-dev-github-design.md` — onboarding développeur : identité GitHub, dépôts publics comme sujets, `.md` et journal de commits ingérés comme matière. Implémenté ; migration `0026` appliquée en base de dev (vérifié le 2026-09-09), mais le trajet OAuth réel reste à valider manuellement (checklist en fin de `docs/superpowers/plans/2026-08-31-onboarding-dev-github.md`).
