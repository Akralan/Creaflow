/**
 * Les genres d'événements et les formes de posts (docs/FORMES_ET_GENRES.md).
 *
 * Un pointeur porte un `genre` : ce qu'est le fait, parmi treize valeurs fermées. C'est la seule
 * exception à « un événement n'a aucun champ » (docs/SPEC_EVENEMENT_POINTEUR.md §2) : une
 * classification faite au moment où le lecteur lit déjà la ligne, pas un résumé ni un titre.
 *
 * La forme d'un post découle du genre de l'événement choisi, par une table un pour un (`formFor`).
 * Le rédacteur ne reçoit JAMAIS les seize formes dans son prompt — loi du DEVLOG 2026-10-21 : tout
 * élément nommé ressort dans le texte. Il reçoit la table genre → forme et lit la forme de son
 * genre avec l'outil `read_form`, dont `formText` est la réponse.
 *
 * Les identifiants de genre sont ceux de la spec, en français, pour que spec, prompt, base et banc
 * parlent le même mot. Les formes et les étiquettes sont en anglais, comme l'app.
 */
import type { Phase } from "@/lib/phases";
import { POST_EXAMPLES } from "./postExamples.generated";

export const GENRES = [
  "livraison",
  "annonce",
  "décision",
  "question",
  "chiffre",
  "échec",
  "leçon",
  "engagement",
  "offre",
  "retour_utilisateur",
  "déclencheur",
  "coulisse",
  "réaction",
] as const;
export type Genre = (typeof GENRES)[number];

export function isGenre(value: unknown): value is Genre {
  return typeof value === "string" && (GENRES as readonly string[]).includes(value);
}

/** Les genres qu'un événement ultérieur peut « tenir » (règle 14 de la spec). */
export const HOLDABLE_GENRES = ["engagement", "annonce", "décision"] as const satisfies readonly Genre[];
export type HoldableGenre = (typeof HOLDABLE_GENRES)[number];

export const FORMS = [
  "episode",
  "launch",
  "teaser",
  "number",
  "failure",
  "lesson",
  "proof",
  "promise",
  "promise_kept",
  "looking_back",
  "offer",
  "question",
  "backstage",
  "curation",
  "origin",
  // Ajoutées le 2026-10-26 avec les phases (docs/TODO.md) : montrer le produit marcher pendant la
  // construction, et appeler des testeurs en bêta. Sans modèle dans le relevé LinkedIn.
  "demo",
  "beta_call",
] as const;
export type Form = (typeof FORMS)[number];

export function isForm(value: unknown): value is Form {
  return typeof value === "string" && (FORMS as readonly string[]).includes(value);
}

/** L'étiquette que l'auteur voit sur la carte et en tête du post. `null` : pas d'étiquette (épisode). */
export const FORM_LABELS: Record<Form, string | null> = {
  episode: null,
  launch: "Launch",
  teaser: "Coming soon",
  number: "Number",
  failure: "Failure",
  lesson: "What I learned",
  proof: "User story",
  promise: "Promise",
  promise_kept: "Promise kept",
  looking_back: "Looking back",
  offer: "Offer",
  question: "Question",
  backstage: "Behind the scenes",
  curation: "Reading",
  origin: "Origin",
  demo: "Demo",
  beta_call: "Beta call",
};

const GENRE_FORM: Record<Genre, Form> = {
  livraison: "episode",
  annonce: "teaser",
  décision: "episode",
  question: "question",
  chiffre: "number",
  échec: "failure",
  leçon: "lesson",
  engagement: "promise",
  offre: "offer",
  retour_utilisateur: "proof",
  déclencheur: "origin",
  coulisse: "backstage",
  réaction: "curation",
};

/**
 * Les formes que chaque phase permet (docs/TODO.md, « Phases du projet », répartition validée le
 * 2026-10-26). `launch` n'existe qu'au lancement : avant, une livraison utilisable est une démo.
 */
export const PHASE_FORMS: Record<Phase, readonly Form[]> = {
  engage: ["origin", "backstage", "lesson", "question", "promise", "curation"],
  build: ["episode", "demo", "backstage", "lesson", "failure", "number", "question", "promise", "promise_kept", "looking_back", "teaser", "curation"],
  beta: ["beta_call", "demo", "episode", "failure", "question", "teaser", "promise_kept", "backstage"],
  launch: ["launch", "offer", "demo", "proof"],
  grow: ["number", "proof", "lesson", "failure", "looking_back", "promise_kept", "offer", "episode", "curation", "backstage"],
};

/** La forme d'un événement dont la forme naturelle n'est pas permise dans la phase. */
const PHASE_FALLBACK: Record<Phase, Form> = {
  engage: "backstage",
  build: "episode",
  beta: "episode",
  launch: "demo",
  grow: "episode",
};

