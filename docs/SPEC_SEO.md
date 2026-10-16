# SPEC — RÉFÉRENCEMENT ET APERÇUS DE LIENS

Ce qu'il manquait pour que le site existe aux yeux des moteurs de recherche et des messageries, et
comment c'est réglé. Constat du 2026-10-16 sur le site en ligne : la page d'accueil arrivait vide
(aucun titre, aucun texte), pas de `robots.txt`, pas de `sitemap.xml`, un seul titre « CreaFlow »
pour toutes les pages, aucune balise Open Graph, aucune image de partage.

Le cœur du problème n'était pas l'absence de fichiers mais la façon dont la landing était rendue :
un composant client qui affichait un écran vide le temps de demander à l'API si le visiteur était
connecté. Google exécute le JavaScript, tard et sans garantie ; WhatsApp, LinkedIn, Slack, iMessage
ne l'exécutent pas du tout.

---

## 1. La landing arrive complète dans le HTML

`src/app/page.tsx` devient un composant serveur. Il lit le cookie de session côté serveur
(`resolveSignedInDestination`, `src/lib/auth/entry.ts`) : un utilisateur connecté est redirigé vers
`/calendar` s'il a un profil, `/onboarding` sinon ; tout le monde d'autre reçoit la landing entière,
titres et texte compris. Le composant `LandingPage` et ses enfants ne changent pas : ce sont des
composants client, Next les rend côté serveur comme avant, ils s'animent ensuite.

Toute erreur dans cette vérification (base injoignable, cookie d'une version précédente sans
`AUTH_SECRET`) retombe sur la landing, journalisée en avertissement. L'ancien comportement laissait
un écran blanc dans ce cas.

Effet de bord assumé : la page d'accueil est rendue à chaque requête (lecture de cookie) et non
prérendue au build. Une requête légère, le même prix que n'importe quelle route authentifiée.

---

## 2. Métadonnées et image de partage

Tout vit dans `src/lib/seo.ts` (nom du site, titre, description, adresse publique, règle
d'indexation) et dans le layout racine :

- **Titre** : `CreaFlow — Vos notes de travail deviennent vos posts` sur l'accueil, et
  `<Page> · CreaFlow` ailleurs via le gabarit de titre. Les pages légales et les écrans d'entrée
  (connexion, onboarding, réinitialisation) déclarent leur titre.
- **Open Graph et Twitter** : type, langue, nom du site, titre, description, URL. Les balises
  `twitter:*` héritent des `og:*`, seule la carte (`summary_large_image`) est précisée.
- **Image de partage** : `src/app/opengraph-image.tsx`, 1200 × 630, générée au build par
  `ImageResponse` à partir du même dessin que le favicon (`icon0.svg`) et des deux polices de la
  landing (`src/assets/fonts/*.ttf`, licence OFL — Satori ne lit ni `next/font` ni le système).
  Next la relie seul dans `og:image` et `twitter:image` de toutes les pages.
- **Canonical** : `/` sur l'accueil, leur propre chemin sur les pages légales. Rendu absolu par
  `metadataBase`.
- **Pages jamais indexées** (`NO_INDEX` : `noindex, nofollow`) : tout le groupe `(app)` via un layout
  serveur qui enveloppe l'ancien layout client (déplacé dans `src/components/AppShell.tsx`),
  connexion, onboarding, réinitialisation. Ces pages se rendent vides sans session ; le dire
  explicitement évite qu'une URL vue ailleurs finisse indexée avec un titre et rien derrière.

---

## 3. robots.txt, sitemap.xml et la règle d'indexation

- `src/app/robots.ts` et `src/app/sitemap.ts` (conventions Next, servis sur `/robots.txt` et
  `/sitemap.xml`). Le sitemap ne liste que les quatre pages publiques : accueil et les trois pages
  légales. Le robots interdit l'API, l'app connectée et les écrans d'entrée.
- **Un déploiement n'est indexable que s'il le mérite** (`isIndexable`) : `SEO_INDEXABLE=true|false`
  tranche ; sinon, oui seulement si `APP_URL` est en https sur un domaine qui n'est ni local ni un
  hôte de démo (`*.vps.ovh.ca`, `*.vps.ovh.net`, `*.sslip.io`, `*.nip.io`). Sur un déploiement non
  indexable, `robots.txt` interdit tout et le layout racine pose `noindex` partout. Raison : le site
  tourne aujourd'hui sur le nom d'hôte OVH ; s'il était indexé, le vrai domaine hériterait d'un
  doublon le jour où il arrive. Testé dans `src/lib/seo.test.ts`.
- **Lu au build.** Robots, sitemap, image Open Graph et pages légales sont prérendus : c'est la valeur
  de `APP_URL` et `SEO_INDEXABLE` présente au moment du `next build` qui compte. D'où leur ajout aux
  `build.args` du `Dockerfile` et de `docker-compose.prod.yml` (`docs/DEPLOIEMENT_VPS.md` §4). Les
  changer demande un `deploy/update.sh`, pas un simple redémarrage.

---

## 4. Ce qui n'est pas dans ce chantier

- **Données structurées** (JSON-LD Organization / SoftwareApplication) : utile une fois l'entité
  éditrice arrêtée dans `src/lib/legal/publisher.ts`, pas avant.
- **Performance de la landing** : neuf polices Google chargées par le layout racine (dont six pour
  l'éditeur de maquettes), lourd pour une page d'accueil. À déplacer vers le groupe `(app)` dans un
  chantier à part ; sans effet sur l'indexation, avec effet sur la vitesse perçue.
- **Search Console / Bing Webmaster** : à déclarer quand le vrai domaine existe ; le sitemap est prêt.
- **Pages de contenu** (blog, pages par verticale) : le vrai levier de trafic organique, hors sujet
  ici — le chantier rend le site lisible, il ne lui donne pas de matière.

---

## Statut

Implémenté et mergé sur `main` le 2026-10-16. Déployé sur le VPS de démo, qui reste volontairement non indexable
(hôte OVH) : on y vérifie l'image de partage, les balises et le HTML complet de la landing, pas
l'indexation elle-même.
