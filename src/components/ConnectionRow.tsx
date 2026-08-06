import type { Connection } from "@/lib/apiClient";
import { color, fontHeading, platformMeta } from "@/lib/design/tokens";
import { hasOAuthProvider } from "@/lib/social/types";

export default function ConnectionRow({ connection, returnTo }: { connection: Connection; returnTo: string }) {
  const meta = platformMeta[connection.platform];
  const oauth = hasOAuthProvider(connection.platform);
  // Friction assumée (docs/SPEC_METRIQUES_AUTO.md §2.3) : un compte Instagram personnel n'a
  // aucun accès API, quel que soit le chemin — seul un compte Creator (gratuit, réversible,
  // ~3 taps dans les réglages du téléphone) fonctionne. Aucun contournement côté code, donc
  // message explicite avant même la tentative de connexion plutôt qu'un échec silencieux.
  const needsCreatorAccount = connection.platform === "instagram" && !connection.connected;
  const statusLabel =
    connection.status === "needs_reconnect"
      ? "Connexion expirée"
      : connection.connected
        ? "Connecté"
        : "Non connecté";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        border: `1px solid ${color.border}`,
        borderRadius: 14,
        padding: 16,
        background: color.listItemBg,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: meta.badgeBg,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 15,
            fontFamily: fontHeading,
          }}
        >
          {meta.badge}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{meta.label}</div>
          <div
            style={{
              fontSize: 13,
              color:
                connection.status === "needs_reconnect"
                  ? color.danger
                  : connection.connected
                    ? "oklch(0.5 0.14 150)"
                    : color.textFaint,
            }}
          >
            {oauth ? statusLabel : "Suivi manuel"}
          </div>
        </div>
        {oauth ? (
          <a
            href={`/api/auth/${connection.platform}/connect?returnTo=${encodeURIComponent(returnTo)}`}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: color.textMuted,
              border: `1px solid ${color.inputBorder}`,
              borderRadius: 10,
              padding: "9px 16px",
              background: color.cardBg,
            }}
          >
            {connection.connected ? "Reconnecter" : "Connecter"}
          </a>
        ) : (
          <span style={{ fontSize: 13, color: color.textFainter, padding: "9px 4px" }}>
            Pas de connexion nécessaire
          </span>
        )}
      </div>
      {needsCreatorAccount && (
        <p style={{ margin: 0, fontSize: 12, color: color.textFaint, lineHeight: 1.5 }}>
          Nécessite un compte Instagram <strong>Creator</strong> (gratuit, réversible, ~3 taps dans les réglages du
          téléphone) — un compte personnel ne pourra pas se connecter.
        </p>
      )}
    </div>
  );
}
