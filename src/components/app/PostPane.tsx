"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppIcon from "@/components/app/AppIcon";
import AnimationPlayer, { type AnimationPlayerHandle } from "@/components/app/AnimationPlayer";
import DesignPreview from "@/components/app/DesignPreview";
import { foreignNumbers } from "@/lib/animationHtml/numbers";
import DesignEditor from "@/components/DesignEditor/DesignEditor";
import { api, ApiClientError, type PostAnimation, type Script, type WeekEntry } from "@/lib/apiClient";
import { FORM_LABELS } from "@/lib/llm/postForms";
import { THREAD_SEPARATOR, threadTweets } from "@/lib/xThreadFormat";
import { DEFAULT_DURATION_MS, DEFAULT_SLIDES, MAX_DURATION_MS, MAX_SLIDES, MIN_DURATION_MS, MIN_SLIDES } from "@/lib/visualDesign/visualFormat";
import { longDay, NETWORKS, postState, scriptReadiness, type Network, type PostGroup } from "@/lib/weekPosts";

/**
 * The post, opened (docs/SPEC_APP_DESIGN_TELLOVO.md E8, E9, E13): the network tabs, the text — with the image of
 * a visual post between the author and the text — the AI edit block, and the actions. One pane per post; the
 * tab picks the LinkedIn or the X version (two scripts of the same slot).
 */

const NETWORK_LABEL: Record<Network, string> = { linkedin: "LinkedIn", x: "X" };
const X_LIMIT = 280;

const SUGGESTIONS = [
  { label: "Make it shorter", instruction: "Make it shorter. Keep the idea and the most concrete detail." },
  { label: "Stronger hook", instruction: "Write a stronger first line, one that makes people want to read on. Keep the rest." },
  { label: "More technical", instruction: "Make it more technical: name the real thing (the function, the number, the choice) instead of describing it." },
];

type Confirm = "idea" | "delete" | "visual" | null;

interface Props {
  group: PostGroup<WeekEntry>;
  network: Network;
  onNetwork: (n: Network) => void;
  seriesLabel: string | null;
  authorName: string;
  productName: string;
  hasLogo: boolean;
  /** Reloads the week after something changed (status, text, a post written or deleted). */
  onChanged: () => void;
  onQuota: () => void;
  onWrite: (entryId: string) => Promise<void>;
}

function errorText(error: unknown): string {
  return error instanceof ApiClientError ? error.message : "Something went wrong. Try again.";
}

/** Ce que « copier » met dans le presse-papiers : l'accroche (le titre) puis le corps — l'accroche était
 *  oubliée jusqu'au 2026-10-26. Un thread X se copie tweet par tweet, séparés par `---`. */
function fullText(script: Script): string {
  const tags = script.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  const title = script.title?.trim() ?? "";
  const caption = script.caption.trim();
  const body =
    script.platform === "x"
      ? threadTweets(script.title, script.caption).join(THREAD_SEPARATOR)
      : title && title !== caption
        ? `${title}\n\n${caption}`
        : caption;
  return tags ? `${body}\n\n${tags}` : body;
}

