# pgvector — note sur la migration `0007_flippant_triton.sql`

Cette migration introduit `brand_assets.embedding` (`vector(768)`) et son index HNSW. Contrairement aux
autres migrations, `drizzle-kit generate` ne sait pas produire `CREATE EXTENSION` ni un index HNSW —
ces deux instructions ont été **ajoutées à la main** dans le fichier SQL généré (début et fin du
fichier), afin que `npm run db:migrate` reste la seule commande à lancer, sans étape manuelle séparée.

Prérequis côté serveur Postgres : l'extension `pgvector` doit être **installée** sur le serveur avant
de lancer `npm run db:migrate`. Si `CREATE EXTENSION IF NOT EXISTS vector;` échoue (`extension "vector"
n'est pas disponible`), c'est un blocant d'infra à lever **avant** — pas un bug de la migration
elle-même. Selon l'environnement :

- **Provider géré** (Neon, Supabase, RDS...) : activer l'extension depuis leurs paramètres, rien à
  installer.
- **Docker** : utiliser l'image `pgvector/pgvector` au lieu de `postgres` — l'extension est déjà dedans.
- **Postgres natif Windows (ce poste)** : voir ci-dessous.

---

## Installer pgvector sur un Postgres Windows natif (installeur EDB)

Diagnostic pour ce poste (`C:\Program Files\PostgreSQL\17`, PostgreSQL 17.5) : pas de compilateur MSVC
détecté (`cl.exe`/`nmake.exe` absents), donc l'extension n'est pas installable telle quelle — deux
options.

### Option A — Recommandée : basculer sur Docker pour la base de dev

Le plus simple : évite complètement le problème de compilateur, l'image officielle inclut déjà
pgvector précompilé. Nécessite Docker Desktop installé.

```powershell
docker run -d --name creaflow-postgres `
  -e POSTGRES_USER=creaflow `
  -e POSTGRES_PASSWORD=<choisis un mot de passe> `
  -e POSTGRES_DB=creaflow_poc `
  -p 5433:5432 `
  pgvector/pgvector:pg17
```

Puis dans `.env`, pointe `DATABASE_URL` sur ce conteneur (port `5433` choisi ci-dessus pour ne pas
entrer en conflit avec le Postgres natif qui écoute déjà sur `5432`) :

```
DATABASE_URL=postgres://creaflow:<le mot de passe choisi>@localhost:5433/creaflow_poc
```

⚠️ C'est une base **vide** : `npm run db:migrate` rejouera les 8 migrations depuis le début (rapide,
schéma seul) mais les données du Postgres natif actuel ne sont pas transférées automatiquement. Pour
une base de dev/POC c'est généralement sans enjeu ; sinon, exporter/importer via `pg_dump`/`pg_restore`
avant de basculer.

Une fois lancé : `npm run db:migrate`.

### Option B — Installer pgvector nativement dans ce Postgres 17 (garde la base actuelle)

Demande d'installer un compilateur C (Visual Studio Build Tools, gratuit, ~3 Go). Plus long que
l'option A mais ne touche pas à la base existante.

1. **Installer Visual Studio Build Tools** : https://visualstudio.microsoft.com/visual-cpp-build-tools/
   — à l'installation, cocher le workload **"Développement Desktop en C++"**.
2. Depuis le menu Démarrer, ouvrir **"x64 Native Tools Command Prompt for VS 2022"** — **pas** un
   PowerShell ou cmd normal, cette invite spécifique configure les variables d'environnement MSVC
   nécessaires à la compilation. Lancer cette invite **en tant qu'administrateur** (clic droit →
   Exécuter en tant qu'administrateur) : l'étape d'installation ci-dessous écrit dans
   `C:\Program Files\PostgreSQL\17\`, ce qui requiert des droits admin.
3. Dans cette invite :
   ```
   set "PGROOT=C:\Program Files\PostgreSQL\17"
   git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
   cd pgvector
   nmake /f Makefile.win
   nmake /f Makefile.win install
   ```
   (vérifier sur https://github.com/pgvector/pgvector/releases si une version plus récente que
   `v0.8.0` est disponible et l'utiliser à la place — pgvector 0.8.x supporte Postgres 17.)
4. **Redémarrer le service PostgreSQL** pour qu'il prenne en compte la nouvelle extension :
   ```
   net stop postgresql-x64-17
   net start postgresql-x64-17
   ```
   (toujours dans l'invite admin — ou via `services.msc`, clic droit sur "postgresql-x64-17" →
   Redémarrer).
5. Retour dans le projet : `npm run db:migrate`.

### Vérifier que l'installation a fonctionné

Dans les deux cas, une fois `npm run db:migrate` lancé sans erreur, vérifier que la migration `0008`
(métriques automatiques, indépendante de pgvector mais bloquée derrière `0007` dans l'ordre des
migrations) est bien appliquée aussi :

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql" -U creaflow -d creaflow_poc -c "\dx vector"
& "C:\Program Files\PostgreSQL\17\bin\psql" -U creaflow -d creaflow_poc -c "\dt post_metrics_snapshots"
```

La première commande doit lister l'extension `vector` ; la seconde doit trouver la table
`post_metrics_snapshots` (nouvelle, feature de récupération automatique des métriques,
`docs/SPEC_METRIQUES_AUTO.md`).
