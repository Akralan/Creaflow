# 02 — Le produit, tel qu'il est aujourd'hui

Ce document décrit ce que la personne voit et fait. Pour le « comment c'est fait », voir `03-architecture.md` et `04-ia-et-generation.md`.

## Le parcours en une image

```
Landing ──► /start ──► email ──► clic sur le lien ──► « Your content week »
 (repo)     (3 champs   (compte    (connexion sans      (relire, retoucher,
             + 3 jours)  créé,      mot de passe,        copier, « Ready »)
                         1er post   2 autres posts
                         écrit)     se génèrent)
```

## 1. Entrée : le repo (`/` puis `/start`)

1. Sur la landing, la personne colle le lien d'un **repo GitHub public**.
2. `/start` lit le repo (README, fichiers `.md`, journal de commits) sans connexion et un appel au modèle déduit **trois champs**, éditables : *What you're building*, *Who it's for*, *The problem you solve*.
3. Elle coche ses **jours de publication** (mer./ven./sam. par défaut) et donne son **email**.
4. Le compte est créé **sans mot de passe** et sans session. La génération part en fond (≈ 1 min 20 en dev) : matière → portrait des lecteurs → séries (la première est le **devlog**) → événements → forme de série → **un** post.
5. Un email envoie ce post et un **lien de connexion** (24 h, usage unique). Au clic, la personne est connectée et les **deux autres posts** de la semaine s'écrivent (créneaux « en chargement »).

Spec : `docs/SPEC_ENTREE_PAR_LE_REPO.md`.

**Parcours de repli** : `/onboarding` (six écrans : nom + quatre portes GitHub / Notion / Linear / « Coller mes notes », sources, lecture, profil et sujets, attentes, jours et réseaux). Il sert aux inscriptions qui ne viennent pas de la landing, et à brancher Notion/Linear/dépôts privés. Spec : `docs/SPEC_ONBOARDING_MVP.md`.

## 2. L'application (coque à trois entrées)

Menu latéral : **This week**, **Content plan**, **Business context**, et **Performance** juste dessous. Le menu du compte contient **Direction**, **Settings** et la déconnexion. L'**assistant** (chat) est **caché** (pas de menu) mais son code et sa route `/assistant` existent.

### This week — `/calendar` (« Your content week »)

- À gauche : les cartes des posts de la semaine (date, statut, titre, début du texte) et une carte pointillée « Next week ».
- À droite : le **post agrandi**, avec des **onglets LinkedIn / X** (deux textes différents pour le même événement).
- Retouche : trois puces (« Make it shorter », « Stronger hook », « More technical »), un champ libre, « Undo ». Actions : Edit, Copy, Source (les passages de la matière et « Why this angle »), **Mark as ready**.
- Une **bulle d'outils** : régénérer un bloc, « autre idée, même brief », supprimer, importer, et **choisir le visuel** du post (image, carrousel de 2 à 10 slides, animation de 5 à 15 s, ou aucun). Le visuel est commun aux deux réseaux.
- **Statuts** : Draft, Ready, **Posted**. Posted n'est jamais posé à la main : c'est le back-end (rattachement Performance) qui le pose.
- **« Prepare next week »** écrit la semaine suivante ; il consomme une semaine de quota. Quota atteint → modale de paiement (décor).
- Mobile : jours en pastilles en haut, script plein écran, actions en icônes.

### Content plan — `/plan`
Quatre semaines en lignes, jours remplis ou hachurés.

### Business context — `/context`
Fiche à trois champs (« Edit details »), état « Getting started » (sources connectées), liste des sources (GitHub, Notion, Linear, notes collées). Le panneau de matière donne accès à la **ligne de temps** des événements, corrigeable (on peut y ajouter un événement à la main).

### Performance — `/performance`
Un mois de posts LinkedIn et X, une semaine à la fois : impressions de la semaine avec écart sur la précédente, meilleur post, likes/commentaires/partages, liste côte à côte. X est lu par **Apify** à partir du pseudo saisi ; LinkedIn par l'API officielle (accès non obtenu). Un post repéré qui ressemble sans ambiguïté à un script est rattaché et passe en Posted. **N'a jamais été essayé avec un vrai compte.**

### Direction — `/direction`
La **série** est le seul objet éditorial. Chaque série a : un **rôle** éditorial unique, un **rythme** (jours de la semaine, chaque semaine ou une semaine sur deux), un **sujet** lié, un **lecteur** (un public du portrait du sujet) et une **forme** (ce qu'il vient chercher, de quoi est fait un bon épisode, ce qui le fait partir, ses mots, une signature facultative). Créer ou changer une série met le calendrier à jour aussitôt (sur 28 jours).

### Settings — `/settings`
Profil et audience, jours de publication, connexions sociales (LinkedIn, X + pseudo X), sujets et sources, **style appris** (règles proposées à validation), kit de marque et bibliothèque de photos, facturation (Stripe), onglet **Compte** (mot de passe, **export JSON des données**, **suppression du compte**).

### Assistant — `/assistant` (caché)
Chat « rédacteur en chef assistant » outillé : lit tout l'espace de travail, écrit sur tout **sauf scripts et calendrier**, **toujours par propositions** à accepter, éditer ou rejeter une par une. Peut ranger un fichier déposé dans le bon sujet.

### Admin — `/admin/quotas`
Quotas personnalisés par compte. Réservé aux emails de `ADMIN_EMAILS` (404 pour les autres).

## 3. Les formats de post

- **Texte** : titre, accroche, corps, hashtags. Règles chiffrées par réseau (`platformRules.ts`) ; X avec compteur de caractères.
- **Visuel** : image, carrousel ou **animation**.
  - Maquette composée **en HTML** à partir des vraies photos de la marque (montage jusqu'à 6 photos, détourage Photoroom optionnel, éléments d'interface), éditable à la main et par instruction, **exportée en PNG** dans le navigateur.
  - **Animation** : le modèle écrit une page HTML animée de X secondes, jouée dans un iframe enfermé, contrôlée (lecture du code, essai de rendu, revue sur images), **exportée en MP4** (WebCodecs, Chrome/Edge).

## 4. Ce que fait le produit en tâche de fond

- **Veille d'inspiration** par sujet (recherche web OpenAI) : fiches réinjectées dans les prompts des posts libres ; le rédacteur dit lesquelles ont servi.
- **Apprentissage du style** : compare premier jet et version finale ; propose des règles injectées partout où la machine rédige.
- **Langue des posts** : celle du profil, sinon celle des notes ; règle absolue revérifiée par le code (anglais et français).
- **Rattachement des publications** (Performance) : repère les vrais posts et les relie aux scripts.

## 5. Pages publiques

Landing rendue côté serveur (SEO, image Open Graph, `robots`/`sitemap`), pages légales (`/legal/cgu`, `/legal/confidentialite`, `/legal/mentions-legales`, alimentées par une identité d'éditeur **encore en placeholders**), `/login` (connexion et mot de passe oublié seulement), `/stories/[slug]`.
