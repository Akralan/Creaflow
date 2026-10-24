"use client";

import { Suspense } from "react";
import ContextScreen from "@/components/app/ContextScreen";

// « Business context » (docs/SPEC_APP_DESIGN_TELLOVO.md §2): what Tellovo knows about the project.
// Suspense : l'écran lit ?connect= au retour de l'OAuth (docs/SPEC_RATTACHEMENT_SOURCES.md).
export default function ContextPage() {
  return (
    <Suspense>
      <ContextScreen />
    </Suspense>
  );
}
