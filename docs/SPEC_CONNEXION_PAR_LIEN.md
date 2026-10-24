# SPEC — Se connecter par un lien email, sans mot de passe

Statut : **implémenté le 2026-10-25** sur `feature/connexion-par-lien` (partie de `feature/rattachement-sources`), pas essayé en réel. Journal des décisions en fin de document.

## Le problème

Il y avait deux façons d'entrer dans l'app qui ne se parlaient pas. `/start` crée un compte **sans mot de passe** et envoie un lien de connexion par email. `/login` ne connaissait que l'email et le mot de passe : une personne venue par `/start` qui revenait par `/login` n'avait pas de mot de passe à donner, et recevait un message qui parlait de GitHub, Notion ou Linear alors qu'elle n'avait donné qu'un email.

## Ce qu'on fait

**Il n'y a plus de mot de passe.** Se connecter, c'est recevoir un lien.

- **`/login`** : un champ email et « Email me a link », plus les boutons GitHub, Notion et Linear quand ils sont configurés. Après l'envoi : « Check your inbox », la même réponse que l'adresse ait un compte ou non, et « Send another link ».
- **`POST /api/auth/link/request { email }`** : si l'adresse a un compte, émet un lien et l'envoie **après** la réponse, pour que la durée de la réponse ne révèle pas qui est inscrit. Répond toujours `{ ok: true }`. Limites : 10 demandes par heure et par IP, 5 par heure et par adresse.
- **Le lien** est celui de `/start` (`loginLinkService`) : 24 h, un seul usage, un nouveau lien invalide les précédents, seul son hash est en base. Il ouvre `/connexion/lien`, qui pose la session et mène au calendrier.
- **La porte « Paste my notes » de l'onboarding** crée le compte avec l'email seul. La session s'ouvre tout de suite pour finir l'onboarding ; la fois suivante, on revient par un lien.
- **L'onglet Account** perd son bloc mot de passe. Supprimer son compte se confirme en recopiant son adresse, pour tout le monde.
- **Pages légales** : CGU et politique de confidentialité disent la connexion par lien, ne parlent plus de mot de passe haché ni d'emails de réinitialisation.

## Ce qui est retiré

Routes `POST /api/auth/login`, `POST /api/auth/password/forgot`, `POST /api/auth/password/reset`, `POST /api/account/password` ; page `/reinitialiser-mot-de-passe` ; `passwordService` et `src/lib/auth/password` avec leurs tests ; emails de réinitialisation et d'avis de changement.

**Restent en base, sans être lus ni écrits** : la colonne `users.password_hash` et la table des jetons de réinitialisation. Les supprimer est une migration qui détruit des données : à décider à part. `users.sessions_invalidated_before` reste lu par la session, pour un futur « se déconnecter partout ».

## Essais

1. `/login` avec l'adresse d'un compte `/start` : « Check your inbox », le lien arrive (en dev, dans les logs avec le mode `console`), il ouvre le calendrier.
2. `/login` avec une adresse inconnue : même écran, aucun email, rien dans la réponse qui le distingue.
3. Le même lien utilisé deux fois : la seconde fois, refusé. Deux liens demandés : seul le dernier marche.
4. Onboarding, « Paste my notes » : compte créé avec l'email seul, onboarding complet, puis déconnexion et retour par un lien.
5. Account : supprimer son compte en recopiant l'adresse.
6. Un compte qui avait un mot de passe : il se connecte par lien comme les autres.

## Journal des décisions

- **2026-10-25 — Connexion par lien email seulement, le mot de passe disparaît.** Décision de l'utilisateur, après avoir constaté que `/login` demandait un mot de passe que les comptes `/start` n'ont jamais eu. Un seul chemin, celui que `/start` utilisait déjà.
- **2026-10-25 — Les boutons GitHub, Notion et Linear restent sur `/login`.** Ce sont des connexions sans mot de passe elles aussi.
- **2026-10-25 — La colonne `password_hash` reste en base.** Supprimer des données demande une décision à part ; la colonne n'est plus ni lue ni écrite.
