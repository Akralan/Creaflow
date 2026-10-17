# Décisions

Une entrée par décision. Contexte, choix, ce qu'on y perd. Ne pas réécrire une décision prise : en ajouter une nouvelle si on revient dessus.

## 2025-11-23 — Pose estimation sur l'appareil, pas côté serveur

Contexte : le proto web envoie des frames au serveur pour MediaPipe, 300 à 600 ms de latence sur la 4G de Julien, et des images de patients en sous-vêtements qui transitent.
Choix : tout tourne sur le téléphone. Le serveur ne reçoit que des angles et des compteurs.
Perdu : les vieux téléphones seront lents. On verra au cas par cas.

## 2026-02-07 — Pas de compte patient

Contexte : un patient qui doit créer un compte, un mot de passe, confirmer un email, ne fera jamais sa première séance.
Choix : le kiné entre un numéro de téléphone, le patient reçoit un SMS avec un lien `mykine.app/s/<code>`. Le code ouvre son programme. Pas de mot de passe. Le lien expire avec le programme.
Perdu : si le téléphone change de main, le programme est visible. Accepté : il n'y a ni nom ni vidéo dedans.

## 2026-03-14 — Caméra à 45° obligatoire

Contexte : de profil, le genou avant masque le genou arrière, le squelette saute (démo du 7 mars, Marion). De face, on ne voit pas la flexion.
Choix : avant chaque séance, l'app demande au patient de se placer de trois quarts et vérifie que les deux hanches et les deux genoux sont visibles avec une confiance > 0,6 pendant 2 secondes. Sinon elle ne démarre pas.
Perdu : 10 à 20 secondes au début de chaque séance. C'est le prix.

## 2026-04-05 — Modèle `full` avec saut d'images

Contexte : le modèle `lite` donne des angles qui vibrent de ± 6° en bas du squat, ce qui fait compter double. Le `full` est stable mais tourne à 9 fps sur un Pixel 4a.
Choix : `full` partout, et on ne traite qu'une image sur deux quand le téléphone passe sous 12 fps. 5 à 6 angles par seconde suffisent pour un squat.
Perdu : un petit retard visible sur le squelette affiché. Personne ne s'en est plaint.

## 2026-06-02 — Ne jamais stocker de vidéo

Contexte : pour déboguer les faux positifs on voulait pouvoir revoir les séances. Mais une vidéo d'un patient chez lui, c'est une donnée de santé et une donnée intime. Et Julien n'a pas le temps de regarder des vidéos.
Choix : aucune image ne quitte le téléphone, jamais, même en opt-in. On garde la série d'angles à 10 Hz et les événements du compteur. Pour déboguer, on filme nous-mêmes, nous.
Perdu : on ne saura jamais exactement ce qu'il s'est passé chez un patient. On a les angles, c'est tout.

## 2026-06-21 — Feedback en direct par couleur

Contexte : « je ne sais pas si je le fais bien » (patiente du pilote 1). Le score en fin de séance arrive trop tard.
Choix : pendant l'exercice, le segment concerné (cuisse, bras) est dessiné en vert quand l'angle est dans la cible, orange proche, rouge hors cible. Pas de texte, pas de chiffre.
Perdu : un patient peut forcer pour « avoir du vert ». Julien dit que c'est aussi ce qu'ils font en cabinet.

## 2026-08-30 — Retirer les exercices au sol

Contexte : pont fessier et gainage, allongé : le modèle perd le bassin dès que le dos touche le sol, et les hanches se retrouvent derrière la cuisse. Trois semaines d'essais (recadrage, caméra posée au sol, modèle heavy), rien de fiable.
Choix : les 3 exercices au sol sortent du catalogue de la v0.4. On les remet quand le modèle le permettra, pas avant.
Perdu : les programmes de lombalgie de Marion, qui sont presque tous au sol. Elle garde ses patients sur papier pour ceux-là.

## 2026-10-03 — Pas d'hébergeur HDS pour l'instant

Contexte : des séances d'exercices prescrites par un kiné, c'est de la donnée de santé. Un hébergeur certifié HDS coûte entre 150 et 400 € par mois d'après les devis, pour 8 kinés qui paient 29 €.
Choix : anonymiser plutôt que certifier. Le serveur ne connaît ni nom, ni date de naissance, ni pathologie : le kiné choisit un pseudonyme par patient, le numéro de téléphone est haché après l'envoi du SMS. Si on dépasse 30 kinés, on repose la question.
Perdu : le kiné doit retenir que « Lapin bleu » c'est Mme R. On lui laisse une note en local dans son navigateur.
