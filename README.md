# CreaFlow

Application Next.js de production éditoriale pour les réseaux sociaux : l'onboarding cerne la marque
et ses sujets, un « rédacteur en chef » planifie des séries de contenus, et l'app génère les scripts
puis les place dans un calendrier.

## Démarrage rapide

Prérequis : **Node 20+** et **Docker Desktop** (démarré).

```bash
npm install
npm run setup
npm run dev
```

`npm run setup` fait tout le reste : il crée le `.env` à partir de `.env.example` (avec un
`AUTH_SECRET` généré), démarre la base Postgres du `docker-compose.yml`, attend qu'elle réponde et
applique les migrations. Il est relançable sans risque — un `.env` existant n'est jamais écrasé.

L'app tourne ensuite sur http://localhost:3000.

### Une clé LLM est nécessaire — OpenAI pour l'instant

Sans clé, l'app démarre mais l'onboarding ne peut rien générer — donc rien à tester. Deux lignes à
renseigner dans `.env` :

```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

> **Seul OpenAI fonctionne aujourd'hui.** `LLM_PROVIDER` accepte aussi `gemini`, `anthropic` et
> `groq` : ces providers existent dans le code mais ne sont pas opérationnels, ne pas compter dessus
> pour faire tourner l'app.

Tout le reste de `.env.example` est optionnel : sans les clés OAuth (TikTok, Instagram, LinkedIn,
GitHub), sans Stripe, sans stockage R2, l'app fonctionne — seules les fonctionnalités concernées sont
inactives ou masquées. La bibliothèque de ressources visuelles, elle, exige R2 + Google Cloud
(`docs/SETUP_RESSOURCES_VISUELLES.md`).

## La base de données

Le `docker-compose.yml` lance l'image **`pgvector/pgvector:pg17`**, et non une image Postgres nue :
la migration `0007` crée l'extension `vector` (embeddings de la bibliothèque visuelle). Le port hôte
est **5433** pour cohabiter avec un Postgres déjà installé sur la machine.

```bash
docker compose up -d     # démarrer la base
docker compose down      # l'arrêter (les données sont conservées dans un volume)
docker compose down -v   # tout supprimer, y compris les données
```

Pour utiliser un Postgres déjà installé plutôt que Docker : il lui faut l'extension pgvector (voir
`drizzle/README_PGVECTOR.md`), puis il suffit de pointer `DATABASE_URL` dessus et de lancer
`npm run db:migrate`.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run setup` | Premier lancement : `.env`, base Docker, migrations |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm run start` | Build de production / lancement |
| `npm run lint` | ESLint |
| `npm run test` | Suite Vitest (logique pure, appels LLM mockés, aucune base requise) |
| `npm run db:generate` | Génère une migration SQL à partir de `src/db/schema.ts` |
| `npm run db:migrate` | Applique les migrations en attente sur `DATABASE_URL` |
| `npm run db:studio` | Ouvre Drizzle Studio pour inspecter la base |

## Documentation

- `docs/PRODUCT.md` — vision produit et fonctionnalités.
- `docs/TECH.md` — stack, modèle de données, endpoints, architecture des prompts.
- `docs/` — les specs par chantier (séries et rôles, rédacteur en chef, assistant agentique,
  ressources visuelles, onboarding développeur).
