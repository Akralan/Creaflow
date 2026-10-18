# DÉPLOIEMENT — TOUT SUR UN VPS

Guide pas à pas pour mettre CreaFlow en ligne sur un seul serveur loué (Hetzner, OVH, Scaleway…) :
la landing, l'app Next.js et la base Postgres sur la même machine, derrière un reverse proxy HTTPS.
Le code est prêt ; ce document et les fichiers qu'il décrit sont la seule chose qui manquait.

Fichiers concernés, tous à la racine du dépôt sauf mention :

| Fichier | Rôle |
| --- | --- |
| `Dockerfile` | Image de l'app (`next build` en mode standalone), trois étapes |
| `.dockerignore` | Ce qui n'entre pas dans l'image : `.env`, `node_modules`, docs… |
| `docker-compose.prod.yml` | La pile : Postgres (pgvector), app, Caddy, et le conteneur `migrate` |
| `deploy/Caddyfile` | Reverse proxy, HTTPS automatique |
| `deploy/env.production.example` | Modèle du `.env` de production |
| `deploy/update.sh` | Mise à jour en une commande (pull, build, migrations, relance) |
| `deploy/backup.sh` | Sauvegarde nocturne de la base vers un bucket R2 privé |

Le `docker-compose.yml` sans suffixe reste celui du poste de dev et n'est pas touché.

---

## 0. Les choix faits, et pourquoi

- **Un seul serveur, Docker Compose.** L'app n'a ni cron, ni file d'attente, ni écriture sur
  disque : un Node et un Postgres suffisent. Compose est déjà la façon de lancer la base en dev.
- **Postgres sur le VPS**, pas chez un hébergeur de base. C'est l'option la moins chère et la plus
  simple à exploiter avec une sauvegarde nocturne (§7). La variante Neon est décrite en §9.
- **Caddy** comme reverse proxy : certificat Let's Encrypt obtenu et renouvelé sans rien
  configurer, `X-Forwarded-For` posé d'office (le rate limiting par IP en dépend, `docs/TECH.md`
  §7). Les en-têtes de sécurité restent émis par l'app (`next.config.ts`).
- **Image Debian slim**, pas Alpine : `sharp` et `pg` fournissent des binaires glibc précompilés,
  aucune compilation sur le serveur.
- **Migrations depuis un conteneur jetable** (`migrate`), construit sur l'étape `builder` du
  Dockerfile : c'est la seule qui contient `drizzle-kit` et le dossier `drizzle/`. Postgres n'est
  jamais exposé sur Internet, on ne lance donc pas les migrations depuis son poste.
- **Build sur le VPS**, depuis le dépôt cloné. Pas de registre d'images, pas de CI : une machine,
  un `git pull`, un `docker compose build`. Trois variables `NEXT_PUBLIC_*` et `R2_PUBLIC_BASE_URL`
  sont figées dans le bundle au build ; les changer impose un rebuild (`deploy/update.sh` le fait).
- **Landing dans l'app**, même domaine. La séparer sur un hébergeur statique est un autre chantier
  (liens relatifs, boutons OAuth, pages légales) qui n'apporte rien tant qu'un seul serveur tient
  la charge.

---

## 1. Prérequis

- Un VPS **Debian 12** ou **Ubuntu 24.04**, 2 vCPU et 4 Go de RAM (le build Next.js est ce qui
  consomme le plus ; 2 Go passent mais le build peut échouer par manque de mémoire). 40 Go de disque.
- Un **nom de domaine** avec un enregistrement `A` (et `AAAA` si le VPS a une IPv6) pointant sur
  l'IP du serveur, par exemple `app.exemple.fr`. Le certificat ne peut pas être émis avant que le
  DNS ne soit propagé.
- Les **clés des services** que l'on veut activer dès le départ. Rien n'est obligatoire pour que la
  landing s'affiche et que des comptes se créent (§4 détaille le minimum). Les guides existants
  couvrent chaque service : `docs/SETUP_EMAILS_BREVO.md`, `docs/SETUP_RESSOURCES_VISUELLES.md`,
  `docs/TECH.md` §6 (Stripe) et §8 (GitHub, Notion, Linear).
- Pour les sauvegardes : un compte Cloudflare R2 (le même que pour la bibliothèque visuelle) et un
  **second bucket, privé**, par exemple `creaflow-backups`.

---

## 2. Préparer le serveur

Connecté en `root` (ou avec `sudo`) sur le VPS neuf :

