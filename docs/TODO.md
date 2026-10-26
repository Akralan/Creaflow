# TODO

Ce qui reste à faire, avec ce qu'on a constaté. Ce qui a été fait le 2026-10-26 est raconté dans `docs/DEVLOG.md` (entrée « Tellovo sur Tellovo »).

> **L'objectif (2026-10-26)** : des posts aussi bons que les six de `docs/tests/POSTS_OBJECTIFS.md`, écrits à la main à partir du dépôt tellovo. On ne s'arrête pas d'améliorer le rédacteur avant.

## Le rédacteur

- **Les moments humains forts n'arrivent pas.** La permission de prêter un ressenti à l'auteur (prompt système) n'a presque rien changé ; le mettre dans les formes a été écarté par l'auteur (« ça change rien »). Rien d'inventé côté données reste la règle : pas de fonctionnalité, de chiffre, d'utilisateur, de client ni de démo qui n'existe pas ; le récit, lui, est libre.
- **La machinerie reste dans les posts** (`/start`, `/login`, `password_hash`, « pas encore mergé ») malgré « never the names of the machinery » dans les trois formes réécrites. L'auteur préfère des moments forts, quitte à garder un peu de machinerie : pas prioritaire.
- **La voix de la matière** : le DEVLOG de tellovo est écrit par Claude, à la troisième personne (« à la demande de l'utilisateur »), et le rédacteur la recopie. Pas tranché : une phrase dans `WHO_SPEAKS`, ou écrire le DEVLOG au nom de l'auteur.
- **Les autres formes** (demo, number, lesson, promise…) ont le même défaut de compte rendu qu'avaient `episode`, `looking_back` et `failure` : à réécrire dans le même esprit si les trois premières tiennent.
- **Un reste soutenu** malgré la règle du ton décontracté (« décoration éditoriale », « une version moins dogmatique »).
- La version X d'un post réécrit seul (« another idea » sur l'onglet X) passe encore par le rédacteur complet, pas par l'adaptation du texte LinkedIn.

## L'extracteur

- **Les specs restent la moitié de la matière** (142 pointeurs sur 298). Leurs vrais moments sont surtout dans leur journal des décisions.
- **`CLAUDE.md` revient d'un essai à l'autre** (0 puis 13 pointeurs) malgré la règle « un index n'a aucun événement » : variabilité du modèle.
- Les genres restent approximatifs (une ligne vide classée « échec », une limite de taille « chiffre »).

## Synchro et lecture du dépôt

- **La synchro ne supprime jamais un document qui n'est plus lu** (`sourceConnectorService.ts`, `diffDocuments` ajoute et met à jour, n'enlève rien) : un fichier supprimé du dépôt, ou devenu exclu, garde ses pointeurs pour toujours. Constaté avec le faux devlog MyKiné, retiré à la main du compte de test.
- **La lecture du dépôt coûte une requête GitHub par fichier** (~53 pour 50 `.md`) : sans `GITHUB_TOKEN`, le quota anonyme (60/h) casse l'inscription. Piste : l'archive du dépôt en une seule requête (le SHA de blob git se recalcule depuis le contenu, la détection de changement reste la même).
- **La carte de `/start` décrit l'ancien produit** sur le dépôt tellovo : elle lit les 1 200 premiers caractères de chaque document, donc les entrées les plus anciennes du DEVLOG, et un README périmé.
