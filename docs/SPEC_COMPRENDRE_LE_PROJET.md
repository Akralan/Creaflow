# SPEC — « Understand it » : ce que Tellovo a compris du projet

Statut : **première version implémentée le 2026-10-25** sur `feature/comprendre-le-projet`, pas mergée. La liste de ce qui s'y ajoute est en cours de décision avec l'utilisateur.

## Ce qu'on fait

Dans la carte du projet de Business context, à droite d'« Edit details », un bouton **Understand it** ouvre une **modale** (pas une page) en lecture seule :

- **Who you write for** : les publics du portrait des lecteurs (`products.reader_portrait`), une carte par public avec qui il est, ce qu'il veut, ce qui l'arrête, ce qui le fait fuir, et ses mots.
- **What Tellovo found in your material** : le nombre d'événements **par genre**, du plus nombreux au moins nombreux, avec le total. Pas la ligne de temps. Route `GET /api/events/summary?productId=` (`eventSummaryForSubject`), libellés anglais des treize genres dans `src/components/app/projectInsight.ts`.

Sans public : une phrase qui dit qu'il viendra avec la lecture de la matière. Sans événement : « still reading » si des documents restent à lire, sinon une invitation à brancher une source.

## Journal des décisions

- **2026-10-25 — Une modale, pas une page.** Demande de l'utilisateur : comprendre le projet sans quitter Business context.
- **2026-10-25 — Les publics et les comptes par genre sont obligatoires**, le reste de l'ancien onglet Topics se décide au cas par cas.
