import { z } from "zod";
import { buildLanguageBlock, type PostLanguage } from "@/lib/language";
import { fitTweets, TWEET_MAX } from "@/lib/xThreadFormat";
import { callStructured } from "./provider";
import type { LlmToolDefinition } from "./types";

/**
 * La version X d'un post (docs/TODO.md, décidé le 2026-10-26) : le post LinkedIn fini, adapté en
 * thread. Avant, X était une seconde écriture complète qui relisait le document du pointeur et y
 * prenait un autre passage — le test « Tellovo sur Tellovo » a donné un LinkedIn sur l'origine du
 * projet et un X sur un exemple de kiné. Un seul appel, sans outil ni matière : rien d'autre que le
 * texte LinkedIn n'entre, donc rien d'autre ne peut sortir.
 */

const TOOL: LlmToolDefinition = {
  name: "publish_thread",
  description: "Hands in the X thread, one tweet per item, in order.",
  input_schema: {
    type: "object",
    properties: {
      tweets: {
        type: "array",
        description: `The tweets of the thread, in order. Each at most ${TWEET_MAX} characters.`,
        items: { type: "string" },
      },
    },
    required: ["tweets"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You turn a LinkedIn post into an X thread, for its author.

It is the same post: the same story, the same facts, the same numbers, the same voice, the same person speaking. You add nothing that is not in the LinkedIn post, and you drop nothing that carries the story.

The thread is as long as the post needs: one tweet when the post says one thing, more when it walks through several steps. Never pad to make it longer, never cram to make it shorter.

The first tweet is the hook and must stand alone: someone who reads only it must want the rest. Every tweet is at most ${TWEET_MAX} characters and reads on its own, without "1/" numbering and without "a thread" or 🧵. Plain sentences, direct, no LinkedIn register ("I'm thrilled", "here's what I learned"). No hashtags, except at most one at the very end if the LinkedIn post had some.`;

const resultSchema = z.object({ tweets: z.array(z.string()) });

export async function adaptToXThread(input: { linkedinText: string; language: PostLanguage }): Promise<string[]> {
  const userMessage = `${buildLanguageBlock(input.language)}

<linkedin_post>
${input.linkedinText.trim()}
</linkedin_post>`;
  const call = async (message: string) => {
    const args = await callStructured({ system: SYSTEM_PROMPT, userMessage: message, tool: TOOL, maxTokens: 2000 });
    return resultSchema.parse(args).tweets.map((t) => t.trim()).filter(Boolean);
  };

  let tweets = await call(userMessage);
  const tooLong = tweets.filter((t) => t.length > TWEET_MAX);
  if (tweets.length === 0 || tooLong.length > 0) {
    // Un essai de plus avec le compte rendu, puis le code coupe aux fins de phrase ce qui dépasse encore.
    const report =
      tweets.length === 0
        ? "You handed in no tweet."
        : `${tooLong.length} tweet(s) are over ${TWEET_MAX} characters (${tooLong.map((t) => t.length).join(", ")}). Split them or tighten them.`;
    const second = await call(`${userMessage}\n\n<refused>\n${report}\n</refused>`).catch(() => [] as string[]);
    if (second.length > 0) tweets = second;
  }
  if (tweets.length === 0) throw new Error("The X adaptation returned no tweet.");
  return fitTweets(tweets);
}
