# Dashboard kiné

Dernière mise à jour : octobre 2026

Application `apps/dashboard`, Next.js 15 (App Router), Tailwind. Toutes les données viennent de l'API (`backend-api.md`) ; le dashboard n'a pas de base propre.

## Authentification

`/login` → `POST /auth/login` côté serveur (route handler `/api/session`), JWT posé en cookie `httpOnly`, `SameSite=Lax`, 24 h. Les pages sous `/app` sont protégées par `middleware.ts`.

## Écrans

### `/app/patients` — liste

Tableau : alias, programme actif, dernière séance, adhésion 7 jours, adhésion 30 jours. Tri par défaut : dernière séance la plus ancienne en premier.

Colonne adhésion : `done / planned` et un pourcentage. Couleur : vert ≥ 70 %, orange 40–69 %, rouge < 40 %. Les seuils sont dans `src/lib/adherence.ts` et ne sont pas réglables.

Bouton « Nouveau patient » → formulaire alias + téléphone. L'alias est obligatoire, le téléphone est validé en E.164 (`libphonenumber-js`), indicatif par défaut +33.

### `/app/patients/[id]` — fiche

- En-tête : alias, téléphone masqué, bouton « Renvoyer le lien » (`POST /patients/{id}/invite`), bouton « Archiver ».
- Programme actif : liste des exercices par jour, bouton « Modifier » → éditeur.
- Séances : une ligne par séance, dépliable. Par exercice : séries faites, répétitions / cible, partielles, amplitude moyenne atteinte (`min_angle_mean`) comparée à la cible, et une courbe d'angle (`angle_series`) rendue en SVG (`src/components/AngleChart.tsx`, 400×120, sans bibliothèque).
- Graphique d'adhésion sur 30 jours : une barre par jour prévu, pleine si une séance existe.

### `/app/patients/[id]/program` — éditeur de programme

Client component. Catalogue à gauche (`GET /exercises`), programme à droite. Glisser-déposer avec `@dnd-kit/sortable`. Par exercice : séries, répétitions ou secondes de tenue, côté, jours (sept cases), note.

Validation côté client reprise de l'API : 1–5 séries, 1–30 répétitions, 5–120 s, au moins un jour. « Enregistrer » envoie `PUT /programs/{id}` (ou `POST /programs` à la création). Un programme modifié est visible par le patient à sa prochaine ouverture du lien.

Durée de création d'un programme de 5 exercices, mesurée sur un kiné à l'aise avec l'outil : 11 minutes la première fois, 3 à 4 minutes ensuite.

### `/app/settings`

Nom affiché dans les SMS, mot de passe, activation des rappels SMS (`sms.reminders`, par kiné), export CSV des séances (`GET /patients/{id}/sessions?format=csv`).

## Composants partagés

| Composant | Rôle |
| :--- | :--- |
| `AdherenceBadge` | pourcentage coloré |
| `AngleChart` | courbe SVG d'une série d'angles, ligne de cible en pointillé |
| `ExercisePicker` | catalogue filtrable par position et par articulation |
| `DayPicker` | sept cases, lundi en premier |

## État et cache

`@tanstack/react-query`, `staleTime` 30 s. Les listes sont rendues côté serveur au premier chargement puis hydratées. Pas de websocket : un bouton « Actualiser » recharge les séances.

## Non couvert en v0.4

- Pas de vue multi-kinés (cabinet) : un compte = un kiné.
- Pas de messagerie patient ↔ kiné.
- Pas de modification des seuils d'angle par exercice.
- Pas de version mobile du dashboard : utilisable sur tablette, pas sur téléphone.
