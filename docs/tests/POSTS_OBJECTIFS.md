# Les posts objectifs

> **Décidé le 2026-10-26** : ces six posts sont la barre. On ne s'arrête pas d'améliorer le rédacteur tant qu'il ne rend pas des posts de cette qualité à partir du dépôt tellovo. Chaque banc du rédacteur se compare à cette page.

Écrits à la main par Claude, au nom de l'auteur, sans passer par l'app, à partir de faits du projet, pendant le test « Tellovo sur Tellovo » (même jour). Ils ont été jugés « beaucoup plus intéressants, beaucoup plus impactants » que les six posts générés le même jour (relevé de ces derniers : `docs/TODO.md`, sections « Phases » et « Pointeurs sans intérêt »).

## Ce qui les rend meilleurs (à reproduire)

1. **Le choix du fait** : un échec vécu, un chiffre surprenant, une leçon à contre-courant, un raté drôle, une vraie question. Pas un écran ni un onglet.
2. **La connaissance de toute l'histoire** : le 17 octobre compte plus qu'un onglet retiré.
3. **Ce qu'on garde du fait** : l'enjeu humain, jamais la mécanique (aucune route, colonne, nombre de tests, état des migrations).
4. **Le ressenti de l'auteur** : ce que le fait lui a fait. C'est rarement dans la matière.

## Ce qui est vrai, ce qui a été inventé

Les phrases **inventées** sont marquées ⚠️ : elles ne sont dans aucune donnée et n'ont pas été confirmées par l'auteur. Elles font partie de ce qui rend ces posts bons, et c'est la question ouverte (inventer et signaler, ou demander à l'auteur, voir la décision en attente dans `docs/TODO.md`).

Faits vrais utilisés : le « j'arrête » du 17 octobre après des dizaines d'essais jamais publiables ; le banc du 21 octobre (6 paragraphes étiquetés sur 17 avec `gpt-5-mini`, 0 sur 12 avec le modèle plus fort) et la loi « une règle nommée ressort dans le texte » ; 1 880 pointeurs sur le dépôt tellovo, la moitié tirés des specs ; la version X du 26 octobre qui parlait de patients en kinésithérapie (exemple MyKiné d'une spec) ; aucun développeur extérieur n'a encore testé.

---

## 1. Origine

Les développeurs ont déjà écrit leurs meilleurs posts. Ils ne le savent pas.

Un dépôt, c'est des mois de décisions, d'erreurs, de petites victoires. Un journal de bord, des notes, des tâches fermées. Toute l'histoire d'un produit est là, datée, vraie.

Et pourtant, on ne publie rien. Parce que transformer ça en post prend une soirée, et qu'on préfère coder. Parce que demander à une IA donne un texte qui pourrait parler de n'importe quel produit.

Je construis Tellovo pour ça : il lit ce que tu construis vraiment, ton dépôt, tes notes, et il écrit tes posts de la semaine à partir de ce qui s'est passé. Rien d'inventé.

Et je vais le construire comme il est censé te faire publier : en public. Les ratés compris.

## 2. Échec

Le 17 octobre, j'ai dit « j'arrête ».

Des dizaines d'essais. Des posts générés, relus, jetés. Avec des documents, sans documents, avec plus de règles, avec moins. Jamais un que j'aurais publié sous mon nom.

Le problème n'était pas technique. L'outil marchait : il lisait, il écrivait, il rangeait tout dans un calendrier. Il écrivait juste des posts que personne n'aurait lus jusqu'au bout.

⚠️ J'ai fermé l'ordinateur ce soir-là sans savoir si je le rouvrirais pour ce projet.

Je l'ai rouvert. Mais je n'ai toujours pas trouvé ce qui fait qu'un post donne envie de lire la deuxième ligne.

## 3. Leçon

J'ai passé quatre jours à écrire des règles pour mon IA. Changer de modèle a fait mieux en une ligne.

Même consigne, même matière, deux modèles. Le premier rendait des posts découpés en rubriques : « Bilan factuel : », « Ce que ça coûte : ». Sur 17 paragraphes, 6 portaient une étiquette. Le second racontait des histoires : 0 étiquette sur 12, et il gardait les détails humains des notes.

J'avais ajouté règle sur règle pour corriger le premier. Et j'ai fini par comprendre pourquoi ça empirait : chaque règle que tu donnes à un modèle finit par apparaître dans le texte. Tu lui demandes de parler du coût, il écrit « Ce que ça coûte : ».

Avant d'ajouter une consigne, change d'outil. Et quand tu ajoutes une consigne, demande-toi comment elle va ressortir dans le texte.

## 4. Chiffre

1 880 morceaux d'histoire pour écrire 6 posts.

C'est ce que Tellovo a trouvé en lisant son propre dépôt cette semaine. Chaque décision, chaque livraison, chaque erreur notée quelque part devient une piste de post.

Le problème : la moitié venait de documents où j'écris ce que je compte faire, pas ce qui s'est passé. Un plan n'est pas une histoire. Résultat, des posts sur des détails d'écran que même moi je ne lisais pas en entier.

J'ai changé l'ordre : d'abord ce qui est arrivé ces derniers jours, ensuite seulement le reste. Les posts parlent de la semaine écoulée.

Ce qui manque encore, c'est le tri entre ce qui est arrivé et ce qui mérite d'être raconté.

## 5. Épisode

Aujourd'hui, mon outil de build in public a écrit un post sur des patients en kinésithérapie.

Je l'ai fait tourner sur son propre dépôt. Il a lu les documents, écrit six posts sur Tellovo, en version LinkedIn et en version X. Le LinkedIn du lundi racontait pourquoi le projet existe. Sa version X ouvrait sur « 6 patients sur 10 ne font pas leurs exercices ».

La phrase venait d'un exemple que j'avais glissé dans une spec, il y a des semaines, pour tester un autre cas. L'outil l'a trouvée, l'a crue, et l'a publiée.

J'ai corrigé le fond du problème : la version X n'est plus écrite à part, c'est le même post adapté. Mais je retiens surtout ça : un outil qui lit tout croit tout.

## 6. Question

Je cherche à comprendre une chose avant d'aller plus loin.

Je construis un outil qui écrit tes posts LinkedIn et X à partir de ton dépôt et de tes notes. Aucun développeur extérieur ne l'a encore essayé. Et avant de le mettre entre leurs mains, je veux savoir ce qui bloque vraiment.

Ce que je sais déjà : le manque de temps revient tout le temps. Mais j'ai l'impression que ce n'est pas le vrai frein. ⚠️ Beaucoup de devs que je connais ont le temps de tweeter, pas de raconter ce qu'ils construisent.

Si tu développes un outil et que tu ne publies presque rien dessus : qu'est-ce qui t'arrête, concrètement, au moment d'écrire ?
