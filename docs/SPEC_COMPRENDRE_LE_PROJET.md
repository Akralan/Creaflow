# SPEC — « Understand it » : ce que Tellovo a compris du projet

Statut : **implémenté le 2026-10-25** sur `feature/comprendre-le-projet`, pas mergé. Rien d'autre ne s'y ajoute.

## Ce qu'on fait

Dans la carte du projet de Business context, à droite d'« Edit details », un bouton **Understand it** ouvre une **modale** (pas une page) en lecture seule :

- **Who you write for** : les publics du portrait des lecteurs (`products.reader_portrait`), une carte par public avec qui il est, ce qu'il veut, ce qui l'arrête, ce qui le fait fuir, et ses mots.
- **What Tellovo found in your material** : le nombre d'événements **par genre**, du plus nombreux au moins nombreux, avec le total. Pas la ligne de temps. Route `GET /api/events/summary?productId=` (`eventSummaryForSubject`), libellés anglais des treize genres dans `src/components/app/projectInsight.ts`.

Sans public : une phrase qui dit qu'il viendra avec la lecture de la matière. Sans événement : « still reading » si des documents restent à lire, sinon une invitation à brancher une source.

## Journal des décisions

- **2026-10-25 — Une modale, pas une page.** Demande de l'utilisateur : comprendre le projet sans quitter Business context.
- **2026-10-25 — Les publics et les comptes par genre sont obligatoires**, le reste de l'ancien onglet Topics se décide au cas par cas.
- **2026-10-25 — Le reste de l'ancien onglet Topics ne revient pas.** Inventaire présenté à l'utilisateur : modifier ou régénérer les publics, « Who it's for » propre au projet, délier une source, relire la matière, la ligne de temps détaillée avec suppression d'un événement, la liste des documents, l'ajout de matière à la main, créer ou supprimer un projet. Aucun n'est réaffiché. La veille d'inspiration est supprimée du code.
