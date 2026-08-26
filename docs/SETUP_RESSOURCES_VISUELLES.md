# CONFIGURATION EXTERNE — RESSOURCES VISUELLES

Guide pratique des comptes/clés à créer côté vous pour que la bibliothèque de ressources visuelles
(`docs/SPEC_RESSOURCES_VISUELLES.md`) fonctionne en local ou en prod. Le code est prêt et n'attend
que ces variables d'environnement (`.env.example` en liste la forme finale).

---

## 1. Cloudflare R2 (stockage des vignettes + images générées)

1. Créer un compte Cloudflare si besoin, puis dans le dashboard : **R2 Object Storage** → *Create bucket*. Nom suggéré : `creaflow-assets` (peu importe, à reporter dans `R2_BUCKET`).
2. **R2 → Manage API Tokens → Create API Token** : autorisations *Object Read & Write*, restreint à ce bucket si possible.
   - Le token donne `R2_ACCESS_KEY_ID` et `R2_SECRET_ACCESS_KEY`.
3. **Endpoint S3-compatible** : visible sur la page du bucket, forme `https://<account_id>.r2.cloudflarestorage.com` → `R2_ENDPOINT`.
4. **Accès public en lecture** (nécessaire : l'app sert les vignettes/images générées par URL directe, jamais par URL signée) :
   - Bucket → **Settings → Public access** → activer un domaine public (sous-domaine `r2.dev` fourni gratuitement par Cloudflare, ou domaine personnalisé).
   - L'URL de base obtenue (ex. `https://pub-xxxx.r2.dev`) → `R2_PUBLIC_BASE_URL`.

```
STORAGE_PROVIDER=r2
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_BUCKET=creaflow-assets
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
```

---

## 2. Google Cloud (Picker + connexion Drive)

1. [console.cloud.google.com](https://console.cloud.google.com) → créer un projet (ou réutiliser un projet existant du produit).
2. **APIs & Services → Library** → activer deux APIs :
   - **Google Picker API**
   - **Google Drive API**
3. **APIs & Services → OAuth consent screen** :
   - Type *External* (sauf Google Workspace interne).
   - Scope à ajouter : `https://www.googleapis.com/auth/drive.file` — scope non sensible (§3.2 du cadrage), pas de vérification CASA requise.
   - Tant que l'app n'est pas publiée, seuls les comptes ajoutés en *Test users* pourront se connecter — pensez à vous y ajouter pour tester.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** :
   - Type *Web application*.
   - *Authorized JavaScript origins* : `http://localhost:3000` (dev) + votre domaine de prod.
   - Pas besoin de renseigner d'URI de redirection (le flow utilisé est un popup, pas une redirection serveur classique).
   - Donne `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (le "Client ID") et `GOOGLE_CLIENT_SECRET` (le "Client Secret").
5. **APIs & Services → Credentials → Create Credentials → API key** :
   - Restreindre la clé à l'API *Google Picker API* uniquement (Application restrictions → HTTP referrers = mêmes origines qu'à l'étape 4).
   - Donne `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`.

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=...
```

---

## 3. Extension PostgreSQL `pgvector`

Nécessaire avant `npm run db:migrate` (la migration `drizzle/0007_flippant_triton.sql` active
l'extension elle-même via `CREATE EXTENSION IF NOT EXISTS vector`, mais l'extension doit être
**installable** sur le serveur Postgres cible — voir `drizzle/README_PGVECTOR.md` pour le détail et
les pistes selon votre hébergement (Postgres local, Docker, Neon/Supabase/RDS...).

---

## 4. Clé Gemini (déjà couverte si `LLM_PROVIDER=gemini`)

Le captioning, les embeddings et la génération d'image (Nano Banana) passent **toujours** par
Gemini, quel que soit `LLM_PROVIDER` — `GEMINI_API_KEY` doit donc être renseignée même si vous
utilisez `anthropic` ou `groq` comme provider de génération de scripts.

```
GEMINI_API_KEY=...
GEMINI_IMAGE_MODEL=gemini-3-pro-image
```

Les **embeddings** de la bibliothèque visuelle ne passent plus par Gemini : ils utilisent OpenAI
(`OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`, 768 dimensions), le modèle
`text-embedding-004` ayant été retiré côté Google — voir `docs/SPEC_RESSOURCES_VISUELLES.md` §8.4.
Cette clé est de toute façon requise par l'assistant éditorial. Seuls le captioning vision et la
génération d'images restent chez Gemini.

---

## 5. Vérification rapide une fois tout renseigné

1. `npm run db:migrate` — doit passer sans erreur `extension "vector" n'est pas disponible`.
2. `npm run dev`, se connecter, aller dans **Paramètres → Ressources visuelles** : le bouton *Importer depuis Google Drive* doit ouvrir une popup Google (pas d'erreur "Google Picker n'est pas configuré").
3. Uploader une photo directement (glisser-déposer) : elle doit apparaître tout de suite en grille avec le statut *Analyse en cours…*, puis basculer sur l'image quelques secondes après (captioning + embedding via `after()`).
4. Depuis une fiche script `visual`, cliquer *Générer le visuel*, sélectionner une photo, décrire une mise en scène : l'image produite doit s'afficher sur la fiche.