```bash
# 1. Mises à jour et outils de base
apt update && apt upgrade -y
apt install -y git ufw

# 2. Un utilisateur non-root qui portera l'app
adduser --disabled-password --gecos "" creaflow
usermod -aG sudo creaflow
mkdir -p /home/creaflow/.ssh && cp ~/.ssh/authorized_keys /home/creaflow/.ssh/ \
  && chown -R creaflow:creaflow /home/creaflow/.ssh && chmod 700 /home/creaflow/.ssh

# 3. Pare-feu : SSH, HTTP, HTTPS, rien d'autre
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp   # HTTP/3
ufw --force enable

# 4. Docker (script officiel) et droit d'usage pour l'utilisateur
curl -fsSL https://get.docker.com | sh
usermod -aG docker creaflow
```

Se reconnecter ensuite en `creaflow` (`ssh creaflow@IP`). Vérifier : `docker compose version` doit
répondre sans `sudo`.

Désactiver la connexion SSH par mot de passe si l'hébergeur ne l'a pas déjà fait
(`PasswordAuthentication no` dans `/etc/ssh/sshd_config`, puis `sudo systemctl restart ssh`).

---

## 3. Récupérer le code

```bash
sudo mkdir -p /opt/creaflow && sudo chown creaflow:creaflow /opt/creaflow
git clone https://github.com/<compte>/<depot>.git /opt/creaflow
cd /opt/creaflow
chmod +x deploy/*.sh
```

Si le dépôt est privé, créer une **deploy key** en lecture seule : `ssh-keygen -t ed25519 -f
~/.ssh/creaflow_deploy -N ""`, coller la clé publique dans GitHub > Settings du dépôt > Deploy keys,
et cloner avec l'URL SSH. Un `~/.ssh/config` avec `IdentityFile ~/.ssh/creaflow_deploy` pour
`Host github.com` évite d'avoir à le préciser à chaque `git pull`.

On déploie toujours **`main`**. Les branches de chantier ne vont jamais sur le serveur.

---

## 4. Le `.env` de production

```bash
cp deploy/env.production.example .env
chmod 600 .env
openssl rand -hex 24   # → POSTGRES_PASSWORD
openssl rand -hex 32   # → AUTH_SECRET
nano .env
```

Le fichier est commenté bloc par bloc. Ce qui est **obligatoire** pour que la landing s'affiche et
que des comptes se créent :

| Variable | Valeur |
| --- | --- |
| `APP_DOMAIN` | `app.exemple.fr` — sans `https://`, c'est Caddy qui le lit |
| `APP_URL` | `https://app.exemple.fr` — liens d'email, retours Stripe et OAuth |
| `POSTGRES_PASSWORD` | le premier `openssl rand` |
| `DATABASE_URL` | `postgres://creaflow:<POSTGRES_PASSWORD>@postgres:5432/creaflow` — **recopier** le mot de passe, Compose n'interpole pas dans ce fichier |
| `AUTH_SECRET` | le second `openssl rand` |
| `EMAIL_PROVIDER` | `console` tant qu'il n'y a pas de clé Brevo, **écrit explicitement** : en production l'app refuse de deviner (`docs/SETUP_EMAILS_BREVO.md` §0) |

Et pour que les comptes créés servent à quelque chose : `OPENAI_API_KEY` (génération de scripts,
assistant). Tout le reste s'ajoute plus tard, variable par variable, sans toucher au reste. Une
fonctionnalité dont la clé manque échoue à l'appel avec un message explicite ; la landing et les
comptes ne sont jamais affectés.

Six variables sont **figées au build** et demandent un `deploy/update.sh` (ou un `build`) quand
elles changent : `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`,
`NEXT_PUBLIC_SENTRY_DSN`, `R2_PUBLIC_BASE_URL` (celle-ci entre dans la CSP), et `APP_URL` avec
`SEO_INDEXABLE` (robots, sitemap, image de partage et canonical sont prérendus,
`docs/SPEC_SEO.md` §3). Toutes les autres sont lues à l'exécution : un `docker compose up -d`
suffit après modification.

Le `.env` ne quitte jamais le serveur : il est exclu de l'image Docker (`.dockerignore`) et du dépôt
(`.gitignore`).

---

## 5. Premier démarrage

```bash
cd /opt/creaflow
docker compose -f docker-compose.prod.yml --profile tools build      # 3 à 6 minutes la première fois
docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose -f docker-compose.prod.yml up -d
```

> **À prévoir pour le prochain déploiement (branche `feature/app-design-tellovo`, 2026-10-18)** : migrations `0047` à `0050` (parcours `/start`, quota en semaines, créneaux en chargement, animations) ; variables `OPENAI_API_KEY` (génération, vision), `GITHUB_TOKEN` (lecture des dépôts publics, sans droit) et `START_DAILY_CAP` ; `EMAIL_LOG_LINKS=1` tant qu'aucun service d'envoi n'est branché (`URGENT.md`) ; les polices des animations sont dans `src/assets/fonts/design` (incluses dans la sortie autonome par `outputFileTracingIncludes`, à vérifier sur la première image construite). Voir aussi `deploy/env.production.example`.

