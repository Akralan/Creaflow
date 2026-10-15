/**
 * Interrupteurs d'affichage de la landing. Module sans "use client" pour être lisible aussi
 * bien depuis LandingPage (composant serveur) que depuis le header (client) : un booléen
 * exporté par un module client arriverait côté serveur comme référence, pas comme valeur.
 */

/**
 * Section « Ce que fait CreaFlow » (grille de fonctionnalités) masquée depuis le 2026-10-15 :
 * ses points sont repris, reformulés en bénéfices, par « Ce que ça change pour vous », et le
 * hero montre déjà la provenance. Le composant reste en place pour comparer les deux
 * versions : passer à `true` réaffiche la section, son panneau et le lien du header.
 */
export const FEATURES_ENABLED = false;
