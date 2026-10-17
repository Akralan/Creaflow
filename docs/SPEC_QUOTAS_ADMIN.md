# SPEC — QUOTAS PERSONNALISÉS ET ÉCRAN D'ADMIN

> **Statut : validée et implémentée le 2026-10-17** sur `feature/prompt-generation-v3`, migration `0043` appliquée en dev. Vérifié en local : 404 sans session, écran et API pour l'admin, quota enregistré puis remis à vide, valeur négative refusée (400), compteur intact après suppression d'un script (essai annulé). Écran pas encore cliqué dans un navigateur.
>
> **Constat (2026-10-17).**
> - L'essai gratuit (5 scripts, 30 retouches) se contournait : supprimer un script effaçait ses générations et ses retouches du compteur (clés étrangères en `cascade`).
> - Aucun moyen n'existait pour donner plus de scripts à une personne (compte de test, bêta-testeur), ni pour se débloquer soi-même en dev.

---

## 1. Décisions tranchées

| Sujet | Décision |
| :--- | :--- |
| Compteur | Supprimer un script ne retire plus ses générations ni ses retouches du compteur. Elles en sont seulement détachées (`script_id` passe à null). Les générations déjà effacées par des suppressions passées restent perdues. |
| Quota personnalisé | Deux valeurs par compte, vides par défaut : `users.script_limit` et `users.micro_edit_limit`. Une valeur remplie **remplace** la limite de l'essai ou du plan, elle ne s'y ajoute pas. Vide = limite normale. |
| Période | Inchangée : depuis toujours pour l'essai, depuis le début de la période pour un abonnement actif. |
| Qui est admin | Les emails de la variable `ADMIN_EMAILS` (séparés par des virgules, sans tenir compte de la casse). Un admin reste un compte ordinaire, qui utilise l'application comme tout le monde. L'email lui ouvre **en plus** l'écran d'admin, il ne change rien à son quota. |
| Écran | `/admin/quotas` : chercher un compte par email, voir son plan, ses compteurs et ses limites, régler ou vider ses deux quotas. |
| Accès refusé | Pour tout autre compte, la page et ses routes répondent **404** : l'écran reste invisible. |
| Hors périmètre | Lien dans le menu, historique des changements, liste de tous les comptes. |

---

## 2. Données (migration `0043`)

- `script_generation_events.script_id` et `script_micro_edit_events.script_id` deviennent nullable, avec `ON DELETE SET NULL` au lieu de `CASCADE`. `user_id` garde son `CASCADE` : supprimer le compte efface toujours ses données (RGPD).
- `users.script_limit`, `users.micro_edit_limit` : integer, nullable.

---

## 3. Code

- `src/lib/auth/admin.ts` :
  - `parseAdminEmails`, `isAdminEmail` ;
  - `requireAdmin()`, qui renvoie l'utilisateur ou lève une 404.
- `src/lib/services/billingService.ts` : `getQuotaStatus` et `getMicroEditQuotaStatus` lisent les limites propres au compte avant celles de l'essai ou du plan (`effectiveLimit`, pur et testé). Le nom de plan affiché devient « Quota personnalisé ».
- `src/lib/services/adminQuotaService.ts` : `findAccountQuotas(email)`, `setAccountQuotas(userId, { scriptLimit, microEditLimit })`.
- Routes `GET /api/admin/quotas?email=…` et `PUT /api/admin/quotas`, toutes deux derrière `requireAdmin()`.
- Page `src/app/admin/quotas/page.tsx` : composant serveur qui appelle `notFound()` si le compte n'est pas admin, et qui rend le formulaire client `AdminQuotasPanel`. Elle est hors de la coquille de l'app (pas de menu) et marquée non indexable.
- `.env.example` et `deploy/` : `ADMIN_EMAILS`.
