# Démarches Etsy et Shopify — sortir du plafond « une boutique »

Statut : à lancer (2026-09-09). Ce document ne parle pas de code : il liste ce qu'il faut demander
aux deux plateformes, dans quel ordre, et ce qu'elles exigent en retour.

## Le problème en une phrase

Chez Etsy comme chez Shopify, **brancher sa propre boutique est immédiat, brancher celles des
autres est soumis à une validation manuelle**. Sans ces validations, CreaFlow reste une app à usage
personnel : 5 boutiques au total côté Etsy, 1 boutique côté Shopify. C'est incompatible avec un
SaaS, et c'est le **chemin critique** du chantier — le code, lui, ne dépend de personne.

D'où la règle d'ordonnancement : ces démarches se lancent **maintenant**, en parallèle de
l'implémentation Notion/Linear, pas après.

## 1. Etsy — deux revues successives

### Les trois paliers

| Palier | Ce qu'il permet | Approbation | Usage commercial |
|---|---|---|---|
| **Seller App** | sa propre boutique uniquement | automatique, quasi immédiate, pour un vendeur actif en règle | **interdit** |
| **Personal App** | aller au-delà de sa boutique, à échelle limitée (**5 boutiques au total**) | revue approfondie | limité au cas d'usage approuvé |
| **Commercial Access** | servir des vendeurs quelconques par consentement OAuth | **revue commerciale manuelle séparée** | autorisé |

Le piège : **Commercial Access n'est pas un formulaire à part**. C'est un déblocage qu'on demande
*sur* une Personal App **déjà approuvée**. Il faut donc passer la première revue avant de pouvoir
seulement déposer la seconde. Deux attentes en série, pas en parallèle.

### Ce qu'il faut faire, dans l'ordre

1. **Activer l'authentification à deux facteurs** sur le compte Etsy qui portera l'app. C'est un
   prérequis à la création, pas une recommandation.
2. **Créer la Personal App** dans le portail développeur, avec nom, description et URL de callback.
   L'URL de callback devra être celle de production (`https://<domaine>/api/auth/oauth/etsy/callback`
   ou équivalent), pas `localhost` — à figer avant de déposer.
3. **Attendre l'approbation de la Personal App.**
4. **Demander le Commercial Access** sur cette app.

### Ce qu'ils regardent

Le critère annoncé est la conformité de l'application **et de sa page d'accueil** aux conditions
d'utilisation de l'API Etsy. Concrètement, il faut donc qu'existe, avant de déposer :

- une **page publique décrivant le produit**, cohérente avec ce que l'app fait réellement ;
- le **respect des mentions de marque** exigées par Etsy ;
- l'absence de tout **scraping** : tout ce qui vient d'Etsy doit passer par l'API, jamais par une
  lecture de pages. Ce point est explicite dans leurs conditions et c'est un motif de rejet net.

### Ce qu'on ne sait pas

Les **délais** et la **liste précise des motifs de rejet** ne sont pas documentés publiquement.
À traiter comme une inconnue de plusieurs semaines, pas comme une formalité.

## 2. Shopify — une revue, mais exigeante

### Les deux distributions, et l'absence de troisième voie

| Distribution | Qui peut installer | Revue Shopify | Plafond |
|---|---|---|---|
| **Publique** | n'importe quel marchand | **oui** | aucun |
| **Custom** | une boutique, ou les boutiques d'une même organisation Plus | non | 1 boutique |

Il faut un **compte Partner dans les deux cas**.

**L'app « non listée » n'est pas une échappatoire**, et c'est le point qu'on croit souvent pouvoir
contourner : une app non listée a quand même une page de listing, simplement à visibilité réduite,
et elle passe la même revue. L'ancien mécanisme d'*unpublished app*, qui permettait l'installation
sans approbation, a été **supprimé le 9 décembre 2019**. Il n'existe aujourd'hui aucun moyen
supporté de servir plusieurs marchands sans passer la revue.

### Ce que la revue exige

C'est nettement plus lourd que chez Etsy, et une partie a des conséquences directes sur le code :

- **Trois webhooks RGPD fonctionnels** — `customers/data_request`, `customers/redact`,
  `shop/redact`. Ils doivent répondre pour de vrai, pas exister.
- **API GraphQL Admin exclusivement.** Depuis avril 2026, toute nouvelle app publique doit être
  bâtie dessus ; l'API REST Admin est en fin de vie. Le client Shopify de ce repo doit donc être
  GraphQL dès la première ligne — écrire du REST serait à refaire.
- **Facturation via l'API GraphQL de billing de Shopify** pour une app qui facture le marchand.
  → **Point à trancher, avec un impact financier réel** : CreaFlow facture aujourd'hui par Stripe
  (`docs/TECH.md` §6). Savoir si un abonnement CreaFlow souscrit par un marchand Shopify doit
  passer par la facturation Shopify — et donc supporter la commission de Shopify — est une question
  ouverte, à poser explicitement avant de concevoir le parcours d'abonnement de cette verticale.
