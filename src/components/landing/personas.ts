/**
 * Les trois visages de la cible prioritaire (docs/PRODUCT.md §2.1) qui se relaient dans les
 * exemples de la landing : développeur build in public, fondateur non technique, indépendant
 * en personal branding. Les textes génériques (titre, promesse, sections) ne changent pas ;
 * seuls les exemples concrets tournent, pour qu'aucun des trois ne se sente exclu.
 */
export type SourceKind = "github" | "notion" | "linear" | "file";

export type Persona = {
  id: string;
  /** Pastille au-dessus du titre du hero. */
  badge: string;
  /** Titre de la fenêtre de démo. */
  windowTitle: string;
  /** Sources branchées, affichées en haut de la démo. */
  sources: Array<{ kind: SourceKind; name: string; detail: string }>;
  /** Les posts de la semaine dans la démo. */
  schedule: Array<{ title: string; meta: string; highlighted?: boolean; phoneHidden?: boolean }>;
  /** Le post rédigé dans la démo. */
  post: {
    format: string;
    hook: string;
    body: string;
    provenance: Array<{ kind: SourceKind; label: string }>;
  };
  /** Ligne « lecture en cours » sous le post. */
  reading: string;
  /** Visuel « matière → post » de la première carte des fonctionnalités. */
  proof: {
    sources: Array<{ kind: SourceKind; meta: string; text: string }>;
    postLabel: string;
    postHook: string;
  };
  /** Carte « Ton audience » de la section « Ce que ça change » (LandingOutcomes). */
  audience: {
    followers: string;
    /** Progression affichée en haut de la carte. */
    delta: string;
    /** Ce que l'audience rapporte : la ligne qui parle d'argent. */
    signal: string;
    /** Courbe d'abonnés, points normalisés 0-100. */
    curve: number[];
  };
};

