"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type CreatorProfile, type User } from "@/lib/apiClient";
import { accent, accentAlpha, color, fontHeading } from "@/lib/design/tokens";
import { CategoryLabelsContext } from "@/contexts/CategoryLabelsContext";

const navItems = [
  { href: "/calendar", label: "Calendrier", icon: "▦", match: (p: string) => p.startsWith("/calendar") || p.startsWith("/scripts") },
  { href: "/generate", label: "Génération libre", icon: "✎", match: (p: string) => p.startsWith("/generate") },
  { href: "/settings", label: "Paramètres", icon: "⚙", match: (p: string) => p.startsWith("/settings") },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const { user } = await api.me();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUser(user);
      const { profile } = await api.getProfile();
      setProfile(profile);
      setChecked(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname === "/login"]);

  async function handleLogout() {
    await api.logout();
    router.replace("/login");
  }

  if (!checked) {
    return <div style={{ height: "100vh", width: "100%", background: color.pageBg }} />;
  }

  return (
    <CategoryLabelsContext.Provider value={profile?.categoryLabels ?? null}>
    <div style={{ height: "100vh", width: "100%", overflow: "hidden", display: "flex" }}>
      <div
        style={{
          width: 248,
          flexShrink: 0,
          background: color.cardBg,
          borderRight: `1px solid ${color.border}`,
          display: "flex",
          flexDirection: "column",
          padding: "22px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 24px" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: accent,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontFamily: fontHeading,
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            S
          </div>
          <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 19, letterSpacing: "-0.02em" }}>
            SocialSkill
          </span>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  fontFamily: "inherit",
                  fontSize: 15,
                  padding: "11px 14px",
                  borderRadius: 11,
                  cursor: "pointer",
                  background: active ? accentAlpha(0.11) : "transparent",
                  color: active ? "oklch(0.47 0.2 292)" : color.textSecondary,
                  fontWeight: active ? 600 : 500,
                }}
              >
                <span style={{ fontSize: 17, width: 22, textAlign: "center" }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div
          onClick={handleLogout}
          role="button"
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "12px 8px",
            borderTop: `1px solid ${color.dividerAlt}`,
            cursor: "pointer",
          }}
          title="Se déconnecter"
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "repeating-linear-gradient(45deg,#e6dfd3,#e6dfd3 5px,#ddd4c6 5px,#ddd4c6 10px)",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {profile?.brandName || "Mon espace"}
            </div>
            <div style={{ fontSize: 12, color: color.textFaint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.email}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </div>
    </CategoryLabelsContext.Provider>
  );
}
