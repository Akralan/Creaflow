# URGENT — à faire avant de brancher Brevo

**Retirer le lien de connexion des logs (`EMAIL_LOG_LINKS`).**

Pour essayer le parcours `/start` sur le VPS sans service d'envoi, la variable `EMAIL_LOG_LINKS=1`
fait écrire dans les logs du serveur le **lien de connexion** de chaque email (un lien = un accès au compte,
24 h). C'est acceptable pour des essais, pas dès que de vraies personnes s'inscrivent.

Avant de mettre `BREVO_API_KEY` en production :

1. Retirer `EMAIL_LOG_LINKS` de `/opt/creaflow/.env` (VPS) et redémarrer l'app.
2. Supprimer le code qui lit `EMAIL_LOG_LINKS` (`src/lib/email/console.ts`) et son test.
3. Vérifier dans les logs (`docker compose logs app`) qu'aucun lien `/connexion/lien?token=` n'apparaît.
4. Supprimer ce fichier.

Voir `docs/SPEC_ENTREE_PAR_LE_REPO.md` §6.
