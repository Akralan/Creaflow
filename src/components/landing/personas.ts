/**
 * The three faces of the priority target (docs/PRODUCT.md §2.1) that take turns in the
 * landing examples: build-in-public developer, non-technical founder, independent
 * in personal branding. The generic copy (title, promise, sections) does not change;
 * only the concrete examples rotate, so none of the three feels left out.
 */
export type SourceKind = "github" | "notion" | "linear" | "file";

export type Persona = {
  id: string;
  /** Badge above the hero title. */
  badge: string;
  /** Title of the demo window. */
  windowTitle: string;
  /** Connected sources, shown at the top of the demo. */
  sources: Array<{ kind: SourceKind; name: string; detail: string }>;
  /** The week's posts in the demo. */
  schedule: Array<{ title: string; meta: string; highlighted?: boolean; phoneHidden?: boolean }>;
  /** The drafted post in the demo. */
  post: {
    format: string;
    hook: string;
    body: string;
    provenance: Array<{ kind: SourceKind; label: string }>;
  };
  /** "Reading in progress" line under the post. */
  reading: string;
  /** "Material → post" visual of the first features card. */
  proof: {
    sources: Array<{ kind: SourceKind; meta: string; text: string }>;
    postLabel: string;
    postHook: string;
  };
  /** "Your audience" card of the "What changes" section (LandingOutcomes). */
  audience: {
    followers: string;
    /** Growth shown at the top of the card. */
    delta: string;
    /** What the audience brings in: the line about money. */
    signal: string;
    /** Follower curve, points normalized 0-100. */
    curve: number[];
  };
};

export const personas: Persona[] = [
  {
    id: "dev",
    badge: "For developers who build in public",
    windowTitle: "buildloud — build in public",
    sources: [
      { kind: "github", name: "akralan/buildloud", detail: "4 commits" },
      { kind: "notion", name: "Dev log", detail: "2 pages" },
    ],
    schedule: [
      { title: "Why I deleted 1,200 lines of code", meta: "MON · LINKEDIN" },
      { title: "The bug that cost me a night", meta: "WED · X", phoneHidden: true },
      { title: "3 decisions from this month, and what they cost", meta: "FRI · LINKEDIN · NEW", highlighted: true },
    ],
    post: {
      format: "LINKEDIN · TEXT",
      hook: "Yesterday I deleted 1,200 lines of code. Best decision of the month.",
      body: "The homegrown cache had been around for a year and broke once a week. Postgres does the job, no surprises.",
      provenance: [
        { kind: "github", label: "commit 3f2a1c" },
        { kind: "notion", label: "Decisions.md" },
      ],
    },
    reading: "Buildloud is reading your 4 new commits…",
    proof: {
      sources: [
        { kind: "github", meta: "commit 3f2a1c · yesterday", text: "refactor: remove homegrown cache (-1,200 lines), Postgres is enough" },
        { kind: "notion", meta: "Decisions.md · Tuesday", text: "We're done maintaining the cache: 3 incidents this month, no measurable gain." },
      ],
      postLabel: "LINKEDIN POST · THURSDAY",
      postHook: "Yesterday I deleted 1,200 lines of code. Best decision of the month.",
    },
    audience: {
      followers: "1,240",
      delta: "+312 THIS MONTH",
      signal: "38 waitlist signups",
      curve: [8, 12, 15, 22, 26, 35, 44, 52, 63, 74, 88, 100],
    },
  },
  {
    id: "fondateur",
    badge: "For founders who share their journey",
    windowTitle: "buildloud — v2 launch",
    sources: [
      { kind: "notion", name: "Dev log", detail: "3 pages" },
      { kind: "linear", name: "v2 launch", detail: "5 issues" },
    ],
    schedule: [
      { title: "Why we said no to our biggest client", meta: "MON · LINKEDIN" },
      { title: "The number we never show", meta: "WED · INSTAGRAM", phoneHidden: true },
      { title: "What a failed launch really costs", meta: "FRI · LINKEDIN · NEW", highlighted: true },
    ],
    post: {
      format: "LINKEDIN · TEXT",
      hook: "We turned down $40,000 last week. Here's why.",
      body: "The client wanted a custom version. Six months of work for a single account, while the other 200 waited for v2.",
      provenance: [
        { kind: "notion", label: "Dev log · Monday" },
        { kind: "linear", label: "issue #214" },
      ],
    },
    reading: "Buildloud is reading your 3 new pages…",
    proof: {
      sources: [
        { kind: "notion", meta: "Dev log · Monday", text: "Declined the custom proposal: $40k, but six months for a single account." },
        { kind: "linear", meta: "issue #214 · closed", text: "v2 launch: onboarding cut from 12 steps to 4." },
      ],
      postLabel: "LINKEDIN POST · THURSDAY",
      postHook: "We turned down $40,000 last week. Here's why.",
    },
    audience: {
      followers: "2,870",
      delta: "+405 THIS MONTH",
      signal: "12 demo requests this week",
      curve: [20, 24, 27, 31, 38, 42, 50, 57, 66, 75, 86, 100],
    },
  },
  {
    id: "independant",
    badge: "For freelancers who keep notes",
    windowTitle: "buildloud — 2026 projects",
    sources: [
      { kind: "notion", name: "Meeting notes", detail: "6 pages" },
      { kind: "file", name: "notes-mission.md", detail: "pasted" },
    ],
    schedule: [
      { title: "3 questions every client asks me", meta: "MON · LINKEDIN" },
      { title: "What I learned from a failed project", meta: "WED · LINKEDIN", phoneHidden: true },
      { title: "My rate changed, and here's why", meta: "FRI · LINKEDIN · NEW", highlighted: true },
    ],
    post: {
      format: "LINKEDIN · TEXT",
      hook: "A client asked me for a discount. I said no, and they signed.",
      body: "Since January, I price the outcome before the time spent. Three proposals, three signatures, no negotiation.",
      provenance: [
        { kind: "file", label: "notes-mission.md" },
        { kind: "notion", label: "Notes · Oct 3" },
      ],
    },
    reading: "Buildloud is reading your 2 new meeting notes…",
    proof: {
      sources: [
        { kind: "file", meta: "notes-mission.md · yesterday", text: "15% discount request. Declined, proposal unchanged. Signed the next day." },
        { kind: "notion", meta: "Meeting notes · Oct 3", text: "New pricing grid: price the expected outcome, not the time spent." },
      ],
      postLabel: "LINKEDIN POST · THURSDAY",
      postHook: "A client asked me for a discount. I said no, and they signed.",
    },
    audience: {
      followers: "960",
      delta: "+184 THIS MONTH",
      signal: "4 inbound quote requests",
      curve: [10, 14, 13, 20, 27, 30, 39, 48, 55, 68, 82, 100],
    },
  },
];
