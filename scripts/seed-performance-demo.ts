/**
 * Demo numbers for the Performance screen (docs/SPEC_PERFORMANCE.md), on the MyKiné test account.
 *
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/seed-performance-demo.ts           # add
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/seed-performance-demo.ts --remove  # take it all back
 *
 * It gives the account's existing LinkedIn posts a publication date in the last four weeks and numbers that
 * grow, and writes an X version of each (a copy of the LinkedIn one, shortened) so both networks show. Every
 * row it adds is recognisable by a `platform_post_id` starting with « demo- »; `--remove` deletes the X copies,
 * the numbers and the snapshots, and puts the LinkedIn posts back to « draft ». Numbers are invented.
 */
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, postMetrics, postMetricsSnapshots, scripts, users } from "@/db/schema";

const EMAIL = process.env.DEMO_EMAIL || "mykine.test@example.com";
const DAY = 24 * 3600 * 1000;

// [days after the Monday three weeks before this week, hour] → publication moment, oldest first. Nine posts over the
// three weeks before this one, so every one is in the past whatever day the script runs.
const SLOTS: Array<[number, number]> = [
  [1, 8],
  [3, 8],
  [5, 8],
  [8, 8],
  [10, 8],
  [12, 8],
  [15, 8],
  [17, 8],
  [19, 8],
];

function threeMondaysAgo(now: Date): number {
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return monday - ((now.getUTCDay() + 6) % 7) * DAY - 21 * DAY;
}

// [impressions, likes, comments, shares]
const NUMBERS: Array<{ li: number[]; x: number[] }> = [
  { li: [1050, 26, 6, 2], x: [380, 8, 1, 1] },
  { li: [1320, 34, 9, 3], x: [470, 10, 2, 2] },
  { li: [2480, 96, 21, 10], x: [910, 28, 5, 6] },
  { li: [1710, 41, 8, 3], x: [590, 13, 2, 2] },
  { li: [2960, 98, 24, 13], x: [1060, 29, 6, 8] },
  { li: [2310, 61, 12, 5], x: [850, 20, 3, 3] },
  { li: [2650, 98, 25, 13], x: [980, 29, 6, 8] },
  { li: [2400, 66, 14, 6], x: [880, 21, 4, 4] },
  { li: [3500, 131, 35, 18], x: [1300, 39, 8, 10] },
];

/** A post a day or three after it went out, a week after: the shape real numbers take. */
const GROWTH = [0.28, 0.7, 1];

function shorten(text: string | null, max: number): string | null {
  if (!text) return text;
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

async function remove(userId: string) {
  const demo = await db.query.postMetrics.findMany({
    where: like(postMetrics.platformPostId, "demo-%"),
    with: { script: { columns: { id: true, userId: true, platform: true } } },
  });
  const mine = demo.filter((m) => m.script.userId === userId);
  const xIds = mine.filter((m) => m.script.platform === "x").map((m) => m.script.id);
  const liIds = mine.filter((m) => m.script.platform === "linkedin").map((m) => m.script.id);
  if (xIds.length) {
    await db.delete(calendarEntries).where(and(eq(calendarEntries.userId, userId), inArray(calendarEntries.scriptId, xIds)));
    await db.delete(scripts).where(and(eq(scripts.userId, userId), inArray(scripts.id, xIds)));
  }
  if (liIds.length) {
    await db.delete(postMetrics).where(inArray(postMetrics.scriptId, liIds));
    await db.delete(postMetricsSnapshots).where(inArray(postMetricsSnapshots.scriptId, liIds));
    await db
      .update(scripts)
      .set({ status: "draft" })
      .where(and(eq(scripts.userId, userId), inArray(scripts.id, liIds)));
    await db
      .update(calendarEntries)
      .set({ status: "planned" })
      .where(and(eq(calendarEntries.userId, userId), inArray(calendarEntries.scriptId, liIds)));
  }
  console.log(`removed: ${xIds.length} X copies, ${liIds.length} LinkedIn posts back to draft`);
}

async function main() {
  const user = await db.query.users.findFirst({
    where: eq(users.email, EMAIL),
    columns: { id: true },
  });
  if (!user) throw new Error(`No account ${EMAIL}.`);
  // Fake numbers and « published » statuses must never land on a real person's account.
  if (!EMAIL.endsWith("@example.com") && !process.argv.includes("--force")) {
    throw new Error(`${EMAIL} does not look like a test account (not @example.com). Pass --force if it is.`);
  }
  if (process.argv.includes("--remove")) return remove(user.id);

  // Running it again replaces the previous demo instead of stacking a second one.
  await remove(user.id);

  const liScripts = await db.query.scripts.findMany({
    where: and(eq(scripts.userId, user.id), eq(scripts.platform, "linkedin")),
    with: { calendarEntries: true, metrics: { columns: { id: true } } },
  });
  const posts = liScripts
    .filter((s) => s.calendarEntries.length > 0 && !s.metrics)
    .sort((a, b) => +a.calendarEntries[0].scheduledDate - +b.calendarEntries[0].scheduledDate)
    .slice(0, SLOTS.length);
  if (posts.length === 0) throw new Error("Nothing to seed: no LinkedIn post without numbers yet.");

  for (const [i, li] of posts.entries()) {
    await db.transaction(async (tx) => {
      const [dayOffset, hour] = SLOTS[i];
      const publishedAt = new Date(threeMondaysAgo(new Date()) + dayOffset * DAY + hour * 3600 * 1000);
      const slot = li.calendarEntries[0];
      const numbers = NUMBERS[i];

      // The X version: a copy of the LinkedIn post on the same slot, shortened to fit.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, createdAt: _c, updatedAt: _u, calendarEntries: _ce, metrics: _m, ...liFields } = li;
      const [xScript] = await tx
        .insert(scripts)
        .values({
          ...liFields,
          platform: "x",
          caption: shorten(li.caption, 270),
          status: "published",
        })
        .returning();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _sid, ...slotFields } = slot;
      await tx.insert(calendarEntries).values({
        ...slotFields,
        scriptId: xScript.id,
        platform: "x",
        status: "published",
      });

      for (const [script, network, key] of [
        [li, "li", "li"],
        [xScript, "x", "x"],
      ] as const) {
        const [views, likes, comments, shares] = numbers[key];
        await tx.insert(postMetrics).values({
          scriptId: script.id,
          views,
          likes,
          comments,
          shares,
          source: "api",
          platformPostId: `demo-${network}-${i + 1}`,
          publishedAt,
          fetchedAt: new Date(),
        });
        await tx.insert(postMetricsSnapshots).values(
          GROWTH.map((part, step) => ({
            scriptId: script.id,
            views: Math.round(views * part),
            likes: Math.round(likes * part),
            comments: Math.round(comments * part),
            shares: Math.round(shares * part),
            source: "api" as const,
            capturedAt: new Date(Math.min(Date.now(), +publishedAt + [1, 3, 7][step] * DAY)),
          }))
        );
      }
      await tx.update(scripts).set({ status: "published" }).where(eq(scripts.id, li.id));
      await tx.update(calendarEntries).set({ status: "published" }).where(eq(calendarEntries.id, slot.id));
    });
    console.log(`${i + 1}. ${new Date(threeMondaysAgo(new Date()) + SLOTS[i][0] * DAY).toISOString().slice(0, 10)}  ${li.title}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
