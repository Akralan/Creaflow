"use client";

import { Suspense } from "react";
import WeekScreen from "@/components/app/WeekScreen";

// « Your content week » (docs/SPEC_APP_DESIGN_TELLOVO.md E8). The former calendar of cards and the page of a
// post are replaced by this one screen: the posts on the left, the open post on the right.
export default function CalendarPage() {
  return (
    <Suspense>
      <WeekScreen />
    </Suspense>
  );
}
