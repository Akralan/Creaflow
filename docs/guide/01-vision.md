# 01 — Vision

## En une phrase

**Tellovo transforme ce que tu construis (un repo, des notes) en une semaine de posts LinkedIn et X, prêts à publier, sans que tu aies à écrire ni à inventer quoi que ce soit.**

Accroche de la landing : *« Tu crées tes produits, on crée ton audience. »*

## Le problème

Les fondateurs et développeurs indépendants qui construisent « en public » savent faire leur produit, pas le promouvoir :

- **Pas le temps, pas le réflexe** : la matière existe (commits, specs, journal, décisions, chiffres) mais n'est jamais transformée en contenu.
- **Page blanche et répétition** : sans mémoire, on reproduit les mêmes angles.
- **L'IA brute invente** : ChatGPT nourri d'une simple description reste générique ou invente des détails plausibles. Sur un premier usage réel, c'est ce qui a fait échouer le produit avant même la question de l'habitude.
- **Les posts d'IA se reconnaissent** : « problème → solution → liste à puces → appel à l'action », toujours le même squelette.

## Pour qui

**Cible prioritaire (celle pour laquelle tout est conçu)** : les gens qui ont déjà de la matière écrite — développeurs, fondateurs « build in public », freelances en personal branding. Aujourd'hui l'entrée est un **lien de repo GitHub public**.

**Cible secondaire (servie, jamais validée en vrai)** : artisans, petits commerces, prestataires — dont la matière est dans la tête et passe par une interview. Le code les supporte (interview de matière, onboarding par notes collées), mais l'hypothèse « ils nourrissent le corpus assez régulièrement » est ouverte.

## Principes non négociables

| Principe | Ce que ça impose dans le produit |
| :--- | :--- |
| **Ne jamais inventer** | Chaque post part d'un événement réel de la matière, avec le passage qui le prouve. Contrôles du code sur les citations ; marqueur `[à compléter]` en cas de trou. Les chiffres d'une animation viennent du post, jamais du modèle. |
| **Raconter un événement, pas décrire un système** | Un post = un événement daté (« Marion arrête la démo au bout de 40 s »), pas un thème (« la démo »). |
| **Un seul lecteur par série** | Un post ne vise jamais deux publics. La forme d'une série est écrite pour son lecteur. |
| **L'humain garde les mots** | Tout est éditable ; l'IA propose, la personne valide. Les propositions de l'assistant ne s'appliquent jamais sans accord. |
| **Le ton s'apprend aux retouches** | On ne demande plus « quel est ton ton ? ». Le produit apprend des corrections (règles de style proposées à validation). |
| **Un cœur, pas de verticales** | Développeur, artisan, entrepreneur = des connecteurs de matière différents, pas des produits ni des tables différents. |
| **Rien ne casse sans clé** | Chaque service externe est optionnel ; sans lui, la fonction est masquée, pas cassée. |

## Ce que le produit a cessé d'être

À savoir pour ne pas le reconstruire par erreur :

- **Plus de vidéo** (2026-10-16) : plus de scripts vidéo, plus de TikTok ni YouTube. L'animation d'un post visuel, exportée en MP4, reste.
- **Plus de génération d'image par IA** : la maquette se compose en HTML à partir des **vraies photos** de la marque.
- **Plus de « rédacteur en chef IA »** qui planifie des épisodes (2026-10-17) : remplacé par le lecteur d'événements. Le positionnement « rédacteur en chef » dans les vieux docs est périmé.
- **Plus d'Instagram, newsletter, blog, Slack** (2026-10-18) : seulement **LinkedIn et X**.
- **Plus d'onboarding en chat** : remplacé par l'entrée par le repo (et un parcours de repli en six écrans).
- **Le « Module C » (recyclage multi-format)** n'a jamais existé et est abandonné.

## Modèle économique (état)

- Essai gratuit sans carte : **une semaine de contenu, à vie** (le quota se compte en semaines, pas en scripts).
- Abonnements Stripe `starter` et `pro` codés (quotas en scripts par mois). Le plan « Founder » à 19 €/mois montré par la modale de paiement **n'est branché sur rien** : la modale est un décor.
- Les prix ne sont jamais écrits en dur dans le code ; ils vivent côté Stripe.
