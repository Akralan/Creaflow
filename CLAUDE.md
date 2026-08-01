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

Copier `.env.example` vers `.env` et renseigner au minimum `DATABASE_URL` (PostgreSQL local) et `ANTHROPIC_API_KEY` pour que l'app démarre. Les credentials OAuth (TikTok/Instagram/LinkedIn) ne sont nécessaires que pour tester la connexion des comptes sociaux (Module A).

## Documentation projet

- `docs/BRIEF.md` — vision produit et fonctionnalités.
- `docs/SPEC_POC.md` — scope technique : stack, modèle de données, endpoints, architecture des prompts.
