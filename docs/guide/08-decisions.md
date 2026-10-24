# 08 — Décisions structurantes (et pourquoi)

Chaque ligne : la décision, la raison, ce qui a été écarté. Le détail et la date sont dans la spec citée. **Avant de proposer d'en défaire une, relire sa raison.**

## Produit

| Décision | Raison | Écarté | Spec |
| :--- | :--- | :--- | :--- |
| Cible prioritaire = qui a déjà de la matière écrite | Toute la valeur (ne jamais inventer, ne jamais répéter) dépend du corpus. C'est l'usage validé | Partir des artisans | `PRODUCT` §2 |
| L'entrée est un lien de repo GitHub public | Le plus petit geste possible : pas d'OAuth, pas de compte, pas de formulaire | Garder le parcours en six écrans comme entrée | `ENTREE_PAR_LE_REPO` D1 |
| Le compte se crée dès l'email, **sans session** avant le clic sur le lien | On ne dépense un appel LLM que pour quelqu'un qui a laissé son email ; ouvrir une session à la saisie laisserait entrer dans le compte d'un autre | Vérifier l'email avant ; connecter tout de suite | D6, D9, D10 |
| Un seul post dans le mail, les deux autres au clic | Moins de coût pour ceux qui n'ouvrent jamais le mail | Générer les trois avant l'envoi | D7 |
| Le jeton du lien est consommé par un **POST** à l'ouverture de la page | Un scanner de mails ne le brûle pas | Consommer au GET | §6 |
| **LinkedIn et X seulement** | Chaque réseau en plus est un coût de génération et d'écrans | Garder les autres « au cas où » | `APP_DESIGN_TELLOVO` E1 |
| **Un script par réseau**, même créneau, même événement | Le même texte collé sur deux réseaux est mauvais sur les deux ; garde le modèle « un script = un réseau » | Un script avec variante X | E2 |
| Le visuel est **commun** aux deux réseaux, choisi **post par post**, texte inchangé | Seul le texte diffère ; une 2e composition coûte un appel pour rien | Une maquette par réseau ; visuel au niveau de la série | E3, E16 |
| Le quota compte des **semaines** | Ce qu'on offre est une semaine de contenu ; compter les scripts doublerait la facture sans rien dire | Compter des posts / scripts × 2 | E10 |
| Statuts **Draft / Ready / Posted**, Posted jamais à la main | Posted est un fait observé, pas une déclaration | Quatre statuts | E14 |
| La **vidéo** est retirée | Hors périmètre du MVP ; animation MP4 du post visuel conservée | — | `ONBOARDING_MVP` §6 |
| Plus de génération d'image : maquette HTML sur les **vraies photos** | Une image générée n'est pas la vraie chose du fondateur | Nano Banana | `COMPOSITION_VISUELLE` |
| L'assistant est **caché, pas supprimé** | Il reviendra probablement ; le réécrire coûterait plus | Le supprimer | E5 |
| L'assistant propose, ne fait jamais seul ; il ne touche ni scripts ni calendrier | Frontière de rôle : les mots et le planning restent à la personne | Écriture directe | `ASSISTANT_AGENTIQUE` |
| Le ton **s'apprend des retouches** | Demander « quel ton ? » ne marche pas ; les corrections sont un gisement | Chat de ton, valeurs | `APPRENTISSAGE_STYLE` |

## Génération