Dans l'ordre : construire les images, démarrer la base seule, appliquer les 36 migrations (dont
`0007` qui active pgvector, déjà présent dans l'image), puis lancer l'app et Caddy.

Vérifier :

```bash
docker compose -f docker-compose.prod.yml ps        # trois services "running", app "healthy" après ~20 s
docker compose -f docker-compose.prod.yml logs -f caddy   # "certificate obtained successfully"
curl -I https://app.exemple.fr                      # HTTP/2 200, en-tête strict-transport-security
```

Puis dans un navigateur : la landing, créer un compte, se connecter. Si `OPENAI_API_KEY` est posée,
générer un premier script. Les logs de l'app : `docker compose -f docker-compose.prod.yml logs -f app`.

Si Caddy n'obtient pas de certificat : vérifier que le DNS répond bien l'IP du VPS (`dig +short
app.exemple.fr`) et que les ports 80 et 443 sont ouverts (`sudo ufw status`). Let's Encrypt limite
les tentatives ; attendre que le DNS soit bon avant de relancer.

Les scripts de migration de données écrits à la main pour la base de dev (`scripts/migrate-*.ts`)
n'ont rien à faire ici : une base neuve part directement du schéma à jour.

---

## 6. Mettre à jour

Après un merge sur `main` :

```bash
cd /opt/creaflow && ./deploy/update.sh
```

Le script enchaîne `git pull`, rebuild des images, migrations (avec l'ancienne version encore en
ligne), puis relance. Une migration qui échoue arrête tout et l'ancienne version continue de servir.
Coupure réelle : quelques secondes, le temps que le nouveau conteneur démarre.

Compose envoie `SIGTERM` et laisse 30 secondes (`stop_grace_period`) : Next termine les requêtes en
cours et les callbacks `after()` (composition automatique d'une maquette, apprentissage du style)
avant de s'arrêter.

---

## 7. Sauvegardes et restauration

`deploy/backup.sh` fait un `pg_dump` compressé et l'envoie dans le bucket R2 privé `BACKUP_BUCKET`
du `.env`. Rien à installer : `pg_dump` tourne dans le conteneur Postgres, l'envoi passe par
l'image `amazon/aws-cli`.

Tester une fois à la main, puis planifier :

```bash
./deploy/backup.sh
sudo touch /var/log/creaflow-backup.log && sudo chown creaflow /var/log/creaflow-backup.log
crontab -e
# ajouter :
30 3 * * * /opt/creaflow/deploy/backup.sh >> /var/log/creaflow-backup.log 2>&1
```

Côté R2, poser une **règle de cycle de vie** sur le bucket de sauvegarde (par exemple suppression
après 30 jours) pour que ça ne grossisse pas indéfiniment. Les 10 premiers Go de R2 sont gratuits.

**Restaurer** (sur un serveur neuf après les étapes 2 à 4, ou sur place) :

```bash
# récupérer le fichier voulu
docker run --rm -v "$PWD:/data" -e AWS_ACCESS_KEY_ID=... -e AWS_SECRET_ACCESS_KEY=... -e AWS_DEFAULT_REGION=auto \
  amazon/aws-cli s3 cp s3://creaflow-backups/creaflow-20261016-033000.sql.gz /data/ --endpoint-url https://<account>.r2.cloudflarestorage.com

docker compose -f docker-compose.prod.yml stop app
docker compose -f docker-compose.prod.yml exec -T postgres psql -U creaflow -d postgres \
  -c "DROP DATABASE creaflow;" -c "CREATE DATABASE creaflow;"
gunzip -c creaflow-20261016-033000.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U creaflow -d creaflow
docker compose -f docker-compose.prod.yml up -d app
```

Faire cette restauration **une fois pour de vrai** sur une base vide, avant d'avoir des utilisateurs :
une sauvegarde jamais restaurée n'est pas une sauvegarde.

Les vignettes et exports de la bibliothèque visuelle vivent déjà dans R2, pas sur le VPS : rien à
sauvegarder de ce côté.

---

## 8. Mettre à jour les adresses chez les tiers

Chaque service qui rappelle l'app a été configuré avec `http://localhost:3000` en dev. À refaire
avec le vrai domaine, une fois seulement :

| Service | Où | Valeur |
| --- | --- | --- |
| Stripe | Dashboard > Developers > Webhooks | `https://app.exemple.fr/api/billing/webhook`, puis copier le nouveau `STRIPE_WEBHOOK_SECRET` |
| GitHub | OAuth App > Authorization callback URL | `https://app.exemple.fr/api/auth/github/callback` (et `GITHUB_OAUTH_REDIRECT_URI` dans le `.env`) |
| Notion | Intégration publique > Redirect URIs | `https://app.exemple.fr/api/auth/oauth/notion/callback` |
| Linear | Application > Callback URLs | `https://app.exemple.fr/api/auth/oauth/linear/callback` |
| Google | Cloud Console > Identifiants OAuth > URIs de redirection | `https://app.exemple.fr/api/auth/youtube/callback` ; origine JavaScript autorisée `https://app.exemple.fr` pour le Picker |
| Brevo | Senders & Domains | le domaine d'envoi de `EMAIL_FROM` authentifié (`docs/SETUP_EMAILS_BREVO.md` §2) |

---

## 9. Variante : la base chez Neon

Si l'on préfère ne pas exploiter Postgres soi-même (sauvegardes et retour à un instant donné
inclus dans l'offre, gratuite jusqu'à 0,5 Go) :

