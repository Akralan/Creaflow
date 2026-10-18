# DEVLOG — CreaFlow / Tellovo

> Journal daté du chantier : ce qui a été fait, **ce qui a été décidé et pourquoi**, ce qui a cassé et ce qu'on en a appris. Écrit pour être relu plus tard, et comme matière pour la série « devlog » de l'application elle-même (CreaFlow parle de CreaFlow). Le détail de chaque décision est dans sa spec (`docs/SPEC_*.md`, section « Décisions ») ; ici, le fil.

---

## 2026-10-18 — De la landing à une application qui écrit pour LinkedIn et X, et une animation qui n'est plus un diaporama

### 1. Entrée par le repo (`docs/SPEC_ENTREE_PAR_LE_REPO.md`)

**Fait.** La landing mène à `/start` : un lien de repo GitHub public → une carte à trois champs déduits par l'IA → un email → un compte créé sans mot de passe, la génération en fond, un email avec le premier post et un lien de connexion (24 h, usage unique) ; au clic, les deux autres posts de la semaine s'écrivent.

**Décisions clés.**
- *Le compte se crée dès l'email* (D6), mais **aucune session** n'est ouverte avant le clic sur le lien (D9) : sinon n'importe qui entrerait dans un compte avec l'adresse d'un autre.
- *Un seul post dans le mail* (D7) : moins de coût pour ceux qui n'ouvrent jamais le mail.
- *Un jeton GitHub côté serveur* (D13). Correction d'une idée reçue : les 60 requêtes par heure de GitHub sont comptées sur **l'IP du serveur**, pas celle du visiteur. Sans jeton, tout le site partageait un quota minuscule.
- *Le jeton du lien est consommé par un POST à l'ouverture de la page*, pas par un GET : un scanner de mails ne le brûle pas.
- *Le système de génération existant est gardé* (D11) : on ne change que l'entrée.

**Appris.** Le quota GitHub est tombé en plein essai (403 sur les blobs) : la génération reprend ce qui est déjà lu (D16). Un effet React en StrictMode tuait ses propres minuteurs : deux effets, dont un gardé par une référence.

**À ne pas oublier.** `URGENT.md` : retirer `EMAIL_LOG_LINKS` (lien de connexion écrit dans les logs) avant de brancher Brevo.

### 2. L'application au design de tellovo.ai (`docs/SPEC_APP_DESIGN_TELLOVO.md`)

**Fait.** Le CSS de l'app de démonstration de tellovo.ai est copié (accent CreaFlow conservé) ; « Your content week » remplace le calendrier et la page de détail ; « Content plan » et « Business context » ; Direction et Settings dans le menu du compte ; l'assistant est caché, pas supprimé.

