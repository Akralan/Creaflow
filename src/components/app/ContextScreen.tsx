"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppIcon from "@/components/app/AppIcon";
import SourcePanel from "@/components/app/SourcePanel";
import { api, ApiClientError, type CreatorProfile, type MaterialSource, type Product } from "@/lib/apiClient";
import { syncBadge } from "@/lib/syncBadge";

/** « Business context » (docs/SPEC_APP_DESIGN_TELLOVO.md §2): what Tellovo knows about the project, and its sources. */

type SourceRow = { key: string; label: string; hint: string; icon: string; types: MaterialSource["type"][] };

/** Les fournisseurs qui se branchent par le panneau (docs/SPEC_RATTACHEMENT_SOURCES.md) : une source
 *  rejoint toujours le projet affiché, ou un autre projet existant — jamais un nouveau. */
const PANEL_PROVIDERS = new Set(["github", "notion", "linear"]);

// « Website » of the tellovo.ai design is left out (E6); « Your voice » too (E7).
const SOURCES: SourceRow[] = [
  { key: "github", label: "GitHub", hint: "Commits and pull requests", icon: "github", types: ["github_repo"] },
  { key: "notion", label: "Notion", hint: "Product docs, roadmap and specs", icon: "doc", types: ["notion_page"] },
  { key: "linear", label: "Linear", hint: "Issues, projects and cycles", icon: "list", types: ["linear_project"] },
  { key: "notes", label: "Markdown notes", hint: "Changelogs, decisions and ideas", icon: "doc", types: [] },
];

function initials(text: string): string {
  const letters = text.replace(/[^\p{L}\p{N} ]/gu, "").trim();
  return letters ? letters.slice(0, 2).replace(/^./, (c) => c.toUpperCase()) : "·";
}

