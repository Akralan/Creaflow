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

Le captioning vision des photos passe **toujours** par Gemini, quel que soit `LLM_PROVIDER` —
`GEMINI_API_KEY` doit donc être renseignée même si vous utilisez `anthropic` ou `groq` comme
provider de génération de scripts. (La génération d'image Nano Banana a été retirée,
`docs/SPEC_COMPOSITION_VISUELLE.md`.)

```
GEMINI_API_KEY=...
```

Les **embeddings** de la bibliothèque visuelle ne passent plus par Gemini : ils utilisent OpenAI
(`OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`, 768 dimensions), le modèle
`text-embedding-004` ayant été retiré côté Google — voir `docs/SPEC_RESSOURCES_VISUELLES.md` §8.4.
Cette clé est de toute façon requise par l'assistant éditorial. Seul le captioning vision reste
chez Gemini.

---

## 4 bis. Détourage des photos (optionnel) — Photoroom

Le détourage (`docs/SPEC_COMPOSITION_VISUELLE.md` §2) isole le sujet d'une photo sur fond
transparent, pour le poser sur un fond de marque dans la maquette. Il passe par l'API Photoroom
derrière un adaptateur ; sans ces variables, la fonction est simplement absente (pas de bascule
« détourée », l'agent ne la propose pas), tout le reste fonctionne.

1. Créer un compte sur photoroom.com, puis une clé API (API → Basic plan). Tarif : **0,02 $ par
   image** ; chaque photo n'est détourée qu'une seule fois (PNG mis en cache sur R2).
2. En développement, préfixer la clé par `sandbox_` : appels gratuits (100 par jour), image avec
   filigrane.

```
BACKGROUND_REMOVAL_PROVIDER=photoroom
PHOTOROOM_API_KEY=sandbox_xxxxxxxxxxxx
```

---

## 5. Vérification rapide une fois tout renseigné

1. `npm run db:migrate` — doit passer sans erreur `extension "vector" n'est pas disponible`.
2. `npm run dev`, se connecter, aller dans **Paramètres → Ressources visuelles** : le bouton *Importer depuis Google Drive* doit ouvrir une popup Google (pas d'erreur "Google Picker n'est pas configuré").
3. Uploader une photo directement (glisser-déposer) : elle doit apparaître tout de suite en grille avec le statut *Analyse en cours…*, puis basculer sur l'image quelques secondes après (captioning + embedding via `after()`).
4. Générer un post visuel depuis le calendrier : la fiche s'ouvre avec « Composition en cours… », puis la maquette apparaît avec la photo suggérée. Dans la bibliothèque, *Détourer* sur une photo doit afficher le sujet sur damier (si Photoroom est configuré).
