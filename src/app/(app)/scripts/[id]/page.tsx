import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { calendarEntries } from "@/db/schema";
import ScriptPageClient from "@/components/ScriptPageClient";
import { getCurrentUserId } from "@/lib/auth/session";
import { mondayOf } from "@/lib/weekPosts";

// A script that sits in a slot is read and edited on « Your content week » (docs/SPEC_APP_DESIGN_TELLOVO.md E8):
// the old links (mail, bookmarks, the series page) land on the right week with the post open. Only a script
// without a slot — imported or free — keeps this page.
export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId().catch(() => null);
  if (userId && /^[0-9a-f-]{36}$/i.test(id)) {
    const entry = await db.query.calendarEntries.findFirst({
      where: and(eq(calendarEntries.scriptId, id), eq(calendarEntries.userId, userId)),
      columns: { id: true, scheduledDate: true },
    });
    if (entry) redirect(`/calendar?week=${mondayOf(entry.scheduledDate).toISOString().slice(0, 10)}&post=${id}`);
  }
  return <ScriptPageClient />;
}