| Décision | Raison | Spec |
| :--- | :--- | :--- |
| L'unité de matière est l'**événement**, pas le document | Un chef qui reçoit une phrase par document ne lit pas ; un post raconte un moment | `REDACTEUR_PAR_EVENEMENTS` §2 |
| **Un lecteur par série**, la forme est dérivée de lui | Un post ne vise jamais deux publics ; la forme dépend du lecteur | §2, §4 |
| Rédacteur **agentique** (relire la source, brouillon, se juger, recommencer) | Les champs de « réflexion » remplis dans le même appel sont un formulaire | §5 |
| Les **contrôles du code** priment sur le modèle | Ce qui se mesure ne se délègue pas | `PROMPT_GENERATION_V3` |
| La forme de série décrit des **ingrédients, jamais un ordre** | Une recette numérotée donnait le même squelette à tous les posts | §9 |
| Le **plan d'une série = la ligne de temps filtrée** | Plus d'objet « plan » à part | §4 |
| Série = seul objet éditorial ; **rôle** unique par série | Simplifier l'UX sans changer le modèle de données | `SERIES_ET_ROLES` |
| **Rythme par série** (jours, une semaine sur deux), calendrier tenu sur 28 jours | Un poids en % ne dit pas quand publier | `RYTHME_DES_SERIES` |
| Pas de posts libres générés | Tout créneau automatique appartient à une série | `RYTHME_DES_SERIES` |
| L'animation est une **page HTML libre** sous contrat de temps `seek(ms)` | Un dessin à calques + 5 effets donnait des diapositives de texte qui défilent ; l'export vidéo est image par image | `ANIMATION_HTML_LIBRE` |
| Les chiffres affichés dans une animation **viennent du post** | « 12 squats » sonne juste et est faux ; un chiffre inventé est un mensonge | idem |
| Un seul fournisseur LLM opérationnel : OpenAI | `callAgentic` n'est écrit que pour lui ; les autres adaptateurs sont des squelettes | `CLAUDE.md` |

## Architecture

| Décision | Raison | Spec |
| :--- | :--- | :--- |
| **Un cœur, plusieurs connecteurs**, pas de verticales dans les données | Le cœur est déjà agnostique au métier (rôles et séries demandés au LLM) ; une verticale n'ajoute pas de table | `ARCHITECTURE_VERTICALES` |
| Pas d'interface `SourceConnector` générique avant un 2e implémenteur… | …puis extraite : le registre existe maintenant (`connectors/registry.ts`) | `CONNECTEURS_ET_SUJETS` |
| `oauth_accounts.provider` est du **texte** | Un fournisseur de plus ne doit pas coûter une migration | `TECH` §8 |
| Pas de planificateur dans l'app, pas de Redis, pas de file | Infra minimale sur un VPS ; refresh de token paresseux, rate limit en Postgres. Les tâches de nuit (sauvegarde, synchro quotidienne des sources depuis le 2026-10-24) sont des crons **de l'hôte** qui appellent un script | `TECH` §2, §7 ; `SYNCHRO_QUOTIDIENNE` |
| Rattacher un compte tiers à la session ouverte **quel que soit l'email** | La personne prouve les deux comptes en étant connectée aux deux | `TECH` §8 |
| Jamais de rattachement sur un email **non vérifié** | Sinon n'importe qui revendique le compte d'un autre | `TECH` §8 |
| Lecture des repos publics avec un `GITHUB_TOKEN` **serveur sans droit** | Le quota de 60 req/h est compté sur l'IP du serveur, pas du visiteur | D13 |
| Un seul VPS, Docker Compose, Caddy | Coût et simplicité pour un MVP | `DEPLOIEMENT_VPS` |
| L'app **reprend le CSS** de l'app de démonstration tellovo.ai sous `.ap` | Design validé ; accent CreaFlow conservé | `APP_DESIGN_TELLOVO` |

## Méthode de travail (utile à savoir)

- **Spec d'abord, validée à deux**, puis code par **lots** vérifiables. Chaque spec a un **journal de décisions avec leur raison**, parce que le produit sert à raconter son propre développement (le devlog est de la matière pour la série devlog de l'app).
- **Essais réels** avant de dire « terminé » : les comptes et rapports de test sont dans `docs/tests/`.
- Les chantiers vivent sur des branches `feature/*`, mergées sur `main` et poussées ; ne jamais pousser `docs/founder/` ni l'image WhatsApp à la racine de `docs/` (fichiers étrangers au code, une fois poussés par erreur puis retirés).
