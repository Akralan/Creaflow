# Guide du projet — par où commencer

> Ce dossier est **la porte d'entrée** : ce qu'est le produit, comment il est construit, où il en est. Il a été écrit le 2026-10-19 en relisant le code et les ~40 specs de `docs/`. Si un document de ce dossier contredit un ancien doc de `docs/`, **celui-ci a raison** (voir `09-carte-des-docs.md` pour savoir quoi croire ailleurs).

**Nom.** Le produit s'appelle **Tellovo** (marque, landing, interface). Le dépôt, le dossier et une partie du code et des docs disent encore **CreaFlow**. C'est le même projet.

## Si tu as 10 minutes

Lis dans cet ordre :

1. `01-vision.md` — pour qui, pour quoi, ce qu'on refuse de faire (3 min).
2. `02-produit.md` — ce que la personne voit et fait, de la landing au post publié (4 min).
3. `07-etat-et-reste-a-faire.md` — ce qui marche, ce qui n'a jamais été essayé en vrai (3 min).

## Si tu rejoins le projet en tant que développeur (ou si tu donnes ça à Claude)

Lis tout dans l'ordre, ~45 minutes :

| Fichier | Il répond à |
| :--- | :--- |
| `01-vision.md` | Pourquoi ce produit existe, à qui il parle, ses principes non négociables |
| `02-produit.md` | Ce que fait l'application aujourd'hui, écran par écran |
| `03-architecture.md` | Comment le code est organisé, où ranger quoi, comment une requête circule |
| `04-ia-et-generation.md` | Le cœur : comment un post est écrit (lecteur d'événements, forme de série, rédacteur agentique) |
| `05-donnees.md` | Les tables importantes et les règles qui les protègent |
| `06-integrations-et-configuration.md` | Les services externes, toutes les variables d'environnement, ce qui est optionnel |
| `07-etat-et-reste-a-faire.md` | État réel, dette connue, risques, prochains chantiers |
| `08-decisions.md` | Les décisions structurantes et **pourquoi** (à relire avant de proposer de les défaire) |
| `09-carte-des-docs.md` | Les ~60 autres fichiers de `docs/` : lesquels sont vivants, lesquels sont de l'archive |
| `10-exploitation.md` | Lancer en local, tester, migrer, déployer, sauvegarder |

## Si tu donnes ça à Claude

Donne-lui **ce dossier entier** plus `CLAUDE.md` et `AGENTS.md` (à la racine). Ne lui donne pas `docs/` en bloc : 860 Ko dont la moitié est de l'historique, et plusieurs docs se contredisent. Quand il touche une zone précise, il ouvre ensuite la spec citée dans `09-carte-des-docs.md`.

Deux règles de travail à lui transmettre (elles viennent de la façon dont ce projet est mené) :

- **Cadrer avant de coder** : une spec validée d'abord, avec un journal de décisions et leur raison. Aucune modification de fond avant d'avoir décidé la solution précise à deux.
- **Pas de trailer « Co-Authored-By » dans les commits** de ce dépôt.

## Les trois choses à retenir si tu n'en retiens que trois

1. **Le produit n'invente jamais.** Il écrit à partir de la matière réelle de la personne (son repo, ses notes), et marque `[à compléter]` plutôt que de deviner.
2. **La génération raconte un événement daté à un lecteur précis.** Elle ne décrit pas un système. C'est ce qui a fait passer les posts de « jamais bons » à « bien mieux » (`04-ia-et-generation.md`).
3. **Un cœur unique, pas de verticales dans les données.** Aucune table par métier ; un test (`src/db/schemaInvariants.test.ts`) le garde.