export const personas: Persona[] = [
  {
    id: "dev",
    badge: "Pour les développeurs qui construisent en public",
    windowTitle: "creaflow — build in public",
    sources: [
      { kind: "github", name: "akralan/creaflow", detail: "4 commits" },
      { kind: "notion", name: "Journal de bord", detail: "2 pages" },
    ],
    schedule: [
      { title: "Pourquoi j'ai supprimé 1 200 lignes de code", meta: "LUN · LINKEDIN" },
      { title: "Le bug qui m'a coûté une nuit", meta: "MER · X", phoneHidden: true },
      { title: "3 décisions prises ce mois, et ce qu'elles coûtent", meta: "VEN · LINKEDIN · NOUVEAU", highlighted: true },
    ],
    post: {
      format: "LINKEDIN · TEXTE",
      hook: "Hier, j'ai supprimé 1 200 lignes de code. Meilleure décision du mois.",
      body: "Le cache maison tenait depuis un an et tombait une fois par semaine. Postgres fait le travail, sans surprise.",
      provenance: [
        { kind: "github", label: "commit 3f2a1c" },
        { kind: "notion", label: "Décisions.md" },
      ],
    },
    reading: "CreaFlow lit tes 4 nouveaux commits…",
    proof: {
      sources: [
        { kind: "github", meta: "commit 3f2a1c · hier", text: "refactor: supprime le cache maison (-1 200 lignes), Postgres suffit" },
        { kind: "notion", meta: "Décisions.md · mardi", text: "On arrête de maintenir le cache : 3 incidents ce mois, aucun gain mesuré." },
      ],
      postLabel: "POST LINKEDIN · JEUDI",
      postHook: "Hier, j'ai supprimé 1 200 lignes de code. Meilleure décision du mois.",
    },
    audience: {
      followers: "1 240",
      delta: "+312 CE MOIS",
      signal: "38 inscrits à la liste d'attente",
      curve: [8, 12, 15, 22, 26, 35, 44, 52, 63, 74, 88, 100],
    },
  },
  {
    id: "fondateur",
    badge: "Pour les fondateurs qui racontent leur projet",
    windowTitle: "creaflow — lancement v2",
    sources: [
      { kind: "notion", name: "Journal de bord", detail: "3 pages" },
      { kind: "linear", name: "Lancement v2", detail: "5 issues" },
    ],
    schedule: [
      { title: "Pourquoi on a dit non à notre plus gros client", meta: "LUN · LINKEDIN" },
      { title: "Le chiffre qu'on ne montre jamais", meta: "MER · INSTAGRAM", phoneHidden: true },
      { title: "Ce que coûte vraiment un lancement raté", meta: "VEN · LINKEDIN · NOUVEAU", highlighted: true },
    ],
    post: {
      format: "LINKEDIN · TEXTE",
      hook: "On a refusé 40 000 € la semaine dernière. Voilà pourquoi.",
      body: "Le client voulait une version sur mesure. Six mois de travail pour un seul compte, pendant que les 200 autres attendaient la v2.",
      provenance: [
        { kind: "notion", label: "Journal · lundi" },
        { kind: "linear", label: "issue #214" },
      ],
    },
    reading: "CreaFlow lit tes 3 nouvelles pages…",
    proof: {
      sources: [
        { kind: "notion", meta: "Journal de bord · lundi", text: "Refusé la proposition sur mesure : 40 k€, mais six mois pour un seul compte." },
        { kind: "linear", meta: "issue #214 · fermée", text: "Lancement v2 : onboarding réduit de 12 à 4 étapes." },
      ],
      postLabel: "POST LINKEDIN · JEUDI",
      postHook: "On a refusé 40 000 € la semaine dernière. Voilà pourquoi.",
    },
    audience: {
      followers: "2 870",
      delta: "+405 CE MOIS",
      signal: "12 demandes de démo cette semaine",
      curve: [20, 24, 27, 31, 38, 42, 50, 57, 66, 75, 86, 100],
    },
  },
  {
    id: "independant",
    badge: "Pour les indépendants qui tiennent des notes",
    windowTitle: "creaflow — missions 2026",
    sources: [
      { kind: "notion", name: "Comptes rendus", detail: "6 pages" },
      { kind: "file", name: "notes-mission.md", detail: "collé" },
    ],
    schedule: [
      { title: "3 questions que me posent tous mes clients", meta: "LUN · LINKEDIN" },
      { title: "Ce que j'ai appris d'une mission ratée", meta: "MER · LINKEDIN", phoneHidden: true },
      { title: "Mon tarif a changé, et voici pourquoi", meta: "VEN · TIKTOK · NOUVEAU", highlighted: true },
    ],
    post: {
      format: "LINKEDIN · TEXTE",
      hook: "Un client m'a demandé une remise. J'ai dit non, et il a signé.",
      body: "Depuis janvier, je chiffre le résultat avant le temps passé. Trois propositions, trois signatures, aucune négociation.",
      provenance: [
        { kind: "file", label: "notes-mission.md" },
        { kind: "notion", label: "CR du 3 oct." },
      ],
    },
    reading: "CreaFlow lit tes 2 nouveaux comptes rendus…",
    proof: {
      sources: [
        { kind: "file", meta: "notes-mission.md · hier", text: "Demande de remise de 15 %. Refusée, proposition maintenue. Signée le lendemain." },
        { kind: "notion", meta: "Compte rendu · 3 oct.", text: "Nouvelle grille : chiffrer le résultat attendu, plus le temps passé." },
      ],
      postLabel: "POST LINKEDIN · JEUDI",
      postHook: "Un client m'a demandé une remise. J'ai dit non, et il a signé.",
    },
    audience: {
      followers: "960",
      delta: "+184 CE MOIS",
      signal: "4 demandes de devis entrantes",
      curve: [10, 14, 13, 20, 27, 30, 39, 48, 55, 68, 82, 100],
    },
  },
];