- **Page de listing complète** : accroche, proposition de valeur, fonctionnalités, mode d'emploi,
  tarification — cinq champs — et **4 à 7 captures d'écran montrant de vraies données marchand**.
- **Conformité Polaris** de toute interface intégrée à l'admin Shopify. À éviter simplement en
  n'intégrant rien dans l'admin : si l'app se contente d'authentifier et de lire des données, et
  que toute l'interface reste sur CreaFlow, cette exigence tombe en grande partie.
- **Performance** : temps de réponse sous 500 ms sur 95 % des requêtes, et pas plus de 10 points
  de Lighthouse perdus sur la boutique.
- **Zéro erreur visible** pendant la revue : une 404 ou une 500 sur un chemin testé suffit à faire
  rejeter.

### Délais annoncés

- Revue standard : **2 à 4 semaines**.
- Chaque nouvelle soumission après un rejet : **1 à 2 semaines** de plus.
- Label *Built for Shopify* (facultatif) : 2 à 4 semaines supplémentaires, avec des exigences
  renforcées. **Non nécessaire ici.**
- Prévoir **6 semaines** entre « le code est prêt » et « l'app est installable », pour une première
  soumission.

## 3. Ce qu'il faut préparer avant de déposer quoi que ce soit

Les deux plateformes regardent le produit public, pas seulement le code. Ces éléments servent aux
deux dossiers, autant les faire une fois :

- [ ] une **page publique** décrivant CreaFlow, en ligne et cohérente avec ce que l'app fait ;
- [ ] une **politique de confidentialité** accessible par URL — Shopify la demande explicitement à
      la configuration de la distribution ;
- [ ] des **conditions d'utilisation** ;
- [ ] un **domaine de production** figé, avec HTTPS : les URL de callback déposées dans les deux
      dossiers ne devront plus changer ;
- [ ] une **boutique de test** de chaque côté — une boutique de développement Shopify (gratuite via
      le compte Partner), et une boutique Etsy réelle pour le palier *Seller App*.

## 4. Ordre de marche

| # | Action | Bloque quoi | Attente |
|---|---|---|---|
| 1 | Ouvrir le compte Partner Shopify + boutique de développement | tout Shopify | immédiat |
| 2 | Activer la 2FA Etsy, créer la Seller App | tests Etsy sur sa propre boutique | quasi immédiat |
| 3 | Mettre en ligne page produit, confidentialité, CGU, domaine | les deux dossiers | à faire |
| 4 | Déposer la **Personal App** Etsy | le Commercial Access | inconnue |
| 5 | Une fois approuvée, demander le **Commercial Access** Etsy | Etsy multi-vendeurs | inconnue |
| 6 | Soumettre l'app publique Shopify à la revue | Shopify multi-marchands | 2 à 4 semaines |

Les étapes 1 et 2 se font aujourd'hui et débloquent le **développement** des deux connecteurs sur
sa propre boutique — c'est suffisant pour écrire et tester le code. Ce sont les étapes 4 à 6 qui
débloquent les **clients**.

## 5. Ce que ces contraintes imposent au code

À retenir avant d'écrire le connecteur Shopify, pour ne pas avoir à le refaire :

- **client GraphQL, jamais REST** ;
- **trois routes de webhook RGPD** à prévoir dès le départ, avec vérification de signature ;
- **le domaine de boutique demandé avant la redirection** OAuth
  (`SPEC_CONNECTEURS_ET_SUJETS.md` §7.3) ;
- **la question de la facturation à trancher** avant de concevoir l'abonnement de cette verticale.

Côté Etsy, la contrainte structurante est plus simple : **PKCE obligatoire** et **jeton d'une
heure**, donc rafraîchissement systématique (`SPEC_CONNECTEURS_ET_SUJETS.md` §7.4).

## 6. Ce qui reste à vérifier auprès des plateformes

- **Shopify** — un abonnement souscrit hors Shopify par un marchand qui a installé l'app doit-il
  passer par la facturation Shopify ? Question posée régulièrement par des développeurs, sans
  réponse claire dans la documentation publique. Elle décide de la marge sur cette verticale.
- **Etsy** — délai réel des deux revues, et si le passage de Personal App à Commercial Access exige
  une app déjà en production avec des utilisateurs.

## Sources

- Etsy — [authentification, scopes et PKCE](https://developers.etsy.com/documentation/essentials/authentication),
  [paliers d'accès et revue commerciale](https://vorplabs.com/agent-tools/etsy-api)
- Shopify — [choisir un mode de distribution](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method),
  [exigences de l'App Store](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements),
  [visibilité du listing](https://shopify.dev/docs/apps/launch/distribution/visibility)
