/**
 * First layer of the control of a free HTML animation (docs/SPEC_ANIMATION_HTML_LIBRE.md §4): a reading of the
 * code the model wrote, before anything is displayed. Pure. It refuses what is dangerous (network, access to the
 * outside, storage) and what breaks the time contract (timers, randomness, clocks). The two other layers — the
 * sealed iframe and the rendering test — hold even if this reading misses something.
 */

export const MAX_ANIMATION_HTML_BYTES = 60_000;

const FORBIDDEN_TAGS = ["iframe", "frame", "frameset", "object", "embed", "applet", "form", "link", "meta", "base", "audio", "video", "source", "track", "portal"];

/** JS the contract refuses, with what to tell the model. Matched on word boundaries, comments and strings included (cheap and strict). */
const FORBIDDEN_JS: Array<{ re: RegExp; why: string }> = [
  { re: /\bfetch\s*\(/, why: "network call (fetch)" },
  { re: /\bXMLHttpRequest\b/, why: "network call (XMLHttpRequest)" },
  { re: /\bWebSocket\b/, why: "network call (WebSocket)" },
  { re: /\bEventSource\b/, why: "network call (EventSource)" },
  { re: /\bsendBeacon\b/, why: "network call (sendBeacon)" },
  { re: /\b(?:Shared)?Worker\b/, why: "worker" },
  { re: /\bimportScripts\b/, why: "importScripts" },
  { re: /\beval\s*\(/, why: "eval" },
  { re: /\bnew\s+Function\b|\bFunction\s*\(/, why: "Function constructor" },
  { re: /\bimport\s*\(/, why: "dynamic import" },
  { re: /\bdocument\s*\.\s*cookie\b/, why: "cookies" },
  { re: /\b(?:localStorage|sessionStorage|indexedDB)\b/, why: "browser storage" },
  { re: /\b(?:window\s*\.\s*)?(?:parent|top|opener)\s*[.[]/, why: "access to the outside (parent / top / opener)" },
  { re: /\bwindow\s*\.\s*(?:parent|top|opener)\b/, why: "access to the outside (parent / top / opener)" },
  { re: /\b(?:location|history)\s*[.=[]/, why: "navigation (location / history)" },
  { re: /\bpostMessage\b/, why: "postMessage" },
  { re: /\bsetTimeout\b|\bsetInterval\b/, why: "timer (setTimeout / setInterval): the animation must be a function of time" },
  { re: /\brequestAnimationFrame\b|\bcancelAnimationFrame\b/, why: "requestAnimationFrame: the animation must be a function of time" },
  { re: /\bMath\s*\.\s*random\b/, why: "Math.random: the same instant must give the same image" },
  { re: /\bDate\b/, why: "Date: the same instant must give the same image" },
  { re: /\bperformance\s*\.\s*now\b/, why: "performance.now: the same instant must give the same image" },
];

export interface AnimationHtmlReport {
  ok: boolean;
  issues: string[];
  /** The page animates something at all: a CSS animation, a Web Animation, or a `seek` function. */
  hasMotion: boolean;
}

function scriptBodies(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((m) => m[1]);
}

function styleBodies(html: string): string[] {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]);
}

/** Every URL-looking value of the page that points outside it: an attribute, a CSS `url()`, an `@import`. */
function externalReferences(html: string): string[] {
  const found: string[] = [];
  // xmlns declarations are namespaces, not requests.
  const withoutNamespaces = html.replace(/\bxmlns(?::\w+)?\s*=\s*("[^"]*"|'[^']*')/gi, "");
  for (const m of withoutNamespaces.matchAll(/\b(?:src|href|xlink:href|poster|action|formaction|data|srcset|ping)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const value = (m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (value === "" || value.startsWith("data:") || value.startsWith("#") || value.startsWith("{{")) continue;
    found.push(value);
  }
  for (const m of withoutNamespaces.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
    const value = m[2].trim();
    if (value === "" || value.startsWith("data:") || value.startsWith("#") || value.startsWith("{{")) continue;
    found.push(`url(${value})`);
  }
  for (const m of withoutNamespaces.matchAll(/@import\b[^;]*/gi)) found.push(m[0].trim());
  for (const m of withoutNamespaces.matchAll(/(?:https?:)?\/\/[\w.-]+\.[a-z]{2,}[^\s"')]*/gi)) found.push(m[0]);
  return found;
}

export function verifyAnimationHtml(html: string): AnimationHtmlReport {
  const issues: string[] = [];
  const bytes = new TextEncoder().encode(html).length;
  if (bytes > MAX_ANIMATION_HTML_BYTES) issues.push(`the page is ${Math.round(bytes / 1000)} KB, the limit is ${MAX_ANIMATION_HTML_BYTES / 1000} KB: write less code, reuse CSS`);
  if (html.trim().length === 0) issues.push("the page is empty");

  for (const tag of FORBIDDEN_TAGS) {
    if (new RegExp(`<${tag}[\\s>/]`, "i").test(html)) issues.push(`tag <${tag}> is not allowed`);
  }
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (/\bsrc\s*=/i.test(m[1])) issues.push("<script src> is not allowed: write the script inline");
  }
  if (/\bon[a-z]+\s*=\s*["']/i.test(html.replace(/<script[\s\S]*?<\/script\s*>/gi, ""))) issues.push("inline event handlers (onclick…) are not allowed");
  if (/javascript\s*:/i.test(html)) issues.push("javascript: URLs are not allowed");

  const external = [...new Set(externalReferences(html))];
  if (external.length > 0) issues.push(`no external resource is allowed (nothing loads from the network): ${external.slice(0, 3).join(", ")}`);

  const scripts = scriptBodies(html);
  for (const body of scripts) {
    for (const rule of FORBIDDEN_JS) {
      if (rule.re.test(body) && !issues.includes(`script uses ${rule.why}`)) issues.push(`script uses ${rule.why}`);
    }
  }

  const css = styleBodies(html).join("\n");
  const hasKeyframes = /@keyframes\b/i.test(css);
  const hasAnimationUse = /\banimation(?:-name)?\s*:/i.test(css) || /\banimation(?:-name)?\s*:/i.test(html);
  const hasWaapi = scripts.some((s) => /\.animate\s*\(/.test(s));
  const hasSeek = scripts.some((s) => /\bwindow\s*\.\s*seek\s*=|\bfunction\s+seek\s*\(/.test(s));
  const hasMotion = (hasKeyframes && hasAnimationUse) || hasWaapi || hasSeek;
  if (!hasMotion) issues.push("nothing moves: use CSS @keyframes, element.animate() or a window.seek(ms) function");

  return { ok: issues.length === 0, issues, hasMotion };
}
