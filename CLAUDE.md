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

La facturation self-service (Stripe) est optionnelle pour faire tourner l'app en dev : sans `STRIPE_SECRET_KEY`/`STRIPE_PRICE_*`/`STRIPE_WEBHOOK_SECRET`, tout utilisateur reste sur l'essai gratuit (5 scripts à vie) et les routes `/api/billing/*` échouent explicitement si sollicitées. Pour tester le flux complet en local : `stripe listen --forward-to localhost:3000/api/billing/webhook` (Stripe CLI) fournit le `STRIPE_WEBHOOK_SECRET` à utiliser. Voir `docs/TECH.md` §6.

## Documentation projet

- `docs/PRODUCT.md` — vision produit et fonctionnalités, à jour.
- `docs/TECH.md` — scope technique à jour : stack, modèle de données, endpoints, architecture des prompts.
- `docs/BRIEF.md` / `docs/SPEC_POC.md` — cadrage initial de la phase POC, conservés comme archive historique (ne plus mettre à jour).
- `docs/SPEC_RESSOURCES_VISUELLES.md` — cadrage de la bibliothèque de ressources visuelles / génération d'images, implémentée côté code, pas encore vérifiée en environnement réel.
- `docs/SETUP_RESSOURCES_VISUELLES.md` — comptes/clés externes à créer (Cloudflare R2, Google Cloud) pour que cette feature fonctionne.