export function isFormAllowed(form: Form, phase: Phase | null | undefined): boolean {
  return !phase || PHASE_FORMS[phase].includes(form);
}

/** Ce qu'une livraison utilisable par d'autres devient, selon la phase. Sans phase : un lancement. */
function availableDeliveryForm(phase: Phase | null | undefined): Form {
  if (!phase || phase === "launch") return "launch";
  if (phase === "build" || phase === "beta") return "demo";
  return "episode";
}

/**
 * La table genre → forme de la spec. `tient` gagne sur le genre : un événement qui réalise un
 * engagement est une promesse tenue, qui revient sur une décision est un « looking back », qui
 * réalise une annonce est un lancement. Puis la disponibilité fait d'une livraison un lancement.
 *
 * Avec une phase, le lancement et l'offre prennent la forme de la phase (démo, appel à bêta), et une
 * forme que la phase ne permet pas retombe sur celle de la phase (`PHASE_FALLBACK`).
 */
export function formFor(entry: { genre: Genre; disponible: boolean; tientGenre: Genre | null }, phase?: Phase | null): Form {
  const natural = naturalForm(entry, phase);
  return isFormAllowed(natural, phase) ? natural : PHASE_FALLBACK[phase as Phase];
}

function naturalForm(entry: { genre: Genre; disponible: boolean; tientGenre: Genre | null }, phase: Phase | null | undefined): Form {
  if (entry.tientGenre === "engagement") return "promise_kept";
  if (entry.tientGenre === "décision") return "looking_back";
  if (entry.tientGenre === "annonce") return availableDeliveryForm(phase);
  if (entry.genre === "livraison" && entry.disponible) return availableDeliveryForm(phase);
  if (entry.genre === "offre" && phase === "beta") return "beta_call";
  return GENRE_FORM[entry.genre];
}

/** La table en une ligne par genre, pour le prompt du rédacteur. Rien d'autre : pas de rubrique de forme. */
export function genreToFormTable(phase?: Phase | null): string {
  if (!phase) {
    const rows = GENRES.map((g) => `${g} → ${GENRE_FORM[g]}`);
    rows.splice(1, 0, "livraison, marked (available) → launch");
    return [
      ...rows,
      "an event that fulfills an earlier engagement → promise_kept",
      "an event that fulfills an earlier annonce → launch",
      "an event that looks back on an earlier décision → looking_back",
    ].join("\n");
  }
  const at = (genre: Genre, extra: Partial<{ disponible: boolean; tientGenre: Genre }> = {}) =>
    formFor({ genre, disponible: extra.disponible ?? false, tientGenre: extra.tientGenre ?? null }, phase);
  const rows = GENRES.map((g) => `${g} → ${at(g)}`);
  rows.splice(1, 0, `livraison, marked (available) → ${at("livraison", { disponible: true })}`);
  return [
    ...rows,
    `an event that fulfills an earlier engagement → ${at("livraison", { tientGenre: "engagement" })}`,
    `an event that fulfills an earlier annonce → ${at("livraison", { tientGenre: "annonce" })}`,
    `an event that looks back on an earlier décision → ${at("livraison", { tientGenre: "décision" })}`,
  ].join("\n");
}

/**
 * Qui parle (docs/FORMES_ET_GENRES.md, « La personne qui parle »). Préambule commun à toutes les
 * formes, rendu par `read_form`, pour que le prompt système garde ses quatre phrases.
 */
export const WHO_SPEAKS = `Who speaks. The post is written by the author, not about them. Say "I" when the notes you read say "I", say "we" when they say "we" or name a team, and keep the person of the notes you read for this post — a solo author who writes "we" in their devlog keeps their "we". Three forms are always in the first person singular, because the author is the one exposed: promise, failure, backstage. Never the institutional "we are thrilled to announce", and never the product as the subject of a sentence where the author acted ("X now lets you" where the notes say "I wired").`;

interface FormSpec {
  reads: string;
  opens: string;
  body: string;
  ends: string;
  never: string;
}

