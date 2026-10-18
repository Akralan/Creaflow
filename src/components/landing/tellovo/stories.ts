/**
 * The three "story" sub-pages of the landing (/stories/<slug>), copied from tellovo.ai: each
 * testimonial of the landing links to a page that says the story has not happened yet and
 * invites the first person to live it. Texts are verbatim, including the few spots where the
 * indie and open-source pages reuse the founder wording.
 */
export type Story = {
  slug: string;
  /** Page title, without the " · Tellovo" suffix added by the layout template. */
  title: string;
  description: string;
  /** "It's waiting for its …" */
  waitingFor: string;
  /** "the first … to live it" */
  firstOne: string;
  /** Label of the two call-to-action buttons. */
  cta: string;
  /** mailto subject, already URL-encoded. */
  subject: string;
  isYou: [string, string, string];
  reviewTitle: string;
  reviewBody: string;
  quote: string;
  who: string;
  headline: string;
};

export const STORIES: Story[] = [
  {
    slug: "founder",
    title: "Be the founder in this story",
    description:
      "We're looking for the first solo founder to turn their weekly shipping into paying customers with Tellovo.",
    waitingFor: "founder",
    firstOne: "founder",
    cta: "I'm this founder",
    subject: "I%27m%20the%20solo%20founder%20in%20your%20story",
    isYou: [
      "You're a solo founder building a B2B developer tool.",
      "You ship every week, but few people know your product exists.",
      "You want your first paying customers — not just likes.",
    ],
    reviewTitle: "Review your first weeks with you",
    reviewBody: "We go over your stories and refine them together.",
    quote:
      "I was shipping every week, but barely anyone knew my SaaS existed. Tellovo helped me turn my updates into posts that reached the right developers. Within two weeks, those conversations led to my first paying customer.",
    who: "Solo founder · B2B DevTool SaaS",
    headline: "Be the founder in this story.",
  },
  {
    slug: "indie",
    title: "Be the indie hacker in this story",
    description:
      "We're looking for the first indie hacker to turn their commits into a week of content that sounds like them, with Tellovo.",
    waitingFor: "founder",
    firstOne: "indie hacker",
    cta: "I'm this founder",
    subject: "I%27m%20the%20indie%20hacker%20in%20your%20story",
    isYou: [
      "You build and ship your SaaS on your own.",
      "Writing a post takes you longer than writing the code.",
      "You want content that sounds like you — not like AI.",
    ],
    reviewTitle: "Tune it to your voice",
    reviewBody:
      "We work on your first weeks together until the posts sound like you.",
    quote:
      "Writing one post used to take me longer than shipping the feature. Now Tellovo turns my commits into a week of content I can review in minutes. And it actually sounds like me.",
    who: "Indie hacker · SaaS founder",
    headline: "Be the founder in this story.",
  },
  {
    slug: "open-source",
    title: "Be the open-source creator in this story",
    description:
      "We're looking for the first open-source maintainer to turn their releases into feedback, discussions and contributors with Tellovo.",
    waitingFor: "maintainer",
    firstOne: "open-source creator",
    cta: "I'm this maintainer",
    subject: "I%27m%20the%20open-source%20creator%20in%20your%20story",
    isYou: [
      "You maintain an open-source developer tool.",
      "You get stars, but very few real conversations.",
      "You'd love more feedback, discussions and contributors.",
    ],
    reviewTitle: "Shape your release stories with you",
    reviewBody: "We go over your first weeks and refine them together.",
    quote:
      "I had people starring my repo, but almost no real conversations around it. Sharing the stories behind my releases started bringing in feedback, discussions, and developers who wanted to contribute.",
    who: "Open-source creator · Developer tools",
    headline: "Be the maintainer in this story.",
  },
];

export function getStory(slug: string): Story | undefined {
  return STORIES.find((s) => s.slug === slug);
}
