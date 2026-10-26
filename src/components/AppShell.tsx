"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { clearNavHighlight, NAV_HIGHLIGHT_EVENT, readNavHighlight } from "@/lib/navHighlight";
import { api, type ContentCategory, type CreatorProfile, type QuotaStatus, type User } from "@/lib/apiClient";
import AppIcon from "@/components/app/AppIcon";
import { AppChromeContext, PaywallModal, type AppChrome } from "@/components/app/AppChrome";
import { CategoryLabelsContext } from "@/contexts/CategoryLabelsContext";
import "@/components/app/tellovo-app.css";
import "@/components/app/app-extra.css";

/**
 * The signed-in frame, in the design of the tellovo.ai app (docs/SPEC_APP_DESIGN_TELLOVO.md E4): three entries
 * plus Performance, the plan card, and an account menu that holds Settings and sign-out (Direction removed
 * on 2026-10-26: one series per project, nothing left to direct). The
 * assistant, hidden since E5, was removed on 2026-10-26.
 */

const navItems = [
  { href: "/calendar", label: "This week", icon: "edit", match: (p: string) => p.startsWith("/calendar") || p.startsWith("/scripts") },
  { href: "/plan", label: "Content plan", icon: "calendar", match: (p: string) => p.startsWith("/plan") },
  { href: "/context", label: "Business context", icon: "layers", match: (p: string) => p.startsWith("/context") },
  { href: "/performance", label: "Performance", icon: "chart", match: (p: string) => p.startsWith("/performance") },
];

/** Entries of the account menu that can carry the « new » dot (src/lib/navHighlight.ts). */
const MENU_HREFS = ["/settings"];

function initials(text: string): string {
  const letters = text.replace(/[^\p{L}\p{N} ]/gu, "").trim();
  if (!letters) return "·";
  const words = letters.split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : letters.slice(0, 2)).replace(/^./, (c) => c.toUpperCase());
}