export default function PostPane({ group, network, onNetwork, seriesLabel, authorName, productName, hasLogo, onChanged, onQuota, onWrite }: Props) {
  const entry = group.versions[network] ?? null;
  const scriptId = entry?.script?.id ?? null;
  const [script, setScript] = useState<Script | null>(null);
  const [loadingScript, setLoadingScript] = useState(Boolean(scriptId));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<null | "save" | "ai" | "status" | "tool" | "write">(null);
  const [note, setNote] = useState<{ text: string; undo?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [tools, setTools] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [mockup, setMockup] = useState(false);
  // The animation of the post (docs/SPEC_ANIMATION_HTML_LIBRE.md): a free HTML page played in a sealed iframe.
  const [animation, setAnimation] = useState<PostAnimation | null>(null);
  const [animationNote, setAnimationNote] = useState<string | null>(null);
  const playerRef = useRef<AnimationPlayerHandle>(null);
  // What a long action is doing right now, told on the pane itself (the tools bubble closes when you click away).
  const [working, setWorking] = useState<null | { text: string; media?: boolean }>(null);
  const [ownerScript, setOwnerScript] = useState<Script | null>(null);
  const [visualDraft, setVisualDraft] = useState<{ format: "single" | "carousel" | "animation"; slides: number; seconds: number }>({
    format: "single",
    slides: DEFAULT_SLIDES,
    seconds: Math.round(DEFAULT_DURATION_MS / 1000),
  });
  const [copied, setCopied] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (id: string) => {
    setLoadingScript(true);
    try {
      const { script } = await api.getScript(id);
      setScript(script);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoadingScript(false);
    }
  }, []);

  // The pane is keyed by post, network and script (see WeekScreen): a new one starts clean and reads its script.
  useEffect(() => {
    if (!scriptId) return;
    let alive = true;
    api
      .getScript(scriptId)
      .then(({ script }) => alive && setScript(script))
      .catch((e) => alive && setError(errorText(e)))
      .finally(() => alive && setLoadingScript(false));
    api
      .getPostAnimation(scriptId)
      .then(({ animation }) => alive && setAnimation(animation))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [scriptId]);

  useEffect(() => {
    if (!tools) return;
    const close = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setTools(false);
        setConfirm(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [tools]);

  const state = postState(group);
  const versionLabel = NETWORK_LABEL[network];
  const upcoming = entry?.upcoming ?? Object.values(group.versions).find((v) => v?.upcoming)?.upcoming ?? null;
  const ready = script ? scriptReadiness(script.status) : null;
  // The visual of the post hangs on one of its versions (the first, LinkedIn) and shows on both (E16).
  const ownerVersion = Object.values(group.versions).find((v) => v?.script?.contentType === "visual") ?? null;
  const ownerId = ownerVersion?.script?.id ?? null;
  const preview = ownerVersion?.script?.preview ?? null;
  // The form of the post (docs/FORMES_ET_GENRES.md): the same on both networks, not editable.
  const form = script?.form ?? entry?.script?.form ?? null;
  const formLabel = form ? FORM_LABELS[form] : null;

  const head = (
    <div className="pane-head">
      <p className="when">
        <b>{longDay(group.date)}</b>
        {seriesLabel ? <> · {seriesLabel}</> : null}
      </p>
      <div className="seg" role="group" aria-label="Network">
        {NETWORKS.map((n) => (
          <button key={n} type="button" className={n === network ? "on" : undefined} aria-pressed={n === network} onClick={() => onNetwork(n)}>
            {NETWORK_LABEL[n]}
          </button>
        ))}
      </div>
    </div>
  );

  async function write() {
    const target = entry ?? Object.values(group.versions).find(Boolean);
    if (!target) return;
    setBusy("write");
    setError(null);
    try {
      await onWrite(target.id);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 402) onQuota();
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  // Nothing written for this post yet, or being written.
  if (state === "writing" && !scriptId) {
    return (
      <article className="pane in-b" aria-live="polite">
        {head}
        <div className="empty-pane">
          <h2>Writing this post…</h2>
          <p>Tellovo is writing the LinkedIn and the X versions from what you shipped. It will appear here in a moment.</p>
        </div>
      </article>
    );
  }

  if (!scriptId) {
    const missingOneVersion = state !== "empty";
    return (
      <article className="pane in-b">
        {head}
        <div className="empty-pane">
          <h2>{missingOneVersion ? `The ${versionLabel} version isn't written yet` : (upcoming?.title ?? "A post is planned for this day")}</h2>
          <p>
            {missingOneVersion
              ? "Tellovo will write it from the same story as the other version."
              : `Tellovo will write it for LinkedIn and X, from ${upcoming?.project ? upcoming.project : "what you shipped"}.`}
          </p>
          {error && <p className="err">{error}</p>}
          <button className="btn btn-ink" type="button" onClick={write} disabled={busy === "write"}>
            {busy === "write" ? "Starting…" : missingOneVersion ? `Write the ${versionLabel} version` : "Write this post"} <span className="arr">→</span>
          </button>
        </div>
      </article>
    );
  }

  const siblingScripts = NETWORKS.map((n) => group.versions[n]?.script?.id).filter((id): id is string => Boolean(id));

  async function copy() {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(fullText(script));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy is not available in this browser.");
    }
  }

  async function toggleReady() {
    if (!script) return;
    setBusy("status");
    setError(null);
    try {
      const next = ready === "ready" ? "draft" : "planned";
      // The post is Ready when both of its texts are.
      await Promise.all(siblingScripts.map((id) => api.updateScriptStatus(id, next)));
      await load(script.id);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit() {
    if (!script) return;
    setBusy("save");
    setError(null);
    try {
      const hashtags = draftTags.split(/\s+/).map((h) => h.trim()).filter(Boolean);
      const { script: updated } = await api.patchScriptContent(script.id, { caption: draft, hashtags });
      setScript(updated);
      setEditing(false);
      setNote(null);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function applyInstruction(text: string, label: string) {
    if (!script || !text.trim()) return;
    setBusy("ai");
    setError(null);
    const before = script.caption;
    try {
      const { script: updated } = await api.applySelectionInstruction(script.id, { blockField: "caption", selectedText: before, instruction: text.trim() });
      setScript(updated);
      setNote({ text: `Applied: ${label}`, undo: before });
      setInstruction("");
      onChanged();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 402) onQuota();
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    if (!script || note?.undo === undefined) return;
    setBusy("ai");
    try {
      const { script: reverted } = await api.patchScriptContent(script.id, { caption: note.undo });
      setScript(reverted);
      setNote(null);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function anotherIdea() {
    if (!script) return;
    setBusy("tool");
    setError(null);
    setConfirm(null);
    setTools(false);
    setWorking({ text: "Writing another idea from the same story… about 20 seconds." });
    try {
      const { script: updated } = await api.newIdea(script.id);
      setScript(updated);
      setNote(null);
      onChanged();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 402) onQuota();
      setError(errorText(e));
    } finally {
      setBusy(null);
      setWorking(null);
    }
  }

  async function regenerateTags() {
    if (!script) return;
    setBusy("tool");
    setTools(false);
    try {
      const { script: updated } = await api.regenerateScriptBlock(script.id, "hashtags");
      setScript(updated);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function deletePost() {
    setBusy("tool");
    setConfirm(null);
    setTools(false);
    try {
      await Promise.all(siblingScripts.map((id) => api.deleteScript(id)));
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function openMockup() {
    if (!ownerId) return;
    setTools(false);
    try {
      setOwnerScript(script?.id === ownerId ? script : (await api.getScript(ownerId)).script);
      setMockup(true);
    } catch (e) {
      setError(errorText(e));
    }
  }

  /**
   * The animation: the model writes a page, the page is played in the sealed iframe and looks at itself (overlaps,
   * cut-off or tiny text, figures the post does not state); what is wrong goes back to the model, twice at most.
   */
  async function makeAnimation() {
    if (!script) return;
    setBusy("tool");
    setError(null);
    setAnimationNote(null);
    setTools(false);
    setWorking({ text: "Writing your animation from the post… about 30 seconds.", media: true });
    try {
      let made = (await api.createPostAnimation(script.id, visualDraft.seconds * 1000)).animation;
      setAnimation(made);
      setConfirm(null);
      const owner = (await api.getScript(made.scriptId)).script;
      const postText = `${owner.title ?? ""}\n${owner.caption}`;
      for (let round = 0; round <= 2; round++) {
        setWorking({ text: round === 0 ? "Checking the layout…" : `Checking the layout again (${round}/2)…` });
        await new Promise((resolve) => setTimeout(resolve, 400));
        const probe = await playerRef.current?.probe().catch(() => null);
        if (!probe) break;
        const invented = foreignNumbers(probe.text, postText);
        const issues = [
          ...probe.errors.map((e) => `script error: ${e}`),
          ...probe.issues,
          ...(invented.length > 0 ? [`the screen shows the number ${invented.join(", ")}, which the post does not state: show only figures copied from the post`] : []),
        ];
        if (issues.length === 0) break;
        if (round === 2) {
          setAnimationNote(`The layout check still found: ${issues[0]}`);
          break;
        }
        setWorking({ text: `Fixing: ${issues[0]}` });
        made = (await api.revisePostAnimation(made.scriptId, issues)).animation;
        setAnimation(made);
      }
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
      setWorking(null);
    }
  }

  async function dropAnimation() {
    if (!script) return;
    setBusy("tool");
    setError(null);
    setTools(false);
    setWorking({ text: "Removing the animation…" });
    try {
      await api.removePostAnimation(script.id);
      setAnimation(null);
      setAnimationNote(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
      setWorking(null);
    }
  }

  async function applyVisual() {
    if (!script) return;
    if (visualDraft.format === "animation") return makeAnimation();
    setBusy("tool");
    setError(null);
    setWorking({ text: "Composing your visual from the post… this takes about 30 seconds.", media: true });
    setTools(false);
    try {
      await api.setPostVisual(script.id, {
        visualFormat: visualDraft.format,
        ...(visualDraft.format === "carousel" ? { slideCount: visualDraft.slides } : {}),
      });
      setConfirm(null);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
      setWorking(null);
    }
  }

  async function dropVisual() {
    if (!script) return;
    setBusy("tool");
    setError(null);
    setTools(false);
    setWorking({ text: "Removing the visual…" });
    try {
      await api.removePostVisual(script.id);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
      setWorking(null);
    }
  }

  const isVisual = Boolean(ownerId);
  const length = (editing ? draft : (script?.caption ?? "")).length;
  const sources = script?.citations ?? [];
  const why = [script?.eventTitle, script?.angle?.description].filter(Boolean);

  return (
    <article className="pane in-b" aria-labelledby="ap-title">
      {head}
      <div className="pane-body">
        <h2 id="ap-title" className="pane-title">
          {script?.title ?? entry?.script?.title ?? "…"}
        </h2>
        {formLabel && <span className="form-tag pane-form">{formLabel}</span>}
        <div className="author">
          <span className="av" aria-hidden="true">
            {(authorName || "You").slice(0, 2).toUpperCase()}
          </span>
          <div>
            <b>{authorName || "You"}</b>
            <span>Founder{productName ? ` · ${productName}` : ""}</span>
          </div>
        </div>

        {working && (
          <p className="ai-note working" role="status" aria-live="polite">
            <span className="status writing" />
            {working.text}
          </p>
        )}
        {working?.media && (
          <div className="post-media">
            <div className="frame">
              <div className="composing" aria-hidden="true" />
            </div>
          </div>
        )}
        {animation && !working?.media && (
          <div className="post-media anim-wrap">
            <div className="frame">
              <AnimationPlayer ref={playerRef} document={animation.document} width={animation.width} height={animation.height} label="Animation of the post" />
            </div>
          </div>
        )}
        {animationNote && !working && (
          <p className="pane-note" style={{ padding: 0, margin: "-8px 0 14px" }}>
            {animationNote}
          </p>
        )}
        {isVisual && ownerId && !working?.media && !animation && (
          <div className="post-media">
            <div className="frame">
              {preview ? (
                <DesignPreview scriptId={ownerId} preview={preview} hasLogo={hasLogo} />
              ) : (
                <div style={{ padding: 32, color: "var(--mute)", fontSize: 14 }}>The image is being composed…</div>
              )}
            </div>
            <div className="strip">
              <button className="tbtn" type="button" title="Edit the mockup" aria-label="Edit the mockup" onClick={() => void openMockup()}>
                <AppIcon name="image" />
              </button>
            </div>
          </div>
        )}

        {loadingScript && !script ? (
          <p className="post-text" style={{ color: "var(--mute)" }}>
            {entry?.script?.caption ?? "Loading…"}
          </p>
        ) : editing ? (
          <>
            <textarea className="editor" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Post text" />
            <div className="edit-row">
              <input
                value={draftTags}
                onChange={(e) => setDraftTags(e.target.value)}
                placeholder="#hashtags"
                aria-label="Hashtags"
                style={{ flex: 1, minWidth: 140, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", font: "inherit", fontSize: 14, color: "var(--accent)", background: "#fff" }}
              />
              <button className="btn btn-ink btn-sm" type="button" onClick={saveEdit} disabled={busy === "save"}>
                {busy === "save" ? "Saving…" : "Save changes"}
              </button>
              <button className="btn btn-quiet btn-sm" type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <span className="n">{length} characters</span>
            </div>
          </>
        ) : (
          <>
            {network === "x" && script ? (
              // Le thread : le premier tweet est le titre ci-dessus, les suivants viennent un par un.
              <div id="ap-post" className="post-text">
                {threadTweets(script.title, script.caption)
                  .slice(1)
                  .map((tweet, i) => (
                    <p key={i} style={{ margin: "0 0 14px", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                      {tweet}
                      <span style={{ display: "block", marginTop: 4, fontSize: 12, color: tweet.length > X_LIMIT ? "#b3261e" : "var(--mute)" }}>
                        {i + 2} · {tweet.length} / {X_LIMIT}
                      </span>
                    </p>
                  ))}
              </div>
            ) : (
              <p id="ap-post" className="post-text">
                {script?.caption}
              </p>
            )}
            {script && script.hashtags.length > 0 && (
              <p className="pane-tags">
                {script.hashtags.map((h) => (
                  <span key={h}>{h.startsWith("#") ? h : `#${h}`}</span>
                ))}
              </p>
            )}
            {network === "x" && script && (
              <p className="count" style={(script.title?.length ?? 0) > X_LIMIT ? { color: "#b3261e" } : undefined}>
                {threadTweets(script.title, script.caption).length > 1
                  ? `Thread · ${threadTweets(script.title, script.caption).length} tweets · first ${script.title?.length ?? 0} / ${X_LIMIT}`
                  : `${script.title?.length ?? 0} / ${X_LIMIT}`}
              </p>
            )}
          </>
        )}
        {error && (
          <p className="err" style={{ marginTop: 12 }} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="ai">
        <p className="ai-head">
          <i aria-hidden="true" />
          Edit with Tellovo AI
        </p>
        <div className="chips" role="group" aria-label="Suggested edits">
          {SUGGESTIONS.map((s) => (
            <button key={s.label} className="chip" type="button" disabled={busy !== null || !script || editing} onClick={() => applyInstruction(s.instruction, s.label)}>
              {s.label}
            </button>
          ))}
        </div>
        <form
          className="ai-form"
          onSubmit={(e) => {
            e.preventDefault();
            void applyInstruction(instruction, instruction.trim());
          }}
        >
          <label className="sr" htmlFor="ap-ai">
            Ask for a change
          </label>
          <input id="ap-ai" type="text" autoComplete="off" placeholder="Ask for a change… e.g. “mention our free tier”" value={instruction} onChange={(e) => setInstruction(e.target.value)} disabled={busy !== null || editing} />
          <button className="ai-go" type="submit" aria-label="Apply change" disabled={busy !== null || !instruction.trim()}>
            <AppIcon name="arrow" />
          </button>
        </form>
        {busy === "ai" && <p className="ai-note mute">Rewriting…</p>}
        {note && busy !== "ai" && (
          <p className="ai-note">
            {note.text} ·{" "}
            <button type="button" onClick={undo}>
              Undo
            </button>
          </p>
        )}
      </div>

      <div className="pane-acts">
        <button className="tbtn" type="button" onClick={() => { setDraft(script?.caption ?? ""); setDraftTags((script?.hashtags ?? []).join(" ")); setEditing(true); }} disabled={!script || editing} aria-label="Edit">
          <AppIcon name="edit" />
          <span className="lbl">Edit</span>
        </button>
        <button className="tbtn" type="button" onClick={copy} disabled={!script} aria-label="Copy">
          <AppIcon name="copy" />
          <span className="lbl">Copy</span>
        </button>
        <button className="tbtn" type="button" aria-expanded={showSource} aria-controls="ap-source" onClick={() => setShowSource((v) => !v)} aria-label="Source">
          <AppIcon name="source" />
          <span className="lbl">Source</span>
        </button>
        <div className="tools-wrap" ref={toolsRef}>
          <button className="tbtn" type="button" aria-expanded={tools} aria-haspopup="menu" onClick={() => { setTools((v) => !v); setConfirm(null); }} aria-label="Tools">
            <AppIcon name="tools" />
            <span className="lbl">Tools</span>
          </button>
          {tools && (
            <div className="bubble" role="menu">
              {confirm === "idea" && (
                <>
                  <h3>Replace the text with another idea?</h3>
                  <button type="button" onClick={anotherIdea}>
                    <AppIcon name="check" />
                    Yes, write another idea
                  </button>
                  <button type="button" onClick={() => setConfirm(null)}>
                    <AppIcon name="x" />
                    Keep this one
                  </button>
                </>
              )}
              {confirm === "visual" && (
                <>
                  <h3>{isVisual || animation ? "Change the visual" : "Add a visual"} — same for LinkedIn and X</h3>
                  <div className="chips" style={{ padding: "4px 8px 8px" }} role="group" aria-label="Visual format">
                    {([["single", "Image"], ["carousel", "Carousel"], ["animation", "Animation"]] as const).map(([format, label]) => (
                      <button key={format} className={visualDraft.format === format ? "chip on" : "chip"} type="button" onClick={() => setVisualDraft({ ...visualDraft, format })}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {visualDraft.format === "carousel" && (
                    <label className="visual-step">
                      <span>Slides</span>
                      <input type="number" min={MIN_SLIDES} max={MAX_SLIDES} value={visualDraft.slides} onChange={(e) => setVisualDraft({ ...visualDraft, slides: Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Number(e.target.value) || DEFAULT_SLIDES)) })} />
                    </label>
                  )}
                  {visualDraft.format === "animation" && (
                    <label className="visual-step">
                      <span>Seconds</span>
                      <input type="number" min={MIN_DURATION_MS / 1000} max={MAX_DURATION_MS / 1000} value={visualDraft.seconds} onChange={(e) => setVisualDraft({ ...visualDraft, seconds: Math.min(MAX_DURATION_MS / 1000, Math.max(MIN_DURATION_MS / 1000, Number(e.target.value) || 8)) })} />
                    </label>
                  )}
                  <p className="pane-note" style={{ padding: "0 10px 8px" }}>
                    The text stays as it is. The image is composed from the post and your photos; it counts as one edit.
                  </p>
                  <button type="button" onClick={applyVisual} disabled={busy !== null}>
                    <AppIcon name="check" />
                    {busy === "tool" ? "Composing…" : "Create the visual"}
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} disabled={busy !== null}>
                    <AppIcon name="x" />
                    Back
                  </button>
                </>
              )}
              {confirm === "delete" && (
                <>
                  <h3>Delete this post, both versions?</h3>
                  <button type="button" className="danger" onClick={deletePost}>
                    <AppIcon name="trash" />
                    Yes, delete it
                  </button>
                  <button type="button" onClick={() => setConfirm(null)}>
                    <AppIcon name="x" />
                    Keep it
                  </button>
                </>
              )}
              {confirm === null && (
                <>
                  <h3>Tools</h3>
                  <button type="button" role="menuitem" onClick={() => setConfirm("idea")} disabled={!script || script.origin !== "generated"}>
                    <AppIcon name="bulb" />
                    Another idea, same story
                  </button>
                  <button type="button" role="menuitem" onClick={regenerateTags} disabled={!script || script.hashtags.length === 0}>
                    <AppIcon name="refresh" />
                    Rewrite the hashtags
                  </button>
                  <button type="button" role="menuitem" onClick={() => setConfirm("visual")} disabled={!script}>
                    <AppIcon name="image" />
                    {isVisual ? "Change the visual" : "Add a visual"}
                  </button>
                  {animation && (
                    <button type="button" role="menuitem" onClick={dropAnimation}>
                      <AppIcon name="x" />
                      Remove the animation
                    </button>
                  )}
                  {isVisual && (
                    <>
                      <button type="button" role="menuitem" onClick={() => void openMockup()}>
                        <AppIcon name="edit" />
                        Edit the mockup
                      </button>
                      <button type="button" role="menuitem" onClick={dropVisual}>
                        <AppIcon name="x" />
                        Remove the visual
                      </button>
                    </>
                  )}
                  <hr />
                  <button type="button" role="menuitem" className="danger" onClick={() => setConfirm("delete")}>
                    <AppIcon name="trash" />
                    Delete this post
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {copied && <span className="ok">Copied to clipboard</span>}
        <button
          className={ready === "ready" ? "btn btn-sm main-act is-ready" : "btn btn-ink btn-sm main-act"}
          type="button"
          aria-pressed={ready === "ready"}
          onClick={toggleReady}
          disabled={busy !== null || !script || ready === "posted"}
        >
          {ready === "posted" ? "Posted" : ready === "ready" ? "Ready" : "Mark as ready"}
        </button>
      </div>

      {showSource && (
        <div className="source" id="ap-source">
          {animation && (
            <div className="why" style={{ borderTop: 0, paddingTop: 0 }}>
              <p className="k">The animation</p>
              <p>{animation.concept}</p>
            </div>
          )}
          {sources.length > 0 ? (
            <>
              <p className="k">Based on your material</p>
              {sources.map((c, i) => (
                <div className="srec" key={c.id}>
                  <span className="n">#{i + 1}</span>
                  <span className="t">{c.sourceMaterialTitle ?? "Source"}</span>
                  <span className="d">“{c.excerpt}”</span>
                </div>
              ))}
            </>
          ) : (
            <p className="k">No passage is attached to this post.</p>
          )}
          {why.length > 0 && (
            <div className="why">
              <p className="k">Why this angle</p>
              <p>{why.join(" — ")}</p>
            </div>
          )}
        </div>
      )}

      {mockup && ownerScript && isVisual && (
        <div className="ov" role="dialog" aria-modal="true" aria-label="Edit the mockup">
          <button className="scrim" type="button" aria-label="Close" onClick={() => { setMockup(false); onChanged(); }} />
          <div className="modal modal-wide">
            <button className="xbtn" type="button" aria-label="Close" onClick={() => { setMockup(false); onChanged(); }}>
              <AppIcon name="x" />
            </button>
            <DesignEditor
              script={ownerScript}
              hasLogo={hasLogo}
              onDesignChange={(design) => setOwnerScript((prev) => (prev ? { ...prev, visualDesign: design } : prev))}
              onReload={async () => {
                setOwnerScript((await api.getScript(ownerScript.id)).script);
              }}
            />
          </div>
        </div>
      )}
    </article>
  );
}
