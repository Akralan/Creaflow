"use client";

import type { ReactNode } from "react";
import { heading2Style } from "@/components/ui/TextField";
import { color } from "@/lib/design/tokens";

/** En-tête d'une étape d'onboarding. Chaque étape rend le sien : le titre peut changer selon une
 *  variante interne (le formulaire de repli créateur n'a pas le même titre que la discussion). */
export default function StepHeading({
  title,
  marginBottom = 24,
  children,
}: {
  title: string;
  marginBottom?: number;
  children: ReactNode;
}) {
  return (
    <>
      <h2 style={heading2Style}>{title}</h2>
      <p style={{ margin: `0 0 ${marginBottom}px`, color: color.textMuted, fontSize: 15 }}>{children}</p>
    </>
  );
}