function AccountMenu({ onLogout, dot, placement }: { onLogout: () => void; dot: boolean; placement: "bottom" | "top" }) {
  return (
    <div className={placement === "top" ? "menu menu-top" : "menu"} role="menu">
      <Link href="/settings" role="menuitem">
        <AppIcon name="settings" />
        Settings
        {dot && <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />}
      </Link>
      <hr />
      <button type="button" role="menuitem" onClick={onLogout}>
        <AppIcon name="logout" />
        Sign out
      </button>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [productName, setProductName] = useState("");
  const [repoLabel, setRepoLabel] = useState("");
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const [paywall, setPaywall] = useState(false);
  // The open account menu remembers the page it was opened on: leaving the page closes it.
  const [menuState, setMenuState] = useState<{ which: "side" | "top"; at: string } | null>(null);
  const menu = menuState && menuState.at === pathname ? menuState.which : null;
  const setMenu = (which: "side" | "top" | null) => setMenuState(which ? { which, at: pathname } : null);
  const [badge, setBadge] = useState<{ ready: number; total: number } | null>(null);
  // Menu entry highlighted (src/lib/navHighlight.ts). The shell renders nothing before
  // `checked`, so reading storage at initialisation does not create a hydration mismatch.
  const [highlighted, setHighlighted] = useState<string | null>(readNavHighlight);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onHighlight = (e: Event) => setHighlighted((e as CustomEvent<string | null>).detail);
    window.addEventListener(NAV_HIGHLIGHT_EVENT, onHighlight);
    return () => window.removeEventListener(NAV_HIGHLIGHT_EVENT, onHighlight);
  }, []);

  // It turns off as soon as its page is opened.
  useEffect(() => {
    const current = readNavHighlight();
    if (current && [...navItems.filter((item) => item.match(pathname)).map((i) => i.href), ...(MENU_HREFS.includes(current) && pathname.startsWith(current) ? [current] : [])].includes(current)) clearNavHighlight();
  }, [pathname]);

  // A click anywhere else closes the account menu.
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuState(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const refreshQuota = useCallback(() => {
    api
      .getBillingInfo()
      .then((info) => setQuota(info.quota))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    (async () => {
      const { user } = await api.me();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUser(user);
      const [{ profile }, { categories }, { products }] = await Promise.all([
        api.getProfile(),
        api.getContentCategories(),
        api.getProducts(),
      ]);
      setProfile(profile);
      setCategories(categories);
      setProductName(products[0]?.name ?? "");
      setChecked(true);
      refreshQuota();
      if (products[0]) {
        api
          .getMaterialSources(products[0].id)
          .then(({ sources }) => setRepoLabel(sources[0]?.label ?? ""))
          .catch(() => undefined);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname === "/login"]);

  async function handleLogout() {
    await api.logout();
    router.replace("/login");
  }

  const chrome = useMemo<AppChrome>(
    () => ({
      openPaywall: () => setPaywall(true),
      refreshQuota,
      setWeekBadge: setBadge,
      productName,
      authorName: profile?.brandName || "You",
      audience: profile?.targetAudience ?? "",
    }),
    [refreshQuota, productName, profile?.brandName, profile?.targetAudience]
  );

  if (!checked) {
    return <div style={{ height: "100vh", width: "100%", background: "#faf9f6" }} />;
  }

  const trial = quota?.unit === "weeks";
  const accountDot = highlighted !== null && MENU_HREFS.includes(highlighted);
  const nameForAvatar = profile?.brandName || user?.email || "You";

  return (
    <CategoryLabelsContext.Provider value={categories}>
        <AppChromeContext.Provider value={chrome}>
          <div className="ap">
            <div className="shell">
              <aside className="side" aria-label="Workspace">
                <div className="side-top">
                  <span className="wm">
                    tellovo<i aria-hidden="true" />
                  </span>
                </div>
                <div className="ws">
                  <span className="logo" aria-hidden="true">
                    {initials(productName || nameForAvatar)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <b>{productName || "My project"}</b>
                    <span>{repoLabel || "no source yet"}</span>
                  </span>
                </div>
                <nav className="side-nav" aria-label="Main">
                  {navItems.map((item) => {
                    const active = item.match(pathname);
                    return (
                      <Link key={item.href} href={item.href} className={active ? "nv on" : "nv"} aria-current={active ? "page" : undefined}>
                        <AppIcon name={item.icon} />
                        {item.label}
                        {item.href === "/calendar" && badge && (
                          <span className="badge">
                            {badge.ready}/{badge.total}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>

                {/* Phone: the account menu moves to the top bar, the workspace card and plan card are hidden. */}
                <div className="me-wrap-m side-mobile-me" ref={menu === "top" ? menuRef : undefined}>
                  <button className="av" type="button" aria-label="Account" aria-expanded={menu === "top"} onClick={() => setMenu(menu === "top" ? null : "top")} style={{ border: 0, cursor: "pointer" }}>
                    {initials(nameForAvatar)}
                  </button>
                  {menu === "top" && <AccountMenu onLogout={handleLogout} dot={accountDot} placement="top" />}
                </div>

                <div className="side-bottom">
                  {quota && (
                    <div className="plan-card">
                      <b>{trial ? "Free plan" : quota.planName}</b>
                      <div className="meter" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, quota.limit > 0 ? (quota.used / quota.limit) * 100 : 100)}%` }} />
                      </div>
                      <p>
                        {trial
                          ? `Your first week is on us. ${quota.used} of ${quota.limit} free ${quota.limit === 1 ? "week" : "weeks"} used.`
                          : `${quota.used} of ${quota.limit} scripts this month.`}
                      </p>
                      {trial ? (
                        <button className="btn btn-ink btn-sm btn-block" type="button" onClick={() => setPaywall(true)}>
                          Upgrade
                        </button>
                      ) : (
                        <Link className="btn btn-quiet btn-sm btn-block" href="/settings?tab=billing">
                          Manage
                        </Link>
                      )}
                    </div>
                  )}
                  <div className="me-wrap" ref={menu === "side" ? menuRef : undefined}>
                    {menu === "side" && <AccountMenu onLogout={handleLogout} dot={accountDot} placement="bottom" />}
                    <button className="me me-btn" type="button" aria-haspopup="menu" aria-expanded={menu === "side"} onClick={() => setMenu(menu === "side" ? null : "side")}>
                      <span className="av" aria-hidden="true">
                        {initials(nameForAvatar)}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <b>{profile?.brandName || "You"}</b>
                        <span>{user?.email}</span>
                      </span>
                      {accountDot && <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />}
                    </button>
                  </div>
                </div>
              </aside>
              <main className="main">
                <div className="main-in">{children}</div>
              </main>
            </div>
            {paywall && <PaywallModal onClose={() => setPaywall(false)} />}
          </div>
        </AppChromeContext.Provider>
    </CategoryLabelsContext.Provider>
  );
}