1. Créer le projet Neon dans la région la plus proche du VPS (Francfort pour un serveur allemand),
   et activer l'extension `vector` dans ses paramètres, ou laisser la migration `0007` le faire :
   Neon l'autorise.
2. Dans le `.env`, mettre `DATABASE_URL` sur la chaîne **pooled** fournie par Neon (elle contient
   déjà `sslmode=require`). `POSTGRES_PASSWORD` devient inutile mais Compose l'exige : laisser une
   valeur quelconque, ou retirer le service `postgres` et les deux `depends_on` du compose.
3. `docker compose -f docker-compose.prod.yml --profile tools run --rm migrate` applique les
   migrations sur Neon exactement pareil.
4. Ne pas planifier `deploy/backup.sh`.

Ce que ça coûte : une latence réseau sur chaque requête authentifiée (l'app lit la base à chaque
appel pour valider la session), et le réveil de Neon après inactivité sur le plan gratuit.

---

## 10. Ce qui n'est pas couvert

- **Plusieurs instances** de l'app derrière un répartiteur : le rate limiting en Postgres tient,
  mais le cache Next.js et la clé de chiffrement des Server Actions demanderaient une configuration
  partagée (guide self-hosting de Next.js). Hors sujet tant qu'un serveur suffit.
- **Alerte si le serveur tombe.** Sentry voit les erreurs applicatives, pas une machine éteinte. Un
  moniteur externe gratuit (UptimeRobot, Better Stack…) qui appelle `https://app.exemple.fr/legal/cgu`
  toutes les cinq minutes comble ça en dix minutes de configuration.
- **Mises à jour du système.** `sudo apt update && sudo apt upgrade -y` une fois par mois, et
  `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`
  pour rafraîchir les images Postgres et Caddy. Changer de version majeure de Postgres n'est pas
  un simple `pull` : rester sur `pg17` tant qu'il n'y a pas de raison de bouger.
- **CDN ou landing séparée.** Cloudflare en DNS devant le VPS (mode proxy orange) ajoute un cache
  et une protection DDoS sans rien changer au code ; dans ce cas, mettre le mode SSL de Cloudflare
  sur « Full (strict) », Caddy ayant son propre certificat.

---

## Statut

Écrit et **déployé pour de vrai le 2026-10-16** sur un VPS OVH (Ubuntu 26.04, 2 vCPU, 4 Go) :
`https://vps-a004fa72.vps.ovh.ca`. Certificat obtenu du premier coup, 35 tables créées par les
migrations, création de compte et session vérifiées de bout en bout depuis l'extérieur. Écarts
avec le guide, assumés pour cette première mise en ligne :

- **Pas de nom de domaine acheté** : Caddy sert le nom d'hôte attribué par OVH au VPS
  (`vps-XXXX.vps.ovh.ca`), qui pointe déjà sur l'IP et pour lequel Let's Encrypt émet un vrai
  certificat. Le jour où un domaine arrive : changer `APP_DOMAIN` et `APP_URL` dans le `.env`,
  `docker compose -f docker-compose.prod.yml up -d`, et refaire le §8.
- **Utilisateur `ubuntu`** (celui d'OVH, sudo sans mot de passe) à la place d'un utilisateur
  `creaflow` dédié. Connexion par clé uniquement, mot de passe SSH désactivé
  (`/etc/ssh/sshd_config.d/99-creaflow-keys-only.conf`). Alias `ssh creaflow` sur le poste.
- **Branche déployée : `main`** depuis le merge du 2026-10-16 (les premières heures ont tourné sur
  la branche de chantier, le temps du merge). `./deploy/update.sh` suit `main`.
- **`.env` minimal** : aucune clé d'API. Landing, inscription et connexion marchent ; génération,
  photos, paiement et emails attendent leurs clés. `deploy/backup.sh` n'est pas planifié tant que
  R2 n'est pas configuré (`BACKUP_BUCKET` et les identifiants R2 manquent).
- Un redémarrage du serveur est en attente après la mise à jour du noyau (`/var/run/reboot-required`) ;
  les conteneurs reviennent seuls (`restart: unless-stopped`).