**Décisions clés.**
- **LinkedIn et X seulement** (E1) et **un script par réseau, rattachés au même créneau, sur le même événement** (E2) : le même texte collé sur deux réseaux est une mauvaise publication sur les deux. Un script par réseau garde le modèle de données et toutes les routes.
- **Le quota compte des semaines** (E10) : ce qu'on offre à un fondateur, c'est une semaine de contenu, pas cinq scripts (avec deux réseaux, compter les scripts aurait doublé la facture sans rien dire à l'utilisateur). Table `consumed_weeks`, migration `0048`.
- **Trois statuts, Draft / Ready / Posted** (E14), Posted n'étant jamais déclaré à la main : c'est un fait observé.
- **Le visuel se choisit post par post** (E16), le texte ne change pas, l'image est commune aux deux réseaux, c'est une micro-retouche.
- **Mobile ultra simple** (E15) : les jours en pastilles, le script dessous, les actions en icônes.

**Cassé, puis corrigé.**
- « Prepare next week » ne faisait rien : le rattrapage des créneaux « en chargement » se basait sur la date de la première demande du compte, donc tout nouveau créneau était libéré aussitôt, et l'écriture en fond ne trouvait plus rien. Chaque créneau porte maintenant sa propre date (`generating_since`, migration `0049`). Et le plan ne recevait que le prochain créneau vide de chaque série (`all=1` pour tout recevoir).
- « The image could not be composed » : l'erreur réelle (« empty timeline ») était masquée par un message générique et était **intermittente** (un tirage raté du modèle). Journal ajouté, seconde tentative.
- Aucun retour visible pendant les actions longues : une ligne d'état sur le post, un cadre qui scintille, le tout indépendant de la bulle d'outils.

**Erreur de ma part, réparée.** J'ai poussé par mégarde `docs/founder/` (194 fichiers) et une image WhatsApp, qui n'étaient pas à moi ; commit retiré, branche réécrite, fichiers jamais perdus.

### 3. L'animation devient une page HTML libre (`docs/SPEC_ANIMATION_HTML_LIBRE.md`)

**Le déclic.** L'animation était un dessin à calques et une ligne de temps à cinq effets ; elle produisait des diapositives de texte qui défilent. Alix : « la base n'est pas bonne ; il faut qu'il puisse faire une animation HTML de X secondes avec tout ce qu'il veut, juste un contrôle contre les trucs bizarres, comme Claude Design. »

**Décisions clés.**
- **Le modèle écrit la page** (HTML, CSS, SVG, JS), jouée dans un **iframe enfermé** (`sandbox="allow-scripts"`, CSP `default-src 'none'`), images et polices intégrées en `data:`.
- **Le JS est autorisé, sous un contrat de temps** : l'animation est une fonction du temps (`window.seek(ms)` pure, pas de minuteur, pas de hasard), parce que l'export vidéo se fait image par image (le principe de Remotion).
- **Le contrôle a trois couches** : lecture du code, enfermement, essai de rendu (la page se regarde elle-même). Le but est « pas de trucs bizarres », pas de limiter la création.
- **Les chiffres à l'écran viennent du post** : « 12 squats » ou « 13/20 » sonnent juste et sont faux ; dans un post sur le travail de quelqu'un, un chiffre inventé est un mensonge.

**Ce que les essais MyKiné ont montré.**
- Le modèle a de bonnes **idées** visuelles (une silhouette dont un point sur trois s'éteint ; une courbe qui franchit trois fois un seuil) et réalise mal la **mise en page** : textes qui se chevauchent, noir sur fond sombre, première image vide, tracés SVG peints en noir, gros texte dans la zone cachée par l'interface des réseaux.
- La revue du modèle **sur ses propres images** corrige peu ; **l'essai de rendu mesuré** (coordonnées exactes renvoyées au modèle) fait le travail. Et un tour de correction ne suffit pas toujours : il corrige un chevauchement et en crée un autre. On garde la moins mauvaise page plutôt que rien.
- Un appel au modèle peut rester suspendu plusieurs minutes : délai de 3 minutes sur le client.

**Fait côté application.** Table `post_animations` (migration `0050`), service et routes, lecteur dans le post, choix « Animation » dans « Add a visual », essai de rendu lancé par le navigateur après l'écriture et au plus deux corrections. Compte de test MyKiné (`mykine.test@example.com`) avec quatre animations rangées en base de dev.

**Pas encore.** Export MP4, « demander un changement » / « voir le code », retrait de l'ancien moteur, photos de la bibliothèque dans l'animation.

### 4. L'écran Performance (`docs/SPEC_PERFORMANCE.md`)

**Le déclic.** L'écran `/performance` ne montrait aucun chiffre (une liste « To confirm » et un rééquilibrage que plus rien ne génère). Alix : « il faut juste les afficher » — et voir l'écran *avant* de décider des données.

**Méthode : maquette d'abord.** Une page HTML autonome sur le compte MyKiné (`docs/tests/performance-mockup/index.html`, CSS réel de l'app), refaite cinq fois avant la spec. Ce qu'elle a appris : une semaine comme unité (pas de 7/14/30 jours), un mois parcouru semaine par semaine, LinkedIn et X toujours ensemble, des chiffres de démo qui *progressent* (la première version baissait, le pire exemple), et surtout **de la hiérarchie** — trois maquettes où tout avait la même taille, « je me perds dans ce que je dois regarder ». Sources : Carbon (le plus important = le plus grand et le plus contrasté), Stephen Few, le skill dataviz. Icônes en trait, jamais d'emojis.

**Décisions clés.**
- **X par Apify** plutôt que par l'API officielle : ≈ 0,06 à 0,24 $ par utilisateur et par mois contre 0,60 à 3 $, et plus de compte de facturation ni d'OAuth de X pour les chiffres (les vues d'un post sont publiques). L'API officielle reste en repli. **LinkedIn reste sur l'API officielle** : un scraper ne voit pas les impressions.
- **`Posted` est posé par le rattachement** (promesse de E14 restée en suspens), avec un rattachement automatique quand un seul script ressemble nettement au post.
- Une colonne ajoutée, `post_metrics.published_at` : classer selon la date *prévue* serait faux dès qu'on publie un jour plus tard.

**Ce qu'on a trouvé en route.** L'en-tête `LinkedIn-Version: 202401` ne pouvait pas marcher (l'API des statistiques de posts date de 202506) : passé à 202606. Le code relisait 20 posts à chaque rafraîchissement de X (≈ 0,10 $ l'appel au tarif officiel), pas « les posts rattachés » comme la spec de septembre le supposait. Le compte de démo n'étant connecté à aucun réseau, l'écran affichait d'abord « Connect… » au lieu des chiffres : dès qu'il y a des posts, on les montre.

**Pas encore.** Un vrai acteur Apify contre un vrai compte (les champs de sortie sont supposés), l'accès LinkedIn, l'usage de ces chiffres par l'agent qui écrit et qui planifie.

**Après la revue à froid (2026-10-19).** Un agent relecteur sans contexte a rendu « corrections requises » sur cinq points, tous corrigés : lecture et rattachement filtrés par utilisateur (migration `0053`, unicité des candidats par utilisateur), contrôle de fréquence d'Apify pris avant l'appel et gardé en base, plafonds sur les nombres venant d'Apify et un échec par post qui n'arrête pas les autres, un script déjà lié refusé, rattachement automatique resserré (date et légende doivent toutes deux concorder). Il a aussi relevé un redirect ouvert préexistant dans `/api/auth/[platform]/connect` (`returnTo`), refermé au passage. Reste connu : pas de « délier » un post, semaines en UTC (un post du lundi 00:30 à Paris tombe dans la semaine d'avant), les tests ne couvrent pas les chemins qui touchent la base.

**Une semaine qui commence.** Un lundi à 00:58 l'écran montrait 0 et −100 % : la semaine neuve n'avait encore aucun chiffre. Règle : pas d'écart tant qu'aucun post de la semaine n'a de chiffres (tirets), et une pastille accent « Wait N days » à côté du pourcentage tant que le post le plus récent a moins de 3 jours (`daysUntilSettled`) ; le titre et la phrase restent neutres pendant ce temps. Le calcul est pur et testé ; les deux états sont dans `docs/tests/performance-screens/` (9 et 10).

**Se connecter depuis l'écran.** Sur la demande du fondateur : logos des réseaux restants en haut à droite, panneau de pseudo pour X, OAuth pour LinkedIn, page à tirets dès qu'un réseau est connecté. Les captures de chaque état se font avec Chrome et `playwright-core` en répondant aux appels d'API par des données fabriquées.

### Pièges de méthode (pour la prochaine fois)

- Les heredocs shell avec apostrophes ou backticks cassent la commande sous Git Bash : écrire les patchs dans un fichier avec l'outil d'écriture.
- Les worktrees `.claude/worktrees` polluent `vitest` : lancer `npx vitest run --exclude ".claude/**"`.
- `tsx` (esbuild) ajoute un `__name()` aux fonctions passées à `page.evaluate` : passer le code de la page sous forme de chaîne.
- Sous Git Bash, `MSYS_NO_PATHCONV=1` pour ne pas réécrire `/api/...` en chemin Windows.
- Un test qui exécute le JS du lecteur (`new Function`) a attrapé une faute d'échappement (`\n` dans un gabarit) qui aurait désactivé tout le lecteur sans erreur visible.

### État des branches

`feature/entree-par-le-repo` et `feature/app-design-tellovo` (qui l'inclut) : migrations `0047` à `0050` appliquées en **dev seulement**, **pas encore sur le VPS** (qui sert toujours la landing et les stories de la version précédente). Un déploiement demande : clé OpenAI, `GITHUB_TOKEN`, `START_DAILY_CAP`, les migrations, et la vérification des polices dans l'image.