const FORM_SPECS: Record<Form, FormSpec> = {
  // Réécrite le 2026-10-26 (docs/tests/POSTS_OBJECTIFS.md) : l'ancienne forme était un patron de
  // changelog — le fait, l'avant, la raison, « ce que ça change pour l'utilisateur » — et le rédacteur
  // la suivait à la lettre.
  episode: {
    reads: "one event — and around it, enough to find what it meant to the author.",
    opens: "on the moment, not on the change: where the author was, what they saw, what went wrong or surprised them.",
    body:
      "what was at stake for them, then what they did. The change itself comes as part of the story, said the way the author would say it to a friend — never the way it reads in the code.",
    ends: "on where it leaves them: what they understood, what still bothers them, what comes next. Never on a summary of the change.",
    never: "a changelog, a before/after list of features, the names of the machinery.",
  },
  launch: {
    reads: "one event, plus the announcement it fulfills if there is one.",
    opens:
      "on the announcement in the present tense, with the name of the thing and a number of scale or price in the first sentence (\"130M local businesses, live today\"; \"$27 a month\").",
    body:
      "who it is for, said as a situation (\"if you sell to restaurants, salons...\"); then why it did not exist before, in two sentences at most; then what it replaces.",
    ends: "on access: where, how, on what terms.",
    never: "a feature list of more than three items, a superlative without a number.",
  },
  teaser: {
    reads: "one event.",
    opens: "on the date or the delay (\"next week, the day before X\"; \"tomorrow\").",
    body:
      "what can be said, in two lines: who it is for and at what scale. What cannot be said is said as such (\"I can't share the details yet\"), once.",
    ends: "on the date or the place, repeated.",
    never: "\"stay tuned\" without a date, more than one teaser per release, a disguised description of the product.",
  },
  number: {
    reads: "one event, plus the previous number of the same indicator if the timeline has one.",
    opens:
      "on the number and its context in the same sentence (\"RB2B makes $10M ARR with 1 employee\"; \"2,000 users one week after self-serve\").",
    body: "the point of comparison (before, usual range, target), then how, crediting who did what.",
    ends: "on one short sentence saying what this number makes possible, or not yet. No projected number.",
    never: "several unrelated numbers, a percentage without its base, a market number.",
  },
  // Réécrite le 2026-10-26 (docs/tests/POSTS_OBJECTIFS.md) : elle rendait trois phrases sèches.
  failure: {
    reads: "one event — and around it, what the author expected.",
    opens: "on what was expected, then the gap, in two short sentences.",
    body: "how the author lived it: the moment they saw it, what they tried, what it cost them — time, confidence, plans. The facts in order, nothing softened.",
    ends: "on where it leaves them: unresolved if it is, or what they now understand. Never on a forced happy turn.",
    never: "an excuse, a culprit, a lesson tacked on at the end, the names of the machinery.",
  },
  lesson: {
    reads: "one event.",
    opens:
      "on the fact that earns the right to speak: what was done or measured, with its volume (\"20M emails analysed\"; \"6,000 tweets since 2020, then I looked at my data\").",
    body:
      "the rule, in one sentence, then what backs it. If the material holds several rules, a short numbered list; otherwise one rule, developed.",
    ends: "on the rule, restated in one line. No offer, no link.",
    never: "general advice without a fact, a list of more than seven items, the imperative second person all the way through.",
  },
  proof: {
    reads: "one event.",
    opens:
      "on the person and their result in the first sentence (\"one of my users billed $45,000...\"; \"our best rep closed five deals in a day\").",
    body:
      "who they are, in one or two concrete lines (\"not a programmer, runs two businesses alone from Tennessee\"); what they did, in order; the product named once, at the moment it comes in.",
    ends: "on their words or their number, not the author's.",
    never: "an adjective on the product, a \"testimonial\" announced as such, a conclusion by the author.",
  },
  promise: {
    reads: "one event.",
    opens:
      "on the deadline and the number, in the first person (\"by December 31st, 1M views\"; \"in two years, $24M ARR with fewer than five people\").",
    body: "what triggered the commitment (a recent fact), then the path in two or three steps, then today's starting point, as a number.",
    ends: "on the starting point. It is what lets the follow-up post say \"I said X, I started from Y\".",
    never: "the conditional, \"I hope\", a commitment without a date.",
  },
  // Sa propre forme depuis le 2026-10-26 (elle prenait celle de promise_kept, qui rendait une liste
  // de changements « dans l'ordre, avec les chiffres »).
  looking_back: {
    reads: "two events: the original decision (open it at the address the timeline gives you) and the one that comes back to it.",
    opens: "on the decision as the author made it, with its moment and what they were betting on (\"Two weeks ago, I bet that…\").",
    body:
      "what made it a bet — what they feared, what they hoped; then what actually happened since, told as what the author lived, not as a list of changes; the verdict, in their own words.",
    ends: "on what the author thinks now: kept, regretted, or still unsure.",
    never: "a list of what was changed, a justification of the original decision, the names of the machinery.",
  },
  promise_kept: {
    reads:
      "two events: the original one (the engagement or the decision, which you open at the address the timeline gives you) and the one that comes back to it.",
    opens:
      "by quoting the original with its anchor in time, word for word (\"9 months ago I said 100 hires in 12 months\"; \"we spent $2M telling the world to stop hiring humans\"; \"16 weeks ago I decided to stop writing code\").",
    body:
      "the verdict in one sentence (\"it's a slog\"; \"today we're taking it all back\"; \"it holds, and it's still growing\"); then what happened in between, in order, with the numbers; then the decision that comes out of it.",
    ends: "on the new concrete state, not on a lesson.",
    never: "an excuse, a justification of the original promise or decision, a softened restatement of what was said.",
  },
  offer: {
    reads: "one event.",
    opens:
      "on what is offered and to whom, in the first sentence (\"if you run a finance or health blog, I pay double in October\"; \"Ava 2.0 free, $300 in credits, no card\").",
    body: "why now (one fact: \"I don't have enough blogs for my buyers\"), the terms, what the person gets, in numbers.",
    ends: "on the precise action and its deadline (\"reply with your blog\"; \"before the end of the month\").",
    never: "a superlative, several asks, a link without context, manufactured urgency.",
  },
  question: {
    reads: "one event.",
    opens: "on the situation in one sentence (\"I'm in San Francisco next week\"; \"I'm preparing an ultra-endurance challenge\").",
    body: "the options and what the author already knows, without deciding.",
    ends: "on the question, a single one, precise, as the last sentence.",
    never: "a rhetorical question, several questions, \"what do you think?\", a suggested answer.",
  },
  backstage: {
    reads: "one event.",
    opens: "on the fact, raw, with no link to the product (\"I have moved countries three times\"; \"I gave blood today\").",
    body: "short. What it changes, or does not change, for the work, in one sentence (\"the SaaS portfolio didn't notice\").",
    ends: "on the fact, or on a single sentence that opens toward the reader (\"go give blood\").",
    never: "a moral, a forced link to the product, self-pity, length.",
  },
  curation: {
    reads: "one event.",
    opens:
      "on the author's own sentence, their angle, not on a summary of the content (\"the customer is no longer the human but the agent, and I already see it in my business\").",
    body: "what it changes for them, with a fact of their own; the third-party content is named and credited, never summarised in full.",
    ends: "on the credit or the link.",
    never: "a summary of the article, a copy, \"a must-read\" without a personal sentence.",
  },
  demo: {
    reads: "one event: something the author built that already works.",
    opens:
      "on what you see when you use it, in the present tense, one concrete moment (\"I paste a repo link; 40 seconds later, the first post is on screen\").",
    body:
      "one use, walked through step by step, as the person using it would live it; then what it replaces, in one sentence. It is shown working, not announced: it can still be rough, and saying what is rough is allowed.",
    ends: "on what comes next for it, or on what is still missing. Never on access, a price or a link.",
    never: "\"now available\", a launch tone, a feature list, a superlative.",
  },
  beta_call: {
    reads: "one event: the author opening the product to a few testers.",
    opens:
      "on who the author is looking for and what for, in the first sentence (\"I'm looking for 10 devs who ship a tool and never post about it\").",
    body: "what the testers get, what it costs them (time, feedback), and what is still rough, said honestly. Numbers when the material has them.",
    ends: "on the precise action (reply, message, a link) and the number of places when the material gives one.",
    never: "manufactured scarcity, a superlative, a launch tone, several asks.",
  },
  origin: {
    reads:
      "the triggering event if there is one, and the problem the project solves; otherwise the material and the author's own words.",
    opens:
      "on a dated, numbered moment (\"I quit a $125k job, $10k in savings, a $150 apartment\") or on a line of identity in tension (\"public health student and full-stack dev, two identities that never spoke\").",
    body: "the problem seen up close, with what was heard or observed; the gap between two worlds; the first thing done.",
    ends: "on the first action, and the product is named only then, or not at all.",
    never: "a feature, a vision, today's number, a reason invented to fit the reader.",
  },
};

/**
 * Les modèles d'une forme : de vrais posts du relevé LinkedIn (postExamples.generated.ts), donnés
 * pour leur construction. Vide pour une forme sans modèle dans le relevé.
 */
export function formExamples(form: Form): string {
  const list = POST_EXAMPLES[form] ?? [];
  if (list.length === 0) return "";
  const items = list.map((e, i) => `<example n="${i + 1}" author="${e.author}" reactions="${e.reactions}" author_median="${e.median}">\n${e.text}\n</example>`);
  return `\n\nReal posts of this form, by other authors, in their own words and language. Read them for how they open, what the body carries and where they stop — never copy a line, a turn of phrase or a situation: your post is about your own material, in the language asked of you.\n${items.join("\n")}`;
}

/** Le texte que `read_form` rend : qui parle, la forme en cinq rubriques, puis ses modèles. */
export function formText(form: Form): string {
  const spec = FORM_SPECS[form];
  return `${WHO_SPEAKS}

Form: ${form}
Reads: ${spec.reads}
Opens: ${spec.opens}
Body: ${spec.body}
Ends: ${spec.ends}
Never: ${spec.never}${formExamples(form)}`;
}
