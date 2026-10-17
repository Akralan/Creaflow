# Données et vie privée

Dernière mise à jour : octobre 2026

Ce document décrit ce que MyKiné collecte, où ça va, et ce qui n'est jamais collecté. Il sert de base à la politique de confidentialité et aux réponses aux kinés.

## Principe

Le traitement d'image se fait entièrement sur le téléphone du patient. Le serveur ne reçoit que des angles articulaires en degrés, des compteurs de répétitions et des horodatages. Il n'existe aucun chemin de code qui envoie une image, une vidéo ou des coordonnées de points au serveur.

## Données collectées

### Côté kiné

| Donnée | Usage | Stockage |
| :--- | :--- | :--- |
| Email, mot de passe | Connexion | `kines`, mot de passe en argon2id |
| Nom | Affiché dans les SMS patient | `kines.name` |

### Côté patient

| Donnée | Usage | Stockage |
| :--- | :--- | :--- |
| Pseudonyme (choisi par le kiné) | Identification dans le dashboard | `patients.alias` |
| Téléphone | Envoi du lien et des rappels SMS | `patients.phone_enc`, chiffré `pgp_sym_encrypt`, clé hors base |
| Angles articulaires (séries à 10 Hz) | Compte-rendu de séance, courbes dans le dashboard | `session_exercises.angle_series` |
| Compteurs, partielles, amplitude moyenne | Compte-rendu | `session_exercises` |
| Modèle de téléphone, cadence, variante de modèle | Diagnostic de performance | `sessions.device` |

Le pseudonyme est libre, le dashboard recommande un alias non identifiant (« Genou 3 », initiales). Le serveur ne connaît ni nom, ni prénom, ni date de naissance, ni pathologie.

## Données jamais collectées

- Images et vidéos de la caméra.
- Coordonnées des 33 points du modèle (seuls les angles dérivés sont conservés).
- Position géographique.
- Identifiants publicitaires. Aucun SDK d'analytics ni de crash reporting tiers dans l'app patient.

## Qualification des données

Des séries d'angles articulaires rattachées à un pseudonyme et à un téléphone chiffré, produites dans le cadre d'une prise en charge par un kiné, relèvent des données de santé au sens du RGPD (article 9).

Conséquence : l'hébergement de données de santé en France relève du référentiel HDS. Le VPS Scaleway utilisé en v0.4 n'est pas certifié HDS.

Position tenue en v0.4 : pseudonymisation à la source. Le serveur ne porte aucune donnée directement identifiante (pas de nom, téléphone chiffré avec une clé absente de la base et du VPS, détenue dans le gestionnaire de secrets du déploiement). La table de correspondance pseudonyme ↔ personne existe uniquement dans la tête du kiné et dans son propre logiciel de cabinet. Cette position est documentée aux kinés utilisateurs et sera revue avant toute facturation à plus de 20 cabinets (`roadmap.md`).

## Chiffrement

- Transport : TLS 1.2+ partout (Caddy, certificats Let's Encrypt).
- Au repos : téléphone chiffré en base (`pgcrypto`), disque du VPS chiffré (LUKS), sauvegardes chiffrées (`age`) avant envoi vers le stockage objet.
- Secrets : `JWT_SECRET`, `PHONE_KEY`, `BREVO_API_KEY` injectés par variables d'environnement, jamais en base ni dans le dépôt.

## Rétention et suppression

- Séances : 24 mois après la séance.
- Patient archivé : supprimé avec ses séances 12 mois après l'archivage.
- Suppression immédiate à la demande du kiné : `DELETE /patients/{id}` (hard delete, cascade).
- Liens d'invitation : 90 jours, révocables.

## Sous-traitants

| Sous-traitant | Rôle | Données |
| :--- | :--- | :--- |
| Scaleway (Paris) | Hébergement API et base | Toutes les données serveur |
| Brevo | Envoi de SMS | Numéro de téléphone, nom du kiné, lien |
| Apple / Google | Distribution de l'app | Aucune donnée de séance |

Aucune donnée n'est transmise à un autre service.

## Droits des patients

Le kiné est responsable de traitement vis-à-vis de ses patients ; MyKiné est sous-traitant. Les demandes d'accès ou de suppression passent par le kiné, qui dispose de l'export CSV et de la suppression dans le dashboard.