export default function ContextScreen() {
  const params = useSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [sources, setSources] = useState<MaterialSource[]>([]);
  // Le panneau « brancher une source » : ouvert au clic sur un fournisseur déjà autorisé, ou au retour
  // de l'OAuth sur /context?connect=<fournisseur>.
  const [panel, setPanel] = useState<string | null>(() => {
    const p = params.get("connect");
    return p && PANEL_PROVIDERS.has(p) ? p : null;
  });
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ building: "", who: "", problem: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ products }, { profile, connectedProviders }] = await Promise.all([api.getProducts(), api.getProfile()]);
        const first = products[0] ?? null;
        setProduct(first);
        setProducts(products);
        setProfile(profile);
        setConnectedProviders(connectedProviders.map((p) => p.id));
        if (first) setSources((await api.getMaterialSources(first.id)).sources);
      } catch (e) {
        setError(e instanceof ApiClientError ? e.message : "The context could not be loaded.");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const connected = useMemo(() => SOURCES.filter((s) => sources.some((src) => s.types.includes(src.type))).map((s) => s.key), [sources]);

  const reloadSources = useCallback(async () => {
    if (!product) return;
    try {
      setSources((await api.getMaterialSources(product.id)).sources);
    } catch {
      // La carte garde ce qu'elle affichait ; le panneau a déjà dit ce qui s'est passé.
    }
  }, [product]);

  /** « Connect » sur un fournisseur : le panneau s'il est déjà autorisé, sinon l'OAuth, qui revient ici. */
  function connectProvider(key: string) {
    if (connectedProviders.includes(key)) {
      setPanel(key);
      return;
    }
    const returnTo = encodeURIComponent(`/context?connect=${key}`);
    window.location.assign(`/api/auth/oauth/${key}/start?returnTo=${returnTo}`);
  }
  const building = product?.description ?? profile?.activityType ?? "";
  const who = product?.targetAudience ?? profile?.targetAudience ?? "";
  const problem = product?.problem ?? "";
  const repo = sources.find((s) => s.type === "github_repo")?.label ?? "";
  // La fraîcheur de la matière, d'après les sources du projet (docs/SPEC_SYNCHRO_QUOTIDIENNE.md).
  const badge = useMemo(() => syncBadge(sources), [sources]);

  function startEdit() {
    setDraft({ building, who, problem });
    setSaved(false);
    setEditing(true);
  }

  async function save() {
    if (!product || !profile) return;
    setSaving(true);
    setError(null);
    try {
      const { product: updated } = await api.updateProduct(product.id, {
        description: draft.building.trim(),
        targetAudience: draft.who.trim() || null,
        problem: draft.problem.trim() || null,
      });
      // The brand keeps the same two fields: the posts read them as the type of work and the audience.
      await api.saveProfile({
        brandName: profile.brandName,
        activityType: draft.building.trim() || profile.activityType,
        targetAudience: draft.who.trim() || undefined,
        expectations: profile.expectations ?? undefined,
        language: profile.language,
        publishingDays: profile.publishingDays,
      });
      setProduct(updated);
      setProfile({ ...profile, activityType: draft.building.trim() || profile.activityType, targetAudience: draft.who.trim() || null });
      setEditing(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const name = product?.name ?? profile?.brandName ?? "your project";
  const total = SOURCES.length;
  const hint = connected.includes("notion") || connected.includes("linear") ? "Tellovo reads more than your commits now." : "Connect Notion or Linear so Tellovo understands the why behind your commits.";

  return (
    <>
      <header className="vh">
        <div>
          <p className="vk">Business context</p>
          <h1 className="vt">What Tellovo knows about {name}</h1>
          <p className="vs">The more Tellovo knows about your product and your voice, the more relevant your stories become.</p>
        </div>
      </header>
      {error && (
        <p className="err" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      {loaded && !product ? (
        <div className="card">
          <h2>No project yet</h2>
          <p className="sub">Your project appears here once its first source has been read.</p>
        </div>
      ) : (
        <>
        {panel && product && (
          <SourcePanel
            key={panel}
            provider={panel}
            products={products.map((p) => ({ id: p.id, name: p.name }))}
            defaultProductId={product.id}
            onClose={() => setPanel(null)}
            onChanged={reloadSources}
          />
        )}
        <div className="ctx-grid">
          <section className="card" aria-label="Your business">
            <div className="biz-id">
              <span className="logo" aria-hidden="true">
                {initials(name)}
              </span>
              <div>
                <h2 className="biz-name">
                  {name}
                  {badge && (
                    <span className={`sync-pill ${badge.tone}`} title="When Tellovo last read your sources. They are read again every night.">
                      {badge.label}
                    </span>
                  )}
                </h2>
                {repo && <p className="biz-tag">{repo}</p>}
              </div>
            </div>
            <dl className="biz-rows">
              {(
                [
                  ["What you're building", "building", building],
                  ["Who it's for", "who", who],
                  ["The problem you solve", "problem", problem],
                ] as const
              ).map(([label, key, value]) => (
                <div className="biz-row" key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {editing ? (
                      <textarea value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} aria-label={label} />
                    ) : (
                      value || <span style={{ color: "var(--mute)" }}>Not filled in yet.</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="biz-foot">
              {editing ? (
                <>
                  <div className="acts">
                    <button className="btn btn-ink btn-sm" type="button" onClick={save} disabled={saving || !draft.building.trim()}>
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button className="btn btn-quiet btn-sm" type="button" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button className="tbtn" type="button" onClick={startEdit}>
                    <AppIcon name="edit" />
                    Edit details
                  </button>
                  {saved && <span className="saved">Saved. Your next posts will use it.</span>}
                </>
              )}
            </div>
          </section>

          <div className="ctx-side">
            <section className="card engine" aria-label="Getting started">
              <p className="k">Tellovo Content Engine</p>
              <div className="eng-row">
                <b>Getting started</b>
                <span>
                  {connected.length} of {total} sources
                </span>
              </div>
              <div className="segbar" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }} aria-hidden="true">
                {SOURCES.map((s) => (
                  <i key={s.key} className={connected.includes(s.key) ? "on" : undefined} />
                ))}
              </div>
              <p className="hint" style={{ textAlign: "center", margin: 0 }}>
                {hint}
              </p>
            </section>

            <section className="card" aria-label="Sources">
              <h2>Sources</h2>
              <p className="sub">Give Tellovo more context about what you&apos;re building.</p>
              <div className="src-list">
                {SOURCES.map((s) => {
                  const on = connected.includes(s.key);
                  return (
                    <div className="src-row" key={s.key}>
                      <span className="src-ic">
                        <AppIcon name={s.icon} />
                      </span>
                      <span className="src-txt">
                        <b>{s.label}</b>
                        <span>{s.key === "github" && repo ? `${repo} · ${s.hint.toLowerCase()}` : s.hint}</span>
                      </span>
                      {PANEL_PROVIDERS.has(s.key) ? (
                        on ? (
                          <button className="conn on" type="button" onClick={() => connectProvider(s.key)} title="Add more from this source">
                            <AppIcon name="check" small />
                            Connected
                          </button>
                        ) : (
                          <button className="conn" type="button" onClick={() => connectProvider(s.key)}>
                            Connect
                          </button>
                        )
                      ) : on ? (
                        <span className="conn on">
                          <AppIcon name="check" small />
                          Connected
                        </span>
                      ) : (
                        // Coller des notes et déposer des fichiers reviendront ici (l'onglet Topics de Settings est parti le 2026-10-24).
                        <span className="conn on">Soon</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
        </>
      )}
    </>
  );
}
