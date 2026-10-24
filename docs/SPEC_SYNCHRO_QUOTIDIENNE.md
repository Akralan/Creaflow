# SPEC — Synchronisation quotidienne des sources, et fraîcheur de la matière

Statut : **implémenté le 2026-10-24** sur `feature/rattachement-sources`, pas essayé en réel (ni le cron sur le VPS, ni la route avec un vrai secret). Journal des décisions en fin de document.

## Le problème

Une source connectée (GitHub, Notion, Linear) n'était relue que si quelqu'un cliquait sur « resynchroniser », bouton qui vivait dans l'onglet Topics de Settings, retiré le même jour. La matière vieillissait sans que rien ne le dise, et la ligne de temps ne recevait les nouveaux faits qu'à la main.

## Ce qu'on fait

### Chaque nuit, toutes les sources sont relues

- `POST /api/cron/sync`, protégée par `Authorization: Bearer <CRON_SECRET>`. Sans secret configuré, la route répond 503 : elle n'est jamais ouverte par oubli. Comparaison du secret à temps constant.
- Le cron de l'hôte appelle `deploy/sync.sh` à 4 h 15, après la sauvegarde de 3 h 30 (`docs/DEPLOIEMENT_VPS.md` §7 bis). L'app n'a toujours pas de planificateur : rien ne tourne dans le processus Next entre deux appels, et une seconde instance ne ferait pas tourner la synchro deux fois.
- `syncAllSources` (`src/lib/services/sourceSyncService.ts`) passe les sources **jamais synchronisées d'abord, puis de la plus ancienne synchro à la plus récente**, une par une, avec le même `syncSource` que le bouton : comparaison par empreinte, documents nouveaux insérés, documents changés relus, puis lecture des événements relancée pour le projet si quelque chose a bougé.
- Un quota atteint chez un fournisseur arrête les sources de ce fournisseur pour la nuit ; les autres continuent. Une source en erreur est comptée et n'arrête rien (`syncSource` pose déjà `status` et `lastError`). Les sources en `needs_reconnect` sont écartées : seule la personne peut remettre le jeton.
- Budget de 25 minutes : au-delà, la route s'arrête et rend son rapport ; la nuit suivante reprend par les plus anciennes, rien n'est perdu.
- Le rapport (`sources, synced, rateLimited, failed, skippedReconnect, stopped, added, updated`) finit dans le journal du cron.

### Un document qui a changé perd ses anciens pointeurs

`syncSource` marquait un document changé « à relire » (`eventsReadAt = null`) sans toucher à ses `material_events`. Relu, il en recevait de nouveaux à côté des anciens, dont les numéros de ligne n'adressaient plus la bonne ligne. Rare à la main, quotidien avec le cron. Désormais, les événements des documents à mettre à jour sont **supprimés avant** la mise à jour. Les posts déjà écrits gardent leur texte ; `scripts.event_id` passe à null (`SET NULL`), `scripts.event_ids` garde des identifiants morts que personne ne relit.

### Le badge de Business context

Dans l'en-tête, à côté du nom du projet, une pastille dit la fraîcheur de la matière d'après les sources du projet (`src/lib/syncBadge.ts`, pur) :

- aucune source : rien ;
- une source en `needs_reconnect` : **Needs reconnect**, en alerte, quelle que soit la date des autres ;
- aucune jamais synchronisée : **Not synced yet** ;
- sinon la **source la moins fraîche** donne la date : « Synced just now » (moins d'une heure), « Synced 5 h ago », « Synced 1 day ago », « Synced 3 days ago » (alerte à partir de deux jours), « Synced 2 weeks ago ».

Au survol : « When Tellovo last read your sources. They are read again every night. »

### Hors périmètre

- Resynchroniser ou délier une source depuis l'app : le bouton a disparu avec l'onglet Topics, il reviendra avec le prochain écran de sources.
- Relire les bases Notion : chantier séparé (`docs/SPEC_RATTACHEMENT_SOURCES.md`).
- Une file ou un planificateur dans l'app.

### Essais

1. `CRON_SECRET` absent : `POST /api/cron/sync` → 503. Mauvais secret → 401.
2. Bon secret, deux sources dont une à reconnecter : rapport `synced 1, skippedReconnect 1`, `lastSyncedAt` avancé sur la première seule.
3. Modifier une page Notion déjà lue, lancer la synchro : le document est relu, ses anciens pointeurs ont disparu, les nouveaux pointent sur les bonnes lignes, aucun doublon.
4. Business context : badge « Synced just now » après la synchro ; passer une source en `needs_reconnect` en base → « Needs reconnect ».
5. Sur le VPS : `./deploy/sync.sh` à la main, puis la ligne de crontab ; le journal porte le rapport.

## Journal des décisions

- **2026-10-24 — Une route protégée appelée par le cron de l'hôte**, plutôt qu'un planificateur dans Next ou un service cron dans le compose. Rien dans le processus de l'app, rejouable à la main, visible dans les logs, et jamais en double si l'app tourne deux fois. Même mécanique que la sauvegarde nocturne.
- **2026-10-24 — Supprimer les pointeurs d'un document changé avant de le relire.** Défaut trouvé en préparant la synchro : la relecture doublait les événements. L'utilisateur a demandé la correction.
- **2026-10-24 — Le badge lit la source la moins fraîche.** C'est elle qui dit de quand date la matière la plus vieille ; afficher la plus récente aurait masqué une source bloquée.
- **2026-10-24 — Les sources à reconnecter sont écartées de la nuit.** Réessayer un jeton tombé chaque nuit ne ferait que bruiter les logs ; le badge « Needs reconnect » le dit à la personne.
