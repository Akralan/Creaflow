import type { CSSProperties } from "react";
import { PROVIDER_ICONS } from "@/components/OAuthProviderButtons";
import type { SourceKind } from "@/components/landing/personas";

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

/** Logo d'une source de matière : les marques dessinées pour /login, plus un fichier générique. */
export default function SourceIcon({ kind, scale = 1, style }: { kind: SourceKind; scale?: number; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex",
        flexShrink: 0,
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: "center",
        ...style,
      }}
    >
      {kind === "file" ? <FileIcon /> : PROVIDER_ICONS[kind]}
    </span>
  );
}
